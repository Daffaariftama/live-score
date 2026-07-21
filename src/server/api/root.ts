import { scoreRouter } from "~/server/api/routers/score";
import { groupRouter } from "~/server/api/routers/group";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  score: scoreRouter,
  group: groupRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
