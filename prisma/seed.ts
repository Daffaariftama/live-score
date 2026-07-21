import { PrismaClient } from "../generated/prisma";

const db = new PrismaClient();

const groupsData: Record<string, string[]> = {
  "KABUPATEN 1": [
    "Pemerintah Kab. Bandung Barat",
    "Pemerintah Kab. Ciamis",
    "Pemerintah Kab. Karawang",
    "Pemerintah Kab. Purwakarta",
    "Pemerintah Kab. Sukabumi",
    "Pemerintah Kab. Sumedang",
    "Pemerintah Kab. Banyuwangi",
    "Pemerintah Kab. Malang",
    "Pemerintah Kab. Trenggalek",
    "Pemerintah Kab. Jombang"
  ],
  "KABUPATEN 2": [
    "Pemerintah Kab. Ogan Komering Ulu",
    "Pemerintah Kab. Deli Serdang",
    "Pemerintah Kab. Serdang Bedagai",
    "Pemerintah Kab. Belitung",
    "Pemerintah Kab. Tulang Bawang",
    "Pemerintah Kab. Muaro Jambi",
    "Pemerintah Kab. Bengkulu Utara",
    "Pemerintah Kab. Pemalang",
    "Pemerintah Kab. Semarang",
    "Pemerintah Kab. Temanggung"
  ],
  "KABUPATEN 3": [
    "Pemerintah Kab. Kubu Raya",
    "Pemerintah Kab. Tapin",
    "Pemerintah Kab. Lombok Barat",
    "Pemerintah Kab. Bulukumba",
    "Pemerintah Kab. Wakatobi",
    "Pemerintah Kab. Bolaang Mongondow Utara",
    "Pemerintah Kab. Minahasa",
    "Pemerintah Kab. Gorontalo Utara",
    "Pemerintah Kab. Sleman",
    "Pemerintah Kab. Klungkung"
  ],
  "KOTA 1": [
    "Pemerintah Kota Serang",
    "Pemerintah Kota Bandung",
    "Pemerintah Kota Bekasi",
    "Pemerintah Kota Depok",
    "Pemerintah Kota Pasuruan"
  ],
  "KOTA 2": [
    "Pemerintah Kota Jambi",
    "Pemerintah Kota Metro",
    "Pemerintah Kota Ambon",
    "Pemerintah Kota Tidore Kepulauan",
    "Pemerintah Kota Solok",
    "Pemerintah Kota Denpasar"
  ],
  "PROVINSI 1": [
    "Pemerintah Provinsi Bali",
    "Pemerintah Provinsi Kalimantan Timur",
    "Pemerintah Provinsi Kalimantan Utara",
    "Pemerintah Provinsi Maluku",
    "Pemerintah Provinsi Papua Tengah",
    "Pemerintah Provinsi Sulawesi Selatan",
    "Pemerintah Provinsi Sulawesi Utara",
    "Pemerintah Provinsi Kalimantan Selatan",
    "Pemerintah Provinsi Gorontalo"
  ],
  "PROVINSI 2": [
    "Pemerintah Provinsi Aceh",
    "Pemerintah Provinsi Kalimantan Tengah",
    "Pemerintah Provinsi Jawa Barat",
    "Pemerintah Provinsi Jawa Tengah",
    "Pemerintah Provinsi Kepulauan Bangka Belitung",
    "Pemerintah Provinsi Sumatera Utara",
    "Pemerintah Provinsi DKI Jakarta",
    "Pemerintah Provinsi Jawa Timur"
  ],
  "K/L 1": [
    "Badan Pembinaan Ideologi Pancasila",
    "Badan Siber dan Sandi Negara",
    "Kementerian Dalam Negeri",
    "Kementerian Energi dan Sumber Daya Mineral",
    "Kementerian Hak Asasi Manusia",
    "Kementerian Hukum",
    "Kementerian Imigrasi dan Pemasyarakatan",
    "Kementerian Kebudayaan",
    "Kementerian Perumahan dan Kawasan Permukiman"
  ],
  "K/L 2": [
    "Kementerian Kehutanan",
    "Kementerian Kelautan dan Perikanan",
    "Kementerian Keuangan",
    "Kementerian Pekerjaan Umum",
    "Kementerian Perdagangan",
    "Kementerian Sekretariat Negara",
    "Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah",
    "Pusat Pelaporan dan Analisis Transaksi Keuangan",
    "Kementerian Pelindungan Pekerja Migran Indonesia/BP2MI"
  ]
};

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Clear database
  await db.score.deleteMany();
  await db.group.deleteMany();

  // 2. Create Groups and Participants
  for (const [groupName, participants] of Object.entries(groupsData)) {
    console.log(`Creating ${groupName}...`);
    const group = await db.group.create({
      data: { name: groupName, biddingActive: false }
    });

    for (const name of participants) {
      await db.score.create({
        data: {
          name,
          score: 50, // Starting score 50
          groupId: group.id
        }
      });
      console.log(`  ✅ ${name}`);
    }
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
