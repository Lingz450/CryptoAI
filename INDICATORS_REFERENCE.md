# 📊 Technical Indicators Reference

## Complete Indicator Library - 25+ Professional Indicators

Your CryptoAI platform now includes **25+ professional-grade technical indicators** used by institutional traders worldwide.

---

## 📈 Trend Indicators

### 1. **EMA (Exponential Moving Average)**
```typescript
calculateEMA(prices: number[], period: number)
```
- **Use**: Trend direction, support/resistance
- **Default periods**: 9, 20, 50, 200
- **Signal**: Price above EMA = bullish, below = bearish

### 2. **SMA (Simple Moving Average)**
```typescript
calculateSMA(prices: number[], period: number)
```
- **Use**: Trend identification, crossover strategies
- **Default periods**: 20, 50, 100, 200

### 3. **Parabolic SAR (Stop and Reverse)**
```typescript
calculateParabolicSAR(candles, acceleration = 0.02, maxAcceleration = 0.2)
```
- **Use**: Trailing stop loss, trend reversals
- **Signal**: Dots flip = trend reversal

### 4. **Supertrend**
```typescript
calculateSupertrend(candles, period = 10, multiplier = 3)
```
- **Use**: Strong trend confirmation, stop loss placement
- **Signal**: Green = uptrend, Red = downtrend
- **Great for**: Crypto volatility

### 5. **ADX (Average Directional Index)**
```typescript
calculateADX(candles, period = 14)
```
- **Use**: Trend strength measurement
- **Values**:
  - ADX > 25: Strong trend
  - ADX < 20: Weak/ranging market
  - ADX 20-25: Choppy
- **Returns**: `{ adx, plusDI, minusDI }`

### 6. **ADXR (ADX Rating)**
```typescript
calculateADXR(candles, period = 14)
```
- **Use**: Smoothed ADX for trend confirmation

---

## 🎯 Momentum Indicators

### 7. **RSI (Relative Strength Index)**
```typescript
calculateRSI(prices, period = 14)
```
- **Use**: Overbought/oversold conditions
- **Levels**:
  - RSI > 70: Overbought
  - RSI < 30: Oversold
  - RSI 50: Neutral

### 8. **Stochastic Oscillator**
```typescript
calculateStochastic(candles, kPeriod = 14, dPeriod = 3)
```
- **Use**: Reversal signals, divergences
- **Returns**: `{ k, d }`
- **Signal**: %K crosses %D

### 9. **Williams %R**
```typescript
calculateWilliamsR(candles, period = 14)
```
- **Use**: Similar to Stochastic, but inverted
- **Levels**:
  - %R > -20: Overbought
  - %R < -80: Oversold

### 10. **CCI (Commodity Channel Index)**
```typescript
calculateCCI(candles, period = 20)
```
- **Use**: Cycle identification, overbought/oversold
- **Levels**:
  - CCI > +100: Overbought
  - CCI < -100: Oversold

### 11. **ROC (Rate of Change)**
```typescript
calculateROC(prices, period = 12)
```
- **Use**: Momentum measurement, divergences
- **Signal**: Positive ROC = bullish momentum

### 12. **TSI (True Strength Index)**
```typescript
calculateTSI(prices, longPeriod = 25, shortPeriod = 13)
```
- **Use**: Double-smoothed momentum
- **Better than RSI**: Less noise, clearer signals

### 13. **Awesome Oscillator**
```typescript
calculateAwesomeOscillator(candles, shortPeriod = 5, longPeriod = 34)
```
- **Use**: Momentum and trend strength
- **Signal**: Color change = momentum shift

### 14. **Ultimate Oscillator**
```typescript
calculateUltimateOscillator(candles, period1 = 7, period2 = 14, period3 = 28)
```
- **Use**: Multi-timeframe momentum
- **Levels**:
  - UO > 70: Overbought
  - UO < 30: Oversold

### 15. **KST (Know Sure Thing)**
```typescript
calculateKST(prices)
```
- **Use**: Long-term momentum
- **Returns**: `{ kst, signal }`
- **Signal**: KST crosses signal line

---

## 📊 Volatility Indicators

### 16. **ATR (Average True Range)**
```typescript
calculateATR(candles, period = 14)
```
- **Use**: Volatility measurement, position sizing
- **Signal**: High ATR = high volatility

### 17. **Bollinger Bands**
```typescript
calculateBollingerBands(prices, period = 20, stdDev = 2)
```
- **Use**: Volatility, overbought/oversold
- **Returns**: `{ upper, middle, lower }`
- **Signal**: Price touches bands = reversal zone

