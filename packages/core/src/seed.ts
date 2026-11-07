import { and, eq } from "drizzle-orm";
import {
  academicYears,
  attendanceRules,
  classGroups,
  closeDb,
  departments,
  disciplineTypes,
  getDb,
  grades,
  guardians,
  guardianStudents,
  holidays,
  lessonPeriods,
  memberships,
  people,
  plans,
  rosterEntries,
  schools,
  subjects,
  subscriptions,
  users,
} from "@lonceng/db";
import { hashPassword } from "./password";
import { PLAN_SEED } from "./plans";
import { newStaticQrCode } from "./qr";

const db = getDb();

for (const plan of PLAN_SEED) {
  await db.insert(plans).values(plan).onConflictDoNothing();
}
console.log(`Paket: ${PLAN_SEED.length}`);

const superEmail = process.env.SUPER_ADMIN_EMAIL ?? "super@lonceng.test";
const [existingSuper] = await db.select().from(users).where(eq(users.email, superEmail));
if (!existingSuper) {
  await db.insert(users).values({
    name: "Super Admin",
    email: superEmail,
    passwordHash: await hashPassword(process.env.SUPER_ADMIN_PASSWORD ?? "lonceng123"),
    isSuperAdmin: true,
  });
}

if (process.argv.includes("--demo")) {
  const [already] = await db.select().from(schools).where(eq(schools.npsn, "99999901"));
  if (already) {
    console.log("Data demo sudah ada");
  } else {
    await seedDemo();
    console.log("Data demo dibuat. Kata sandi semua akun demo: lonceng123");
  }
}
await closeDb();

