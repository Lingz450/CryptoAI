import { env } from '@/env';

const serverOnlyEnv = typeof window === 'undefined' ? env : undefined;

export function getBaseAppUrl() {
  if (typeof window !== 'undefined' && window.location.origin) {
    return window.location.origin;
  }

  return (
    serverOnlyEnv?.NEXT_PUBLIC_APP_URL ||
    serverOnlyEnv?.NEXTAUTH_URL ||
    (env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'https://ghostfx.app')
  );
}

function normalizePath(path: string) {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }
  return path;
}

export function buildShareUrl(path: string) {
  const base = getBaseAppUrl();
  const url = new URL(normalizePath(path), base);
  const referralCode =
    typeof window !== 'undefined'
      ? process.env.NEXT_PUBLIC_REFERRAL_CODE
      : serverOnlyEnv?.REFERRAL_CODE || serverOnlyEnv?.NEXT_PUBLIC_REFERRAL_CODE;
  if (referralCode) {
    url.searchParams.set('ref', referralCode);
  }
  return url.toString();
}

export function buildTwitterShareUrl(params: { text: string; url: string; hashtags?: string[] }) {
  const query = new URLSearchParams({
    text: params.text,
    url: params.url,
  });
  if (params.hashtags?.length) {
    query.set('hashtags', params.hashtags.join(','));
  }
  return `https://twitter.com/intent/tweet?${query.toString()}`;
}

export function buildTelegramShareUrl(params: { text: string; url: string }) {
  const query = new URLSearchParams({
    text: params.text,
    url: params.url,
  });
  return `https://t.me/share/url?${query.toString()}`;
}
