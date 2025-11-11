// Extend NextAuth types
import { type DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'USER' | 'PRO' | 'ADMIN' | 'OWNER';
      telegramId?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role: 'USER' | 'PRO' | 'ADMIN' | 'OWNER';
    telegramId?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'USER' | 'PRO' | 'ADMIN' | 'OWNER';
  }
}

