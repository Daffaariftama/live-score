import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { scoreEmitter } from "~/server/event-emitter";

export const scoreRouter = createTRPCRouter({
  // Public: get all scores sorted by score desc for a specific group
  getAll: publicProcedure
    .input(z.object({ groupId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.score.findMany({
        where: { groupId: input.groupId },
        orderBy: { score: "desc" },
      });
    }),

  // Admin: create a new score entry assigned to a group
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1, "Nama tidak boleh kosong").max(100),
        score: z.number().int(),
        groupId: z.number().int(),
        logoUrl: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.create({
        data: {
          name: input.name,
          score: input.score,
          groupId: input.groupId,
          logoUrl: input.logoUrl,
        },
      });
      scoreEmitter.emit("update", `update:${input.groupId}`);
      return result;
    }),

  // Admin: update an existing score entry
  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int(),
        name: z.string().min(1).max(100),
        score: z.number().int(),
        groupId: z.number().int(),
        logoUrl: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.score.update({
        where: { id: input.id },
        data: {
          name: input.name,
          score: input.score,
          groupId: input.groupId,
          logoUrl: input.logoUrl,
        },
      });
      scoreEmitter.emit("update", `update:${input.groupId}`);
      return result;
    }),

  // Admin: delete a score entry
  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const participant = await ctx.db.score.findUnique({ where: { id: input.id } });
      const result = await ctx.db.score.delete({ where: { id: input.id } });
      if (participant) {
        scoreEmitter.emit("update", `update:${participant.groupId}`);
      }
      return result;
    }),

  // Public: check if bidding session is active for a specific group
  isBiddingActive: publicProcedure
    .input(z.object({ groupId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const group = await ctx.db.group.findUnique({
        where: { id: input.groupId },
      });
      return group?.biddingActive === true;
    }),

  // Admin: toggle group bidding session status
  setBiddingActive: protectedProcedure
    .input(z.object({ groupId: z.number().int(), active: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.group.update({
        where: { id: input.groupId },
        data: { biddingActive: input.active },
      });
      scoreEmitter.emit("update", `update:${input.groupId}`);
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
      const participant = await ctx.db.score.findUnique({
        where: { id: input.id }
      });
      if (participant && participant.score <= 0) {
        throw new Error("Peserta dengan poin <= 0 tidak memenuhi syarat ikut bidding");
      }
      const result = await ctx.db.score.update({
        where: { id: input.id },
        data: { bid: input.bid },
      });
      scoreEmitter.emit("update", `update:${result.groupId}`);
      return result;
    }),

  // Admin: update multiple bids at once
  updateMultipleBids: protectedProcedure
    .input(
      z.array(
        z.object({
          id: z.number().int(),
          bid: z.number().int().min(0, "Taruhan minimal 0"),
        })
      )
    )
    .mutation(async ({ ctx, input }) => {
      if (input.length === 0) return { success: true };

      const ids = input.map((x) => x.id);
      const participants = await ctx.db.score.findMany({
        where: { id: { in: ids } },
      });

      const updates = input.map((item) => {
        const p = participants.find((part) => part.id === item.id);
        const score = p?.score ?? 0;
        const clampedBid = score <= 0 ? 0 : Math.min(item.bid, score);

        return ctx.db.score.update({
          where: { id: item.id },
          data: { bid: clampedBid },
        });
      });

      const results = await ctx.db.$transaction(updates);

      if (results[0]) {
        scoreEmitter.emit("update", `update:${results[0].groupId}`);
      }

      return { success: true };
    }),

  // Admin: declare a participant as the bidding round winner within their group
  declareBiddingWinner: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      // 1. Fetch the winning participant
      const winner = await ctx.db.score.findUnique({
        where: { id: input.id },
      });

      if (!winner) {
        throw new Error("Peserta pemenang tidak ditemukan");
      }

      if (winner.score <= 0) {
        throw new Error("Peserta dengan poin <= 0 tidak memenuhi syarat ikut bidding");
      }

      const winnerBid = Math.min(winner.bid ?? 10, winner.score);
      const groupId = winner.groupId;

      // 2. Fetch all participants in the same group to perform math calculations
      const groupParticipants = await ctx.db.score.findMany({
        where: { groupId },
      });

      // 3. Perform score adjustments inside a database transaction
      const updates = groupParticipants.map((p) => {
        if (p.id === winner.id) {
          // Winner: score + bid
          return ctx.db.score.update({
            where: { id: p.id },
            data: {
              score: p.score + winnerBid,
              bid: 10,
            },
          });
        } else if (p.score <= 0) {
          // Ineligible for bidding (score <= 0) -> no deduction
          return ctx.db.score.update({
            where: { id: p.id },
            data: { bid: 10 },
          });
        } else {
          // Eligible losers: score - their own bid
          const currentBid = Math.min(p.bid ?? 10, p.score);
          return ctx.db.score.update({
            where: { id: p.id },
            data: {
              score: Math.max(0, p.score - currentBid),
              bid: 10,
            },
          });
        }
      });

      await ctx.db.$transaction(updates);

      // 4. Emit SSE winner payload with group ID to target only that group's display
      scoreEmitter.emit("update", `winner:${groupId}:${winner.name}:${winnerBid}`);

      return { success: true, name: winner.name, pointsWon: winnerBid };
    }),

  // Admin: reset all scores in a group to a specific value (0 or 50)
  resetGroupScores: protectedProcedure
    .input(
      z.object({
        groupId: z.number().int(),
        scoreValue: z.number().int(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db.score.updateMany({
        where: { groupId: input.groupId },
        data: {
          score: input.scoreValue,
          bid: 10, // Reset bid to default for next round
        },
      });

      scoreEmitter.emit("update", `update:${input.groupId}`);

      return { success: true };
    }),

  // Admin: declare NO winner in bidding round (all participants lose their bid points)
  declareBiddingNoWinner: protectedProcedure
    .input(z.object({ groupId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const groupParticipants = await ctx.db.score.findMany({
        where: { groupId: input.groupId },
      });

      if (groupParticipants.length === 0) {
        throw new Error("Tidak ada peserta dalam grup ini");
      }

      const updates = groupParticipants.map((p) => {
        if (p.score <= 0) {
          // Ineligible for bidding (score <= 0) -> no deduction
          return ctx.db.score.update({
            where: { id: p.id },
            data: { bid: 10 },
          });
        }
        const currentBid = Math.min(p.bid ?? 10, p.score);
        return ctx.db.score.update({
          where: { id: p.id },
          data: {
            score: Math.max(0, p.score - currentBid),
            bid: 10, // Reset bid to default for next round
          },
        });
      });

      await ctx.db.$transaction(updates);

      scoreEmitter.emit("update", `update:${input.groupId}`);

      return { success: true, count: groupParticipants.length };
    }),
});
