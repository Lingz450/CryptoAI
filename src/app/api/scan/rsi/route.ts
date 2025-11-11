// RSI Scanner API with streaming progress
import { NextResponse } from 'next/server';

export const runtime = 'nodejs'; // avoid Edge for Node libs / streams
export const maxDuration = 60; // Vercel safeguard

type ScanParams = {
  timeframe: '1m' | '5m' | '15m' | '1h' | '4h' | '1d';
  type: 'OVERBOUGHT' | 'OVERSOLD' | 'BOTH';
  universe?: string[];
};

function tfToBinance(tf: string) {
  const map: Record<string, string> = {
    '1m': '1m',
    '5m': '5m',
    '15m': '15m',
    '1h': '1h',
    '4h': '4h',
    '1d': '1d',
  };
  return map[tf] ?? '1h';
}

async function fetchKlinesBinance(symbol: string, interval: string, limit = 200) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Binance ${symbol} ${interval} ${res.status}`);
  const raw = (await res.json()) as any[];
  return raw.map((r) => Number(r[4])); // closes
}

function rsi(values: number[], period = 14) {
  if (values.length < period + 1) return null;
  let gains = 0,
    losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

// Simple concurrency gate
function pLimit(limit: number) {
  const queue: (() => Promise<void>)[] = [];
  let active = 0;
  const run = async (fn: () => Promise<void>) => {
    active++;
    try {
      await fn();
    } finally {
      active--;
      if (queue.length) queue.shift()!();
    }
  };
  return <T,>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      const task = () =>
        run(async () => {
          try {
            resolve(await fn());
          } catch (e) {
            reject(e);
          }
        });
      active < limit ? task() : queue.push(task);
    });
}

// Per-symbol timeout wrapper
const withTimeout = <T,>(p: Promise<T>, ms = 7000) =>
  Promise.race([p, new Promise<T>((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<ScanParams>;
  const timeframe = tfToBinance((body.timeframe as string) || '1h');
  const mode = (body.type as string) || 'BOTH';

  // Default universe - top 50 liquid pairs
  const universe =
    body.universe ??
    [
      'BTCUSDT',
      'ETHUSDT',
      'BNBUSDT',
      'SOLUSDT',
      'XRPUSDT',
      'ADAUSDT',
      'DOGEUSDT',
      'TONUSDT',
      'AVAXUSDT',
      'LINKUSDT',
      'DOTUSDT',
      'TRXUSDT',
      'MATICUSDT',
      'ATOMUSDT',
      'APTUSDT',
      'ARBUSDT',
      'NEARUSDT',
      'FILUSDT',
      'SUIUSDT',
      'INJUSDT',
      'TIAUSDT',
      'OPUSDT',
      'SEIUSDT',
      'PEPEUSDT',
      'WIFUSDT',
      'BONKUSDT',
      'RUNEUSDT',
      'PYTHUSDT',
      'FTMUSDT',
      'AAVEUSDT',
      'ETCUSDT',
      'XLMUSDT',
      'HBARUSDT',
      'ALGOUSDT',
      'IMXUSDT',
      'ICPUSDT',
      'GRTUSDT',
      'SANDUSDT',
      'MANAUSDT',
      'AXSUSDT',
      'JTOUSDT',
      'JUPUSDT',
      'ONDOUSDT',
      'BEAMXUSDT',
      'NOTUSDT',
      'ORDIUSDT',
      'BLASTUSDT',
      'ENAUSDT',
      'RENDERUSDT',
      'WLDUSDT',
    ].slice(0, 50);

  const encoder = new TextEncoder();
  const limiter = pLimit(8);
  let done = 0;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: any) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      // Periodic progress heartbeat
      const progressTimer = setInterval(() => {
        send({ type: 'progress', done, total: universe.length });
      }, 1000);

      try {
        const tasks = universe.map((sym) =>
          limiter(async () => {
            try {
              const closes = await withTimeout(fetchKlinesBinance(sym, timeframe, 200), 7000);
              const value = rsi(closes, 14);
              done++;
              send({ type: 'progress', done, total: universe.length });
              if (value == null) return;

              const isOB = value >= 70;
              const isOS = value <= 30;
              
              if (
                (mode === 'BOTH' && (isOB || isOS)) ||
                (mode === 'OVERBOUGHT' && isOB) ||
                (mode === 'OVERSOLD' && isOS)
              ) {
                // Fetch current price
                const tickerRes = await fetch(
                  `https://api.binance.com/api/v3/ticker/24hr?symbol=${sym}`,
                  { cache: 'no-store' }
                );
                const ticker = await tickerRes.json();

                send({
                  type: 'row',
                  payload: {
                    symbol: sym,
                    timeframe,
                    rsi: Number(value.toFixed(2)),
                    condition: isOB ? 'OVERBOUGHT' : 'OVERSOLD',
                    currentPrice: parseFloat(ticker.lastPrice),
                    changePercent24h: parseFloat(ticker.priceChangePercent),
                    volume24h: parseFloat(ticker.quoteVolume),
                    potentialReversal: (isOB && value > 75) || (isOS && value < 25),
                  },
                });
              }
            } catch (err: any) {
              done++;
              send({ type: 'error', symbol: sym, message: String(err?.message ?? err) });
            }
          })
        );

        await Promise.allSettled(tasks);
        send({ type: 'done', total: universe.length });
      } catch (e: any) {
        send({ type: 'fatal', message: String(e?.message ?? e) });
      } finally {
        clearInterval(progressTimer);
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

