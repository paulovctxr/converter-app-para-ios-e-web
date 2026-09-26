import { z } from 'zod';
import { COOKIE_NAME } from '../shared/const.js';
import { getSessionCookieOptions } from './_core/cookies';
import { adminProcedure, protectedProcedure, publicProcedure, router } from './_core/trpc';
import * as db from './db';

const planId = z.enum(['premium', 'plus']);
const planStatus = z.enum(['pending', 'approved', 'rejected']);

export const appRouter = router({
  system: router({
    health: publicProcedure.query(() => ({ status: 'ok' as const })),
  }),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  plans: router({
    createRequest: protectedProcedure.input(z.object({
      planId,
      amountCents: z.number().int().positive(),
      studentName: z.string().min(1).max(160),
      proofUrl: z.string().url().optional(),
    })).mutation(({ ctx, input }) => db.createPlanRequest({
      studentId: ctx.user.id,
      studentName: input.studentName,
      studentEmail: ctx.user.email,
      planId: input.planId,
      amountCents: input.amountCents,
      status: 'pending',
      proofUrl: input.proofUrl,
    })),
    list: adminProcedure.input(z.object({ status: planStatus.optional() }).optional()).query(({ input }) => db.listPlanRequests(input?.status)),
    review: adminProcedure.input(z.object({
      id: z.number().int().positive(),
      status: z.enum(['approved', 'rejected']),
      rejectionReason: z.string().max(500).optional(),
    })).mutation(({ ctx, input }) => db.updatePlanRequestStatus(input.id, input.status, ctx.user.id, input.rejectionReason)),
  }),
  students: router({
    list: adminProcedure.query(() => db.listStudents()),
  }),
});

export type AppRouter = typeof appRouter;
