import { scoreRouter } from "~/server/api/routers/score";
import { groupRouter } from "~/server/api/routers/group";
import { competitionRouter } from "~/server/api/routers/competition";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

export const appRouter = createTRPCRouter({
  score: scoreRouter,
  group: groupRouter,
  competition: competitionRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
