// NextAuth configuration
import { env } from '@/env';
import { type NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const providers: NextAuthOptions['providers'] = [
  CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔐 Authorize called with email:', credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          console.log('❌ User not found:', credentials.email);
          return null;
        }

        if (!user.password) {
          console.log('❌ User has no password set');
          return null;
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isCorrectPassword) {
          console.log('❌ Invalid password');
          return null;
        }

        console.log('✅ Authentication successful for:', user.email);
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
];

if (env.TELEGRAM_BOT_TOKEN) {
  const telegramBotId = env.TELEGRAM_BOT_TOKEN.split(':')[0];

  providers.push({
      id: 'telegram',
      name: 'Telegram',
      type: 'oauth',
      authorization: {
        url: 'https://oauth.telegram.org/auth',
        params: {
          bot_id: telegramBotId,
          origin: env.NEXTAUTH_URL,
          request_access: 'write',
        },
      },
      token: {
        url: 'https://oauth.telegram.org/auth',
      },
      userinfo: {
        url: 'https://oauth.telegram.org/auth',
        async request(context) {
          // Telegram returns user data in the callback
          return context.tokens as any;
        },
      },
      profile(profile) {
        return {
          id: profile.id.toString(),
          name: `${profile.first_name} ${profile.last_name || ''}`.trim(),
          email: null, // Telegram doesn't provide email
          image: profile.photo_url,
          telegramId: profile.id.toString(),
          telegramUsername: profile.username,
          role: 'USER' as const,
        };
      },
  });
} else {
  console.warn('⚠️  TELEGRAM_BOT_TOKEN not configured; Telegram login disabled.');
}

export const authOptions: NextAuthOptions = {
  providers,
  callbacks: {
    async jwt({ token, user }) {
      // On sign in, add user data to token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = (user as any).role || 'USER';
        token.telegramId = (user as any).telegramId;
      }
      return token;
    },
    async session({ session, token }) {
      // Send properties to the client
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.role = token.role as any;
        session.user.telegramId = token.telegramId as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: env.NEXTAUTH_SECRET,
};

