export type Role = "foundation_admin" | "admin" | "principal" | "teacher" | "counselor" | "treasurer" | "staff" | "guardian";

export const ROLE_LABELS: Record<Role, string> = {
  foundation_admin: "Admin Yayasan",
  admin: "Admin",
  principal: "Kepala Sekolah",
  teacher: "Guru",
  counselor: "Guru BK",
  treasurer: "Bendahara",
  staff: "Tendik",
  guardian: "Wali Murid",
};

const ADMIN: Role[] = ["foundation_admin", "admin"];
const WEB: Role[] = [...ADMIN, "principal", "teacher", "counselor", "treasurer"];

/** BRD section 4 access matrix, by capability rather than by page. */
export const PERMISSIONS = {
  webApp: WEB,
  viewMaster: [...ADMIN, "principal", "counselor", "treasurer"],
  manageMaster: ADMIN,
  viewAttendance: [...ADMIN, "principal", "counselor"],
  manageAttendance: ADMIN,
  viewMonitoring: [...ADMIN, "principal", "teacher", "counselor"],
  reviewStudentLeave: ADMIN,
  reviewStaffLeave: [...ADMIN, "principal"],
  viewDiscipline: [...ADMIN, "principal", "counselor"],
  reviewDiscipline: [...ADMIN, "counselor"],
  viewReports: [...ADMIN, "principal", "counselor"],
  manageAnnouncements: ADMIN,
  viewBilling: [...ADMIN, "principal"],
  manageSettings: ADMIN,
} satisfies Record<string, Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(roles: Role[], permission: Permission): boolean {
  const allowed: Role[] = PERMISSIONS[permission];
  return roles.some((r) => allowed.includes(r));
}
