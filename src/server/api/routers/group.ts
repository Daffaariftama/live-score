import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";

export const groupRouter = createTRPCRouter({
  // Public: get all groups ordered by name
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.group.findMany({
      orderBy: { name: "asc" },
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
