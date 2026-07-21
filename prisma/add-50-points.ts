import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

async function main() {
  console.log("🔄 Menambahkan 50 poin ke semua instansi...");
  const result = await db.score.updateMany({
    data: {
      score: {
        increment: 50,
      },
    },
  });
  console.log(`✅ Sukses! ${result.count} data instansi telah ditambahkan 50 poin.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
