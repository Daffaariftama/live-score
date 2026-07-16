import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { scoreEmitter } from "~/server/event-emitter";

export const scoreRouter = createTRPCRouter({
  // Public: get all scores sorted by score desc
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.score.findMany({
      orderBy: { score: "desc" },
    });
  }),

  // Admin: create a new score entry
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nama tidak boleh kosong").max(100),
        score: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.create({
        data: { name: input.name, score: input.score },
      });
      scoreEmitter.emit("update");
      return result;
    }),

  // Admin: update an existing score entry
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(100),
        score: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.update({
        where: { id: input.id },
        data: { name: input.name, score: input.score },
      });
      scoreEmitter.emit("update");
      return result;
    }),

  // Admin: delete a score entry
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.delete({ where: { id: input.id } });
      scoreEmitter.emit("update");
      return result;
    }),

  // Public: check if bidding session is active
  isBiddingActive: publicProcedure.query(async ({ ctx }) => {
    const setting = await ctx.db.setting.findUnique({
      where: { key: "biddingActive" },
    });
    return setting?.value === "true";
  }),

  // Admin: toggle global bidding session status
  setBiddingActive: protectedProcedure
    .input(z.object({ active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.setting.upsert({
        where: { key: "biddingActive" },
        update: { value: input.active ? "true" : "false" },
        create: { key: "biddingActive", value: input.active ? "true" : "false" },
      });
      scoreEmitter.emit("update");
      return result;
    }),

  // Admin: update specific participant's bid value
  updateBid: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        bid: z.number().int().min(0, "Taruhan minimal 0"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.update({
        where: { id: input.id },
        data: { bid: input.bid },
      });
      scoreEmitter.emit("update");
      return result;
    }),

  // Admin: declare a participant as the bidding round winner
  declareBiddingWinner: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch all participants to perform math calculations
      const participants = await ctx.db.score.findMany();
      const winner = participants.find((p) => p.id === input.id);

      if (!winner) {
        throw new Error("Peserta pemenang tidak ditemukan");
      }

      const winnerBid = winner.bid ?? 10;

      // 2. Perform score adjustments for all participants inside a database transaction
      const updates = participants.map((p) => {
        if (p.id === winner.id) {
          // Winner: score + bid
          return ctx.db.score.update({
            where: { id: p.id },
            data: {
              score: p.score + winnerBid,
              bid: 10, // Reset bid to default for next round
            },
          });
        } else {
          // Losers: score - their own bid (clamped to minimum 0)
          const currentBid = p.bid ?? 10;
          return ctx.db.score.update({
            where: { id: p.id },
            data: {
              score: Math.max(0, p.score - currentBid),
              bid: 10, // Reset bid to default for next round
            },
          });
        }
      });

      await ctx.db.$transaction(updates);

      // 3. Emit SSE winner payload to trigger visual celebration on screen
      scoreEmitter.emit("update", `winner:${winner.name}:${winnerBid}`);

      return { success: true, name: winner.name, pointsWon: winnerBid };
    }),
});
