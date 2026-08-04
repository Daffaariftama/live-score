import { db } from "./src/server/db";
import { createCaller } from "./src/server/api/root";
async function runTest() {
    console.log("=== Mulai Test Case: Cek Double Score ===");
    // 1. Buat data dummy
    console.log("1. Membuat data dummy...");
    const group = await db.group.create({
        data: { name: "Test Group " + Date.now() },
    });
    const competition = await db.competition.create({
        data: { groupId: group.id, totalSoal: 1, currentSoal: 1, status: "active" },
    });
    const round = await db.round.create({
        data: { competitionId: competition.id, soalNumber: 1, status: "active", isBidding: false },
    });
    const participant = await db.score.create({
        data: { name: "Instansi Test", score: 100, groupId: group.id },
    });
    console.log(`   - Skor awal peserta: ${participant.score}`);
    // Init TRPC caller (bypass auth for test)
    const caller = createCaller({ db, session: { user: { id: "test", email: "test@test.com" }, expires: "9999" } });
    // 2. Simulasi Frontend: Admin klik tombol "Benar (+30)" 
    console.log("\n2. Simulasi Admin mengklik jawaban Benar (+30)...");
    await caller.score.update({
        id: participant.id,
        name: participant.name,
        score: participant.score + 30, // Score harusnya jadi 130
        groupId: group.id,
    });
    const scoreAfterClick = await db.score.findUnique({ where: { id: participant.id } });
    console.log(`   - Skor di DB setelah klik: ${scoreAfterClick?.score} (Harusnya 130)`);
    // 3. Simulasi Frontend: Admin menekan "Selesaikan Soal Biasa"
    console.log("\n3. Simulasi Admin mensubmit (Resolve Normal Round)...");
    await caller.competition.resolveNormalRound({
        roundId: round.id,
        correctIds: [participant.id],
        wrongIds: [],
        correctPoints: 30,
        wrongPoints: -5,
    });
    // 4. Verifikasi Skor Tidak Berubah (Tidak Double)
    const finalScore = await db.score.findUnique({ where: { id: participant.id } });
    console.log(`   - Skor akhir di DB: ${finalScore?.score}`);
    if (finalScore?.score === 130) {
        console.log("✅ TEST BERHASIL: Skor tidak di-double count. Tetap 130.");
    }
    else {
        console.error(`❌ TEST GAGAL: Skor akhir adalah ${finalScore?.score}, bukan 130! (Mungkin double count)`);
    }
    // Cek Log Entry
    const log = await db.roundEntry.findFirst({ where: { roundId: round.id, scoreId: participant.id } });
    console.log("\n5. Verifikasi Log Entry History...");
    console.log(`   - Log Result: ${log?.result}`);
    console.log(`   - Log pointChange: ${log?.pointChange}`);
    console.log(`   - Log scoreAfter: ${log?.scoreAfter}`);
    if (log?.scoreAfter === 130 && log?.pointChange === 30) {
        console.log("✅ TEST LOG BERHASIL: Log menyimpan data yang benar.");
    }
    else {
        console.error("❌ TEST LOG GAGAL: Log menyimpan data yang salah.");
    }
    console.log("\n=== Test Selesai ===");
    // Cleanup
    await db.roundEntry.deleteMany({ where: { roundId: round.id } });
    await db.score.delete({ where: { id: participant.id } });
    await db.round.delete({ where: { id: round.id } });
    await db.competition.delete({ where: { id: competition.id } });
    await db.group.delete({ where: { id: group.id } });
    process.exit(0);
}
runTest().catch((e) => {
    console.error(e);
    process.exit(1);
});
