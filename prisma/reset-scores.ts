import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

async function main() {
  console.log("🔄 Mereset semua skor kementerian ke 0...");
  const result = await db.score.updateMany({
    data: {
      score: 0,
    },
  });
  console.log(`✅ Sukses! ${result.count} data kementerian telah di-reset ke 0.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
