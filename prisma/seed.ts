import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

async function main() {
  const entries = [
    { name: "Kementerian Keuangan",                         score: 50 },
    { name: "Kementerian Kesehatan",                        score: 50 },
    { name: "Kementerian Pendidikan & Kebudayaan",          score: 50 },
    { name: "Kementerian Dalam Negeri",                     score: 50 },
    { name: "Kementerian Luar Negeri",                      score: 50 },
    { name: "Kementerian Pertanian",                        score: 50 },
    { name: "Kementerian Perhubungan",                      score: 50 },
    { name: "Kementerian PUPR",                             score: 50 },
    { name: "Kementerian Sosial",                           score: 50 },
    { name: "Kementerian Hukum & HAM",                      score: 50 },
    { name: "Kementerian Energi & Sumber Daya Mineral",     score: 50 },
    { name: "Kementerian Komunikasi & Informatika",         score: 50 },
    { name: "Kementerian Tenaga Kerja",                     score: 50 },
    { name: "Kementerian Perindustrian",                    score: 50 },
    { name: "Kementerian Perdagangan",                      score: 50 },
  ];

  console.log("🌱 Seeding database dengan kementerian Indonesia...");
  await db.score.deleteMany();

  for (const entry of entries) {
    await db.score.create({ data: entry });
    console.log(`  ✅ ${entry.name}`);
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => void db.$disconnect());
