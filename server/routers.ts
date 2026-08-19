import { COOKIE_NAME } from "@shared/const";
import type { Response } from "express";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      (ctx.res as Response).clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),
  guardian: router({
    explain: publicProcedure.input(z.object({
      intent: z.string().max(320),
      actual: z.string().max(700),
      network: z.string().max(120),
      simulation: z.object({ status: z.string().max(40), detail: z.string().max(700), gasEstimate: z.string().max(80).optional() }),
      findings: z.array(z.object({ title: z.string().max(160), detail: z.string().max(500), level: z.string().max(20) })).max(8),
      movements: z.array(z.object({ symbol: z.string().max(30), amount: z.string().max(80), direction: z.string().max(30), detail: z.string().max(320) })).max(8),
    })).mutation(({ input }) => explainGuardianEvidence(input)),
    tokenIdentity: publicProcedure.input(z.object({ chainId: z.number().int(), address: z.string().regex(/^0x[a-fA-F0-9]{40}$/) })).query(({ input }) => getXLayerTokenIdentity(input.chainId, input.address)),
  }),

  // TODO: add feature routers here, e.g.
  // todo: router({
  //   list: protectedProcedure.query(({ ctx }) =>
  //     db.getUserTodos(ctx.user.id)
  //   ),
  // }),
});

export type AppRouter = typeof appRouter;
import { z } from "zod";
import { explainGuardianEvidence } from "./guardianExplanation";
import { getXLayerTokenIdentity } from "./xlayerTokenIdentity";