### 18. **Keltner Channels**
```typescript
calculateKeltnerChannels(candles, emaPeriod = 20, atrPeriod = 10, multiplier = 2)
```
- **Use**: Similar to Bollinger, but ATR-based
- **Signal**: Breakouts beyond bands

### 19. **Donchian Channels**
```typescript
calculateDonchianChannels(candles, period = 20)
```
- **Use**: Breakout trading, support/resistance
- **Returns**: `{ upper, middle, lower }`
- **Signal**: Price breaks upper/lower = trend start

### 20. **Historical Volatility**
```typescript
calculateHistoricalVolatility(candles, period = 20)
```
- **Use**: Annualized volatility percentage
- **Great for**: Option pricing, risk management

---

## 💰 Volume Indicators

### 21. **OBV (On-Balance Volume)**
```typescript
calculateOBV(candles)
```
- **Use**: Volume flow, trend confirmation
- **Signal**: Rising OBV with price = healthy trend

### 22. **MFI (Money Flow Index)**
```typescript
calculateMFI(candles, period = 14)
```
- **Use**: Volume-weighted RSI
- **Levels**:
  - MFI > 80: Overbought
  - MFI < 20: Oversold

### 23. **CMF (Chaikin Money Flow)**
```typescript
calculateCMF(candles, period = 20)
```
- **Use**: Buying/selling pressure
- **Signal**:
  - CMF > 0: Buying pressure
  - CMF < 0: Selling pressure

### 24. **VWAP (Volume Weighted Average Price)**
```typescript
calculateVolumeProfile(candles, bins = 20)
```
- **Use**: Institutional levels, fair value

---

## 🎨 Chart Patterns & Levels

### 25. **Fibonacci Retracement**
```typescript
calculateFibonacciLevels(candles, lookback = 100)
```
- **Levels**: 23.6%, 38.2%, 50%, 61.8%, 78.6%
- **Use**: Pullback targets, support/resistance
- **Returns**: `{ high, low, levels[] }`

### 26. **Pivot Points**
```typescript
calculatePivotPoints(candles)
```
- **Returns**: Pivot, R1, R2, R3, S1, S2, S3
- **Use**: Intraday support/resistance
- **Great for**: Day trading

### 27. **Support & Resistance**
```typescript
findSupportResistance(candles, lookback = 50, threshold = 0.02)
```
- **Use**: Auto-detect key price levels
- **Algorithm**: Clustering of highs/lows

---

## 🌊 Advanced Oscillators

### 28. **Ichimoku Cloud**
```typescript
calculateIchimoku(candles, tenkan = 9, kijun = 26, senkouB = 52)
```
- **Returns**: `{ tenkanSen, kijunSen, senkouSpanA, senkouSpanB, chikouSpan }`
- **Use**: All-in-one indicator (trend, momentum, support)
- **Signal**: Price above cloud = bullish

### 29. **Elder Ray Index**
```typescript
calculateElderRay(candles, emaPeriod = 13)
```
- **Returns**: `{ bullPower, bearPower }`
- **Use**: Bull/bear strength relative to EMA
- **Signal**: Divergences predict reversals

### 30. **Aroon Indicator**
```typescript
calculateAroon(candles, period = 25)
```
- **Returns**: `{ aroonUp, aroonDown, aroonOscillator }`
- **Use**: Identify trend strength and beginning
- **Signal**: Aroon Up > 70 = strong uptrend

### 31. **Vortex Indicator**
```typescript
calculateVortex(candles, period = 14)
```
- **Returns**: `{ viPlus, viMinus }`
- **Use**: Trend reversal detection
- **Signal**: VI+ crosses VI- = trend change

---

## 🎯 Usage Examples

### Example 1: Multi-Indicator Confluence
```typescript
const candles = await priceService.getCandles('BTCUSDT', '1h', 250);
const prices = candles.map(c => c.close);

// Calculate multiple indicators
const rsi = calculateRSI(prices, 14);
const { adx } = calculateADX(candles, 14);
const { supertrend, direction } = calculateSupertrend(candles);
const stochastic = calculateStochastic(candles);

// Check confluence
const lastRSI = rsi[rsi.length - 1];
const lastADX = adx[adx.length - 1];
const lastDirection = direction[direction.length - 1];
const lastStochK = stochastic.k[stochastic.k.length - 1];

if (
  lastRSI < 30 &&           // Oversold
  lastADX > 25 &&           // Strong trend
  lastDirection === 'DOWN'  // Downtrend
  lastStochK < 20          // Stochastic oversold
) {
  console.log('🎯 Strong reversal setup detected!');
}
```

