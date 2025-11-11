import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/Providers';
import { AIChatWidget } from '@/components/AIChatWidget';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'GhostFX - Crypto Command Center',
  description: 'Real-time crypto market intelligence, AI-powered analysis, and trading insights',
  keywords: ['crypto', 'trading', 'bitcoin', 'ethereum', 'market analysis', 'technical indicators'],
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
  },
  openGraph: {
    title: 'GhostFX - Crypto Command Center',
    description: 'Real-time crypto market intelligence powered by AI',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <Providers>
          {children}
          <AIChatWidget />
        </Providers>
      </body>
    </html>
  );
}

