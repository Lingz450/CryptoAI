// tRPC initialization and context
import { initTRPC, TRPCError } from '@trpc/server';
import { type CreateNextContextOptions } from '@trpc/server/adapters/next';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';
import { prisma } from '@/lib/prisma';

/**
 * Create tRPC context
 */
export const createTRPCContext = async (opts: CreateNextContextOptions) => {
  const session = await getServerSession(authOptions);

  return {
    session,
    prisma,
    req: opts.req,
    res: opts.res,
  };
};

/**
 * Initialize tRPC
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session || !ctx.session.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED' });
  }

  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
  });

  if (user?.role !== 'ADMIN' && user?.role !== 'OWNER') {
    throw new TRPCError({ code: 'FORBIDDEN' });
  }

  return next({ ctx });
});

/**
 * Pro procedure - requires PRO subscription or higher
 */
export const proProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx.session.user.id },
  });

  if (
    user?.role !== 'PRO' &&
    user?.role !== 'ADMIN' &&
    user?.role !== 'OWNER'
  ) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'This feature requires a PRO subscription',
    });
  }

  return next({ ctx });
});