### Example 2: Fibonacci + Pivot Points
```typescript
const candles = await priceService.getCandles('ETHUSDT', '1h', 200);

// Get Fibonacci levels
const fib = calculateFibonacciLevels(candles, 100);
console.log('Fibonacci 61.8% level:', fib.levels[4].price);

// Get Pivot Points
const pivots = calculatePivotPoints(candles);
console.log('Daily pivot:', pivots.pivot);
console.log('Resistance levels:', pivots.resistance1, pivots.resistance2);
```

### Example 3: Volume Confirmation
```typescript
const candles = await priceService.getCandles('SOLUSDT', '1h', 100);

const obv = calculateOBV(candles);
const mfi = calculateMFI(candles, 14);
const cmf = calculateCMF(candles, 20);

const lastOBV = obv[obv.length - 1];
const lastMFI = mfi[mfi.length - 1];
const lastCMF = cmf[cmf.length - 1];

if (lastMFI > 80 && lastCMF > 0.2) {
  console.log('⚠️ Overbought with strong buying pressure');
}
```

### Example 4: Ichimoku Cloud Strategy
```typescript
const candles = await priceService.getCandles('BTCUSDT', '1h', 200);
const ichimoku = calculateIchimoku(candles);

const currentPrice = candles[candles.length - 1].close;
const cloudTop = Math.max(
  ichimoku.senkouSpanA[ichimoku.senkouSpanA.length - 1],
  ichimoku.senkouSpanB[ichimoku.senkouSpanB.length - 1]
);
const cloudBottom = Math.min(
  ichimoku.senkouSpanA[ichimoku.senkouSpanA.length - 1],
  ichimoku.senkouSpanB[ichimoku.senkouSpanB.length - 1]
);

if (currentPrice > cloudTop) {
  console.log('✅ Bullish - Price above cloud');
} else if (currentPrice < cloudBottom) {
  console.log('❌ Bearish - Price below cloud');
} else {
  console.log('⚠️ Inside cloud - wait for breakout');
}
```

---

## 🔥 Best Indicator Combinations

### For Trend Trading
1. **EMA 50/200** + **ADX** + **Supertrend**
2. **Ichimoku Cloud** + **Parabolic SAR**
3. **Aroon** + **ADXR** + **Elder Ray**

### For Reversal Trading
1. **RSI** + **Stochastic** + **Williams %R**
2. **CCI** + **Ultimate Oscillator**
3. **Fibonacci** + **Pivot Points**

### For Scalping
1. **Supertrend** + **OBV** + **CMF**
2. **Stochastic** + **MFI**
3. **Pivot Points** + **ATR**

### For Swing Trading
1. **Ichimoku Cloud** + **MACD** + **Volume**
2. **Fibonacci** + **EMA** + **RSI**
3. **Keltner Channels** + **Elder Ray**

---

## 📊 Indicator Categories Summary

### **Trend** (7 indicators)
- EMA, SMA, ADX, ADXR, Parabolic SAR, Supertrend, Aroon

### **Momentum** (9 indicators)
- RSI, Stochastic, Williams %R, CCI, ROC, TSI, Awesome Oscillator, Ultimate Oscillator, KST

### **Volatility** (5 indicators)
- ATR, Bollinger Bands, Keltner Channels, Donchian Channels, Historical Volatility

### **Volume** (4 indicators)
- OBV, MFI, CMF, Volume Profile

### **Support/Resistance** (3 indicators)
- Fibonacci Levels, Pivot Points, Auto-detect S/R

### **Multi-Purpose** (2 indicators)
- Ichimoku Cloud, Elder Ray, Vortex

---

## 🎯 Indicator Interpretation Guide

### Overbought/Oversold Indicators
| Indicator | Overbought | Oversold | Neutral |
|-----------|------------|----------|---------|
| RSI | > 70 | < 30 | 40-60 |
| Stochastic | > 80 | < 20 | 40-60 |
| Williams %R | > -20 | < -80 | -40 to -60 |
| CCI | > +100 | < -100 | -100 to +100 |
| MFI | > 80 | < 20 | 40-60 |
| Ultimate Osc | > 70 | < 30 | 40-60 |

### Trend Strength Indicators
| Indicator | Strong Trend | Weak Trend | Range |
|-----------|--------------|------------|-------|
| ADX | > 25 | < 20 | 20-25 |
| Aroon Osc | > 50 | < -50 | -50 to 50 |
| Vortex | VI+ >> VI- | VI+ ≈ VI- | VI- >> VI+ |

