import { and, eq } from "drizzle-orm";
import { classGroups, dailyAttendance, guardians, guardianStudents, memberships, people, schools } from "@lonceng/db";
import { db } from "./db";
import { ROLE_LABELS, type Role } from "./permissions";

/** The session payload: which school, which role, and which children this login can see. */
export async function mobileProfile(user: { id: string; name: string; email: string | null; phone: string | null }) {
  const rows = await db()
    .select({ school: schools, role: memberships.role })
    .from(memberships)
    .innerJoin(schools, eq(schools.id, memberships.schoolId))
    .where(and(eq(memberships.userId, user.id), eq(memberships.isActive, true)));

  const map = new Map<string, { id: string; name: string; timezone: string; roles: string[]; roleLabels: string[]; isGuardian: boolean; isStaff: boolean; isCounselor: boolean }>();
  for (const { school, role } of rows) {
    const entry = map.get(school.id) ?? { id: school.id, name: school.name, timezone: school.timezone, roles: [], roleLabels: [], isGuardian: false, isStaff: false, isCounselor: false };
    entry.roles.push(role);
    entry.roleLabels.push(ROLE_LABELS[role as Role]);
    if (role === "guardian") entry.isGuardian = true;
    if (role === "teacher" || role === "staff" || role === "counselor") entry.isStaff = true;
    if (role === "counselor") entry.isCounselor = true;
    map.set(school.id, entry);
  }

  const children = await db()
    .select({ id: people.id, name: people.name, identifier: people.identifier, schoolId: people.schoolId, classGroup: classGroups.name })
    .from(guardians)
    .innerJoin(guardianStudents, eq(guardianStudents.guardianId, guardians.id))
    .innerJoin(people, eq(people.id, guardianStudents.studentId))
    .leftJoin(classGroups, eq(classGroups.id, people.classGroupId))
    .where(eq(guardians.userId, user.id));

  return { user: { id: user.id, name: user.name, email: user.email, phone: user.phone }, schools: [...map.values()], children };
}

export async function monthCounts(personId: string, start: string, end: string) {
  const rows = await db().select().from(dailyAttendance).where(eq(dailyAttendance.personId, personId));
  const inRange = rows.filter((r) => r.date >= start && r.date <= end);
  const of = (s: string) => inRange.filter((r) => r.status === s).length;
  return { present: of("present"), late: of("late"), permit: of("permit"), sick: of("sick"), absent: of("absent"), days: inRange.sort((a, b) => b.date.localeCompare(a.date)) };
}