async function seedDemo() {
  const passwordHash = await hashPassword("lonceng123");
  const account = async (name: string, email: string) => {
    const [user] = await db.insert(users).values({ name, email, passwordHash }).returning();
    return user!;
  };

  const [school] = await db
    .insert(schools)
    .values({
      name: "SMA Demo Lonceng",
      npsn: "99999901",
      level: "SMA",
      address: "Jl. Contoh No. 1",
      city: "Yogyakarta",
      province: "DI Yogyakarta",
      latitude: -7.7956,
      longitude: 110.3695,
      onboardedAt: new Date(),
    })
    .returning();
  const schoolId = school!.id;
  await db.insert(subscriptions).values({
    schoolId,
    planCode: "standard",
    cycle: "yearly",
    expiresAt: new Date(Date.now() + 200 * 86_400_000),
  });

  const admin = await account("Admin Demo", "admin@lonceng.test");
  const principal = await account("Kepala Sekolah Demo", "kepsek@lonceng.test");
  const counselor = await account("Guru BK Demo", "bk@lonceng.test");
  await db.insert(memberships).values([
    { userId: admin.id, schoolId, role: "admin" },
    { userId: principal.id, schoolId, role: "principal" },
    { userId: counselor.id, schoolId, role: "counselor" },
    { userId: counselor.id, schoolId, role: "teacher" },
  ]);

  const [year] = await db
    .insert(academicYears)
    .values({ schoolId, name: "2026/2027", startDate: "2026-07-13", endDate: "2027-06-26", isActive: true })
    .returning();
  await db.insert(attendanceRules).values([
    { schoolId, personType: "student", openAt: "06:00", lateAfter: "07:00", closeAt: "09:00", checkoutAt: "14:00" },
    { schoolId, personType: "teacher", openAt: "06:00", lateAfter: "07:00", closeAt: "09:00", checkoutAt: "15:00" },
    { schoolId, personType: "staff", openAt: "06:00", lateAfter: "07:30", closeAt: "09:00", checkoutAt: "15:30" },
  ]);
  await db.insert(holidays).values({ schoolId, date: "2026-12-25", name: "Hari Raya Natal", isNational: true });

  const [ipa] = await db.insert(departments).values({ schoolId, code: "IPA", name: "Ilmu Pengetahuan Alam" }).returning();
  const [grade] = await db.insert(grades).values({ schoolId, name: "X", sortOrder: 10 }).returning();
  const subjectRows = await db
    .insert(subjects)
    .values([
      { schoolId, code: "MAT", name: "Matematika" },
      { schoolId, code: "BIN", name: "Bahasa Indonesia" },
      { schoolId, code: "FIS", name: "Fisika" },
    ])
    .returning();

  const teacherUser = await account("Rina Wulandari", "guru@lonceng.test");
  await db.insert(memberships).values({ userId: teacherUser.id, schoolId, role: "teacher" });
  const teachers = await db
    .insert(people)
    .values([
      { schoolId, type: "teacher", name: "Rina Wulandari", identifier: "198701012010012001", qrCode: newStaticQrCode(), userId: teacherUser.id },
      { schoolId, type: "teacher", name: "Budi Santoso", identifier: "198505052011011002", qrCode: newStaticQrCode() },
      { schoolId, type: "staff", name: "Sari Lestari", identifier: "TU-001", qrCode: newStaticQrCode() },
    ])
    .returning();

  const groups = await db
    .insert(classGroups)
    .values(
      ["X IPA 1", "X IPA 2"].map((name, i) => ({
        schoolId,
        academicYearId: year!.id,
        gradeId: grade!.id,
        departmentId: ipa!.id,
        name,
        homeroomTeacherId: teachers[i]!.id,
      })),
    )
    .returning();

  const names = ["Adit Pratama", "Bela Anjani", "Citra Dewi", "Dimas Saputra", "Eka Putri", "Fajar Nugroho", "Gita Maharani", "Hafiz Ramadhan", "Intan Permata", "Joko Susilo", "Kirana Ayu", "Lukman Hakim"];
  const students = await db
    .insert(people)
    .values(
      names.map((name, i) => ({
        schoolId,
        type: "student" as const,
        name,
        identifier: `26${String(i + 1).padStart(4, "0")}`,
        gender: i % 2 ? "P" : "L",
        qrCode: newStaticQrCode(),
        cardUid: `04A1B2${String(i).padStart(2, "0")}`,
        classGroupId: groups[i % 2]!.id,
      })),
    )
    .returning();

  const guardianUser = await account("Dewi Wali", "wali@lonceng.test");
  await db.insert(memberships).values({ userId: guardianUser.id, schoolId, role: "guardian" });
  const [guardian] = await db
    .insert(guardians)
    .values({ schoolId, name: "Dewi Wali", email: "wali@lonceng.test", userId: guardianUser.id })
    .returning();
  await db.insert(guardianStudents).values([
    { guardianId: guardian!.id, studentId: students[0]!.id, relation: "Ibu" },
    { guardianId: guardian!.id, studentId: students[1]!.id, relation: "Ibu" },
  ]);

  const periods = await db
    .insert(lessonPeriods)
    .values(
      [1, 2, 3, 4, 5].flatMap((dayOfWeek) => [
        { schoolId, dayOfWeek, number: 1, startTime: "07:00", endTime: "08:30" },
        { schoolId, dayOfWeek, number: 2, startTime: "08:30", endTime: "10:00" },
        { schoolId, dayOfWeek, number: 3, startTime: "10:00", endTime: "10:30", isBreak: true },
        { schoolId, dayOfWeek, number: 4, startTime: "10:30", endTime: "12:00" },
        { schoolId, dayOfWeek, number: 5, startTime: "12:30", endTime: "14:00" },
      ]),
    )
    .returning();
  const teaching = periods.filter((p) => !p.isBreak);
  await db.insert(rosterEntries).values(
    groups.flatMap((group, g) =>
      teaching.map((period) => ({
        schoolId,
        academicYearId: year!.id,
        semester: 1,
        classGroupId: group.id,
        lessonPeriodId: period.id,
        subjectId: subjectRows[(period.number + period.dayOfWeek + g) % 3]!.id,
        teacherId: teachers[(period.number + g) % 2]!.id,
      })),
    ),
  );

  await db.insert(disciplineTypes).values([
    { schoolId, kind: "violation", category: "Ringan", name: "Terlambat masuk kelas", points: 5 },
    { schoolId, kind: "violation", category: "Ringan", name: "Seragam tidak lengkap", points: 5 },
    { schoolId, kind: "violation", category: "Sedang", name: "Membolos pelajaran", points: 20 },
    { schoolId, kind: "award", category: "Prestasi", name: "Juara lomba", points: 25 },
  ]);
}
