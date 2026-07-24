import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { scoreEmitter } from "~/server/event-emitter";

export const competitionRouter = createTRPCRouter({
  // Public: get active competition for a group (with active round)
  getActive: publicProcedure
    .input(z.object({ groupId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      const competition = await ctx.db.competition.findFirst({
        where: { groupId: input.groupId, status: "active" },
        include: {
          rounds: {
            orderBy: { soalNumber: "asc" },
          },
        },
      });
      return competition;
    }),

  // Public: get all competitions for a group (with rounds + entries for history)
  getHistory: publicProcedure
    .input(z.object({ groupId: z.number().int() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.competition.findMany({
        where: { groupId: input.groupId },
        orderBy: { createdAt: "desc" },
        include: {
          rounds: {
            orderBy: { soalNumber: "asc" },
            include: {
              entries: {
                orderBy: { pointChange: "desc" },
              },
            },
          },
        },
      });
    }),

  // Admin: start a new competition
  startCompetition: protectedProcedure
    .input(
      z.object({
        groupId: z.number().int(),
        totalSoal: z.number().int().min(1, "Minimal 1 soal").max(50, "Maksimal 50 soal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if there's already an active competition for this group
      const existing = await ctx.db.competition.findFirst({
        where: { groupId: input.groupId, status: "active" },
      });
      if (existing) {
        throw new Error("Sudah ada lomba aktif untuk grup ini. Akhiri lomba sebelumnya terlebih dahulu.");
      }

      // Reset group biddingActive to false by default
      await ctx.db.group.update({
        where: { id: input.groupId },
        data: { biddingActive: false },
      });

      // Create competition + first round
      const competition = await ctx.db.competition.create({
        data: {
          groupId: input.groupId,
          totalSoal: input.totalSoal,
          currentSoal: 1,
          status: "active",
          rounds: {
            create: {
              soalNumber: 1,
              isBidding: false,
              status: "active",
            },
          },
        },
        include: { rounds: true },
      });

      scoreEmitter.emit("update", `update:${input.groupId}`);
      return competition;
    }),

  // Admin: start the next round
  startNextRound: protectedProcedure
    .input(z.object({ competitionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const competition = await ctx.db.competition.findUnique({
        where: { id: input.competitionId },
        include: { rounds: { where: { status: "active" } } },
      });

      if (!competition) throw new Error("Lomba tidak ditemukan");
      if (competition.status !== "active") throw new Error("Lomba sudah selesai");

      // Ensure current round is completed
      const activeRound = competition.rounds[0];
      if (activeRound) {
        throw new Error("Selesaikan soal saat ini terlebih dahulu sebelum melanjutkan.");
      }

      const nextSoal = competition.currentSoal + 1;
      if (nextSoal > competition.totalSoal) {
        throw new Error("Semua soal sudah selesai. Silakan akhiri lomba.");
      }

      // Create next round, update currentSoal, and reset group biddingActive to false
      const [_, round] = await ctx.db.$transaction([
        ctx.db.competition.update({
          where: { id: input.competitionId },
          data: { currentSoal: nextSoal },
        }),
        ctx.db.group.update({
          where: { id: competition.groupId },
          data: { biddingActive: false },
        }),
        ctx.db.round.create({
          data: {
            competitionId: input.competitionId,
            soalNumber: nextSoal,
            isBidding: false,
            status: "active",
          },
        }),
      ]);

      scoreEmitter.emit("update", `update:${competition.groupId}`);
      return round;
    }),

  // Admin: toggle bidding mode for the active round
  toggleRoundBidding: protectedProcedure
    .input(
      z.object({
        roundId: z.number().int(),
        isBidding: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.round.findUnique({
        where: { id: input.roundId },
        include: { competition: true },
      });
      if (!round) throw new Error("Round tidak ditemukan");
      if (round.status !== "active") throw new Error("Round sudah selesai");

      const [updated] = await ctx.db.$transaction([
        ctx.db.round.update({
          where: { id: input.roundId },
          data: { isBidding: input.isBidding },
        }),
        ctx.db.group.update({
          where: { id: round.competition.groupId },
          data: { biddingActive: input.isBidding },
        }),
      ]);

      scoreEmitter.emit("update", `update:${round.competition.groupId}`);
      return updated;
    }),

  // Admin: resolve a normal (non-bidding) round
  resolveNormalRound: protectedProcedure
    .input(
      z.object({
        roundId: z.number().int(),
        correctIds: z.array(z.number().int()), // IDs of participants who answered correctly
        wrongIds: z.array(z.number().int()),   // IDs of participants who answered wrong
      })
    )
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.round.findUnique({
        where: { id: input.roundId },
        include: { competition: true },
      });
      if (!round) throw new Error("Round tidak ditemukan");
      if (round.status !== "active") throw new Error("Round sudah diselesaikan");
      if (round.isBidding) throw new Error("Round ini adalah soal bidding, gunakan resolve bidding");

      const groupId = round.competition.groupId;

      // Fetch all participants in the group
      const participants = await ctx.db.score.findMany({
        where: { groupId },
      });

      const correctSet = new Set(input.correctIds);
      const wrongSet = new Set(input.wrongIds);

      // Build entry logs
      const entryData = [];

      for (const p of participants) {
        let pointChange = 0;
        let result = "skip";

        if (correctSet.has(p.id)) {
          pointChange = 10;
          result = "correct";
        } else if (wrongSet.has(p.id)) {
          pointChange = -5;
          result = "wrong";
        }

        entryData.push({
          roundId: input.roundId,
          scoreId: p.id,
          name: p.name,
          bidAmount: 0,
          pointChange,
          scoreAfter: p.score,
          result,
        });
      }

      // Execute all in transaction + turn off biddingActive
      await ctx.db.$transaction([
        ctx.db.roundEntry.createMany({ data: entryData }),
        ctx.db.round.update({
          where: { id: input.roundId },
          data: { status: "completed" },
        }),
        ctx.db.group.update({
          where: { id: groupId },
          data: { biddingActive: false },
        }),
      ]);

      scoreEmitter.emit("update", `update:${groupId}`);

      const correctCount = input.correctIds.length;
      const wrongCount = input.wrongIds.length;
      const skipCount = participants.length - correctCount - wrongCount;

      return { success: true, correctCount, wrongCount, skipCount };
    }),

  // Admin: resolve a bidding round (with winner or no winner)
  resolveBiddingRound: protectedProcedure
    .input(
      z.object({
        roundId: z.number().int(),
        winnerId: z.number().int().nullable(), // null = no winner
      })
    )
    .mutation(async ({ ctx, input }) => {
      const round = await ctx.db.round.findUnique({
        where: { id: input.roundId },
        include: { competition: true },
      });
      if (!round) throw new Error("Round tidak ditemukan");
      if (round.status !== "active") throw new Error("Round sudah diselesaikan");
      if (!round.isBidding) throw new Error("Round ini bukan soal bidding");

      const groupId = round.competition.groupId;

      const participants = await ctx.db.score.findMany({
        where: { groupId },
      });

      const scoreUpdates = [];
      const entryData = [];
      let winnerName: string | null = null;

      if (input.winnerId !== null) {
        // There is a winner
        const winner = participants.find((p) => p.id === input.winnerId);
        if (!winner) throw new Error("Peserta pemenang tidak ditemukan");
        if (winner.score <= 0) throw new Error("Peserta dengan poin <= 0 tidak memenuhi syarat");

        winnerName = winner.name;
        const winnerBid = Math.min(winner.bid ?? 10, winner.score);

        for (const p of participants) {
          if (p.id === winner.id) {
            // Winner gets +bid
            const newScore = p.score + winnerBid;
            scoreUpdates.push(
              ctx.db.score.update({
                where: { id: p.id },
                data: { score: newScore, bid: 10 },
              })
            );
            entryData.push({
              roundId: input.roundId,
              scoreId: p.id,
              name: p.name,
              bidAmount: winnerBid,
              pointChange: winnerBid,
              scoreAfter: newScore,
              result: "win",
            });
          } else if (p.score <= 0) {
            // Ineligible for bidding (score <= 0) -> no point deduction!
            entryData.push({
              roundId: input.roundId,
              scoreId: p.id,
              name: p.name,
              bidAmount: 0,
              pointChange: 0,
              scoreAfter: p.score,
              result: "ineligible",
            });
          } else {
            // Eligible losers lose their own bid
            const currentBid = Math.min(p.bid ?? 10, p.score);
            const newScore = Math.max(0, p.score - currentBid);
            scoreUpdates.push(
              ctx.db.score.update({
                where: { id: p.id },
                data: { score: newScore, bid: 10 },
              })
            );
            entryData.push({
              roundId: input.roundId,
              scoreId: p.id,
              name: p.name,
              bidAmount: currentBid,
              pointChange: -currentBid,
              scoreAfter: newScore,
              result: "lose",
            });
          }
        }
      } else {
        // No winner — eligible participants lose their bid, ineligible (score <= 0) lose 0
        for (const p of participants) {
          if (p.score <= 0) {
            // Ineligible for bidding -> no point deduction!
            entryData.push({
              roundId: input.roundId,
              scoreId: p.id,
              name: p.name,
              bidAmount: 0,
              pointChange: 0,
              scoreAfter: p.score,
              result: "ineligible",
            });
          } else {
            const currentBid = Math.min(p.bid ?? 10, p.score);
            const newScore = Math.max(0, p.score - currentBid);
            scoreUpdates.push(
              ctx.db.score.update({
                where: { id: p.id },
                data: { score: newScore, bid: 10 },
              })
            );
            entryData.push({
              roundId: input.roundId,
              scoreId: p.id,
              name: p.name,
              bidAmount: currentBid,
              pointChange: -currentBid,
              scoreAfter: newScore,
              result: "no_contest",
            });
          }
        }
      }

      // Execute all in transaction + turn off biddingActive
      await ctx.db.$transaction([
        ...scoreUpdates,
        ctx.db.roundEntry.createMany({ data: entryData }),
        ctx.db.round.update({
          where: { id: input.roundId },
          data: {
            status: "completed",
            winnerId: input.winnerId,
            winnerName,
          },
        }),
        ctx.db.group.update({
          where: { id: groupId },
          data: { biddingActive: false },
        }),
      ]);

      scoreEmitter.emit("update", `update:${groupId}`);

      return {
        success: true,
        winnerName,
        hasWinner: input.winnerId !== null,
      };
    }),

  // Admin: end a competition
  endCompetition: protectedProcedure
    .input(z.object({ competitionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const competition = await ctx.db.competition.findUnique({
        where: { id: input.competitionId },
        include: { rounds: { where: { status: "active" } } },
      });

      if (!competition) throw new Error("Lomba tidak ditemukan");
      if (competition.status !== "active") throw new Error("Lomba sudah selesai");

      // Complete any remaining active rounds as skipped
      if (competition.rounds.length > 0) {
        await ctx.db.round.updateMany({
          where: { competitionId: input.competitionId, status: "active" },
          data: { status: "completed" },
        });
      }

      const updated = await ctx.db.competition.update({
        where: { id: input.competitionId },
        data: { status: "completed" },
      });

      // Reset group biddingActive to false
      await ctx.db.group.update({
        where: { id: competition.groupId },
        data: { biddingActive: false },
      });

      scoreEmitter.emit("update", `update:${competition.groupId}`);
      return updated;
    }),

  // Admin: delete a competition session and all its historical logs
  deleteCompetition: protectedProcedure
    .input(z.object({ competitionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const competition = await ctx.db.competition.findUnique({
        where: { id: input.competitionId },
      });
      if (!competition) throw new Error("Sesi lomba tidak ditemukan");

      await ctx.db.competition.delete({
        where: { id: input.competitionId },
      });

      scoreEmitter.emit("update", `update:${competition.groupId}`);
      return { success: true };
    }),
});