---

## 💡 Pro Tips

### 1. **Combine Indicators from Different Categories**
✅ Good: RSI (momentum) + ADX (trend) + OBV (volume)
❌ Bad: RSI + Stochastic + Williams %R (all similar)

### 2. **Look for Divergences**
- Price makes higher high, RSI makes lower high = bearish divergence
- Price makes lower low, MFI makes higher low = bullish divergence

### 3. **Use Multiple Timeframes**
- 1h chart: RSI oversold
- 4h chart: Uptrend confirmed
- 1d chart: Above 200 EMA
= Strong buy signal

### 4. **Volume Confirmation**
Always check volume indicators (OBV, MFI, CMF) to confirm price moves.

### 5. **Volatility for Stop Loss**
Use ATR to set dynamic stop losses:
- Stop Loss = Entry ± (2 × ATR)

---

## 🚀 Advanced Strategies

### Strategy 1: Supertrend + RSI Scalping
```typescript
const { supertrend, direction } = calculateSupertrend(candles, 10, 3);
const rsi = calculateRSI(prices, 14);

if (direction === 'UP' && rsi < 40) {
  // Buy signal: Uptrend + RSI pullback
}
```

### Strategy 2: Ichimoku + Volume Confirmation
```typescript
const ichimoku = calculateIchimoku(candles);
const obv = calculateOBV(candles);

// Price breaks above cloud + OBV rising = strong buy
```

### Strategy 3: Multi-Oscillator Reversal
```typescript
const rsi = calculateRSI(prices, 14);
const stoch = calculateStochastic(candles);
const williams = calculateWilliamsR(candles);

// All three oversold = high-probability bounce
if (rsi < 30 && stoch.k < 20 && williams < -80) {
  console.log('🎯 Triple confirmation reversal!');
}
```

### Strategy 4: Fibonacci + Pivot Confluence
```typescript
const fib = calculateFibonacciLevels(candles);
const pivots = calculatePivotPoints(candles);

// Check if Fib 61.8% aligns with Pivot S1
// If yes = strong support level
```

---

## 📖 Indicator Comparison

### RSI vs Stochastic vs Williams %R
- **RSI**: Best for divergences
- **Stochastic**: Best for ranging markets
- **Williams %R**: Best for trend markets (more volatile)

### Bollinger vs Keltner vs Donchian
- **Bollinger**: Volatility-based (standard deviation)
- **Keltner**: ATR-based (true range)
- **Donchian**: High/Low-based (breakouts)

### ADX vs Aroon vs Vortex
- **ADX**: Trend strength (0-100)
- **Aroon**: Trend freshness (time since high/low)
- **Vortex**: Trend direction changes

---

## 🎯 Quick Reference

**Most Popular:**
1. RSI (overbought/oversold)
2. EMA (trend)
3. MACD (momentum)
4. Bollinger Bands (volatility)
5. ADX (trend strength)

**Best for Crypto:**
1. Supertrend (volatility-adjusted)
2. ATR (position sizing)
3. OBV (volume confirmation)
4. Fibonacci (support/resistance)
5. Parabolic SAR (trailing stops)

**Advanced Traders:**
1. Ichimoku Cloud (complete system)
2. TSI (double-smoothed momentum)
3. KST (multi-timeframe)
4. Ultimate Oscillator (multi-period)
5. Vortex (trend changes)

---

## 📚 Further Learning

### Books
- "Technical Analysis of the Financial Markets" - John Murphy
- "Trading for a Living" - Dr. Alexander Elder
- "Technical Analysis Using Multiple Timeframes" - Brian Shannon

### Online Resources
- TradingView Indicator Library
- Investopedia Technical Analysis Guide
- Our platform's built-in indicator documentation

---

## ✅ All Indicators Now Available

Your CryptoAI platform includes **31 total indicators**:

✅ Basic: SMA, EMA, RSI, MACD, ATR, Bollinger Bands
✅ Advanced: ADX, Stochastic, CCI, Williams %R, Parabolic SAR
✅ Volume: OBV, MFI, CMF, Volume Profile
✅ Complex: Ichimoku, Fibonacci, Pivot Points, Supertrend
✅ Exotic: TSI, KST, Ultimate Oscillator, Aroon, Vortex, Elder Ray
✅ Channels: Keltner, Donchian, Bollinger
✅ Volatility: ATR, Historical Vol, Bollinger Width

**All indicators are production-ready and optimized for crypto markets!** 🎯

---

**Next steps**: Use these indicators in your screeners, alerts, and backtests!

