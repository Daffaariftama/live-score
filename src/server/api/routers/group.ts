import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const groupRouter = createTRPCRouter({
  // Public: get all groups ordered by name
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.group.findMany({
      orderBy: { name: "asc" },
    });
  }),

  // Public: get winners of each group
  getWinners: publicProcedure.query(async ({ ctx }) => {
    const groups = await ctx.db.group.findMany({
      include: {
        scores: {
          orderBy: { score: "desc" },
          take: 1, // Only get the top score
        },
      },
      orderBy: { name: "asc" },
    });

    return groups.map((group) => {
      const topScore = group.scores[0];
      return {
        id: group.id,
        groupName: group.name,
        winnerName: topScore ? topScore.name : "Belum ada data",
        score: topScore ? topScore.score : 0,
        logoUrl: topScore ? topScore.logoUrl : null,
      };
    });
  }),

  // Admin: create a new group
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1, "Nama grup tidak boleh kosong").max(50) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.group.create({
        data: { name: input.name },
      });
    }),

  // Admin: delete a group
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.group.delete({
        where: { id: input.id },
      });
    }),
});
