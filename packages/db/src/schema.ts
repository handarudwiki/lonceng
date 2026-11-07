import { relations, sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const schoolId = () =>
  uuid("school_id")
    .notNull()
    .references(() => schools.id, { onDelete: "cascade" });

export const roleEnum = pgEnum("role", [
  "foundation_admin",
  "admin",
  "principal",
  "teacher",
  "counselor",
  "treasurer",
  "staff",
  "guardian",
]);
export const personTypeEnum = pgEnum("person_type", ["student", "teacher", "staff"]);
export const attendanceStatusEnum = pgEnum("attendance_status", ["present", "late", "permit", "sick", "absent"]);
export const checkoutStatusEnum = pgEnum("checkout_status", ["left", "left_early"]);
export const scanMethodEnum = pgEnum("scan_method", ["qr", "rfid", "nfc", "manual", "system"]);
export const lessonStatusEnum = pgEnum("lesson_status", ["present", "permit", "sick", "absent"]);
export const leaveTypeEnum = pgEnum("leave_type", ["permit", "sick", "leave"]);
export const reviewStatusEnum = pgEnum("review_status", ["pending", "approved", "rejected"]);
export const disciplineKindEnum = pgEnum("discipline_kind", ["violation", "award"]);
export const audienceEnum = pgEnum("audience", ["all", "teachers", "guardians", "class_group"]);
export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "yearly"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["pending", "paid", "expired", "failed"]);
export const schoolStatusEnum = pgEnum("school_status", ["active", "suspended"]);

// ---------- Identity ----------

export const users = pgTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").unique(),
  phone: text("phone").unique(),
  passwordHash: text("password_hash"),
  isSuperAdmin: boolean("is_super_admin").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  emailVerifiedAt: ts("email_verified_at"),
  lastLoginAt: ts("last_login_at"),
  createdAt: createdAt(),
});

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: ts("expires_at").notNull(),
    revokedAt: ts("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [index("refresh_tokens_user_idx").on(t.userId)],
);

export const otpPurposeEnum = pgEnum("otp_purpose", ["activate", "verify_email"]);

export const otpCodes = pgTable(
  "otp_codes",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: otpPurposeEnum("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    expiresAt: ts("expires_at").notNull(),
    consumedAt: ts("consumed_at"),
    createdAt: createdAt(),
  },
  (t) => [index("otp_user_idx").on(t.userId, t.purpose)],
);

export const foundations = pgTable("foundations", {
  id: id(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const schools = pgTable("schools", {
  id: id(),
  foundationId: uuid("foundation_id").references(() => foundations.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  npsn: text("npsn").unique(),
  level: text("level").notNull(),
  address: text("address"),
  city: text("city"),
  province: text("province"),
  phone: text("phone"),
  logoPath: text("logo_path"),
  timezone: text("timezone").notNull().default("Asia/Jakarta"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  geofenceRadiusM: integer("geofence_radius_m").notNull().default(100),
  /** ISO weekdays, 1 = Senin ... 7 = Minggu (WA-JD-01). */
  effectiveDays: smallint("effective_days").array().notNull().default(sql`'{1,2,3,4,5}'::smallint[]`),
  scanCooldownMinutes: smallint("scan_cooldown_minutes").notNull().default(5),
  lessonToleranceMinutes: smallint("lesson_tolerance_minutes").notNull().default(15),
  allowScanOnHolidays: boolean("allow_scan_on_holidays").notNull().default(false),
  listedPublicly: boolean("listed_publicly").notNull().default(false),
  referralCode: text("referral_code"),
  status: schoolStatusEnum("status").notNull().default("active"),
  onboardedAt: ts("onboarded_at"),
  lastActivityAt: ts("last_activity_at"),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    schoolId: schoolId(),
    role: roleEnum("role").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("memberships_unique").on(t.userId, t.schoolId, t.role), index("memberships_school_idx").on(t.schoolId)],
);

// ---------- Academic master data ----------

export const academicYears = pgTable(
  "academic_years",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    semester: smallint("semester").notNull().default(1),
    isActive: boolean("is_active").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("academic_years_name").on(t.schoolId, t.name),
    uniqueIndex("academic_years_one_active").on(t.schoolId).where(sql`${t.isActive}`),
  ],
);

export const departments = pgTable(
  "departments",
  { id: id(), schoolId: schoolId(), code: text("code").notNull(), name: text("name").notNull() },
  (t) => [uniqueIndex("departments_code").on(t.schoolId, t.code)],
);

export const grades = pgTable(
  "grades",
  { id: id(), schoolId: schoolId(), name: text("name").notNull(), sortOrder: smallint("sort_order").notNull().default(0) },
  (t) => [uniqueIndex("grades_name").on(t.schoolId, t.name)],
);

export const subjects = pgTable(
  "subjects",
  { id: id(), schoolId: schoolId(), code: text("code").notNull(), name: text("name").notNull() },
  (t) => [uniqueIndex("subjects_code").on(t.schoolId, t.code)],
);

/** Students, teachers and staff share one table: attendance, QR and leave treat them alike. */
export const people = pgTable(
  "people",
  {
    id: id(),
    schoolId: schoolId(),
    type: personTypeEnum("type").notNull(),
    name: text("name").notNull(),
    /** NIS for students, NIP/NIK for staff. */
    identifier: text("identifier"),
    gender: text("gender"),
    birthDate: date("birth_date"),
    phone: text("phone"),
    photoPath: text("photo_path"),
    qrCode: text("qr_code").notNull(),
    cardUid: text("card_uid"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    classGroupId: uuid("class_group_id"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("people_school_type_idx").on(t.schoolId, t.type),
    index("people_class_idx").on(t.classGroupId),
    uniqueIndex("people_qr").on(t.qrCode),
    uniqueIndex("people_card").on(t.schoolId, t.cardUid),
    uniqueIndex("people_identifier").on(t.schoolId, t.type, t.identifier),
    uniqueIndex("people_user").on(t.schoolId, t.userId),
  ],
);

export const classGroups = pgTable(
  "class_groups",
  {
    id: id(),
    schoolId: schoolId(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    gradeId: uuid("grade_id")
      .notNull()
      .references(() => grades.id, { onDelete: "restrict" }),
    departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    homeroomTeacherId: uuid("homeroom_teacher_id").references(() => people.id, { onDelete: "set null" }),
  },
  (t) => [uniqueIndex("class_groups_name").on(t.academicYearId, t.name)],
);

export const guardians = pgTable(
  "guardians",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("guardians_school_idx").on(t.schoolId), index("guardians_user_idx").on(t.userId)],
);

export const guardianStudents = pgTable(
  "guardian_students",
  {
    guardianId: uuid("guardian_id")
      .notNull()
      .references(() => guardians.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    relation: text("relation").notNull().default("Wali"),
  },
  (t) => [primaryKey({ columns: [t.guardianId, t.studentId] }), index("guardian_students_student").on(t.studentId)],
);

// ---------- Scheduling ----------

export const holidays = pgTable(
  "holidays",
  {
    id: id(),
    schoolId: schoolId(),
    date: date("date").notNull(),
    name: text("name").notNull(),
    isNational: boolean("is_national").notNull().default(false),
  },
  (t) => [uniqueIndex("holidays_date").on(t.schoolId, t.date)],
);

export const lessonPeriods = pgTable(
  "lesson_periods",
  {
    id: id(),
    schoolId: schoolId(),
    dayOfWeek: smallint("day_of_week").notNull(),
    number: smallint("number").notNull(),
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
    isBreak: boolean("is_break").notNull().default(false),
  },
  (t) => [uniqueIndex("lesson_periods_slot").on(t.schoolId, t.dayOfWeek, t.number)],
);

export const attendanceRules = pgTable(
  "attendance_rules",
  {
    id: id(),
    schoolId: schoolId(),
    personType: personTypeEnum("person_type").notNull(),
    openAt: time("open_at").notNull(),
    lateAfter: time("late_after").notNull(),
    closeAt: time("close_at").notNull(),
    checkoutAt: time("checkout_at").notNull(),
  },
  (t) => [uniqueIndex("attendance_rules_group").on(t.schoolId, t.personType)],
);

export const rosterEntries = pgTable(
  "roster_entries",
  {
    id: id(),
    schoolId: schoolId(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "cascade" }),
    semester: smallint("semester").notNull(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    lessonPeriodId: uuid("lesson_period_id")
      .notNull()
      .references(() => lessonPeriods.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => subjects.id, { onDelete: "restrict" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
  },
  (t) => [
    // The database is the final word on conflicts (WA-JD-04), even under concurrent edits.
    uniqueIndex("roster_class_slot").on(t.academicYearId, t.semester, t.classGroupId, t.lessonPeriodId),
    uniqueIndex("roster_teacher_slot").on(t.academicYearId, t.semester, t.teacherId, t.lessonPeriodId),
  ],
);

// ---------- Attendance ----------

export const scannerDevices = pgTable(
  "scanner_devices",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    pairingCode: text("pairing_code"),
    pairingExpiresAt: ts("pairing_expires_at"),
    tokenHash: text("token_hash").unique(),
    pairedAt: ts("paired_at"),
    revokedAt: ts("revoked_at"),
    lastSeenAt: ts("last_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [index("scanner_devices_school").on(t.schoolId), uniqueIndex("scanner_pairing").on(t.pairingCode)],
);

export const dailyAttendance = pgTable(
  "daily_attendance",
  {
    id: id(),
    schoolId: schoolId(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** Local school date, so a day never straddles two UTC dates. */
    date: date("date").notNull(),
    academicYearId: uuid("academic_year_id")
      .notNull()
      .references(() => academicYears.id, { onDelete: "restrict" }),
    semester: smallint("semester").notNull(),
    classGroupId: uuid("class_group_id"),
    status: attendanceStatusEnum("status").notNull(),
    checkInAt: ts("check_in_at"),
    checkOutAt: ts("check_out_at"),
    checkoutStatus: checkoutStatusEnum("checkout_status"),
    lateMinutes: integer("late_minutes").notNull().default(0),
    method: scanMethodEnum("method").notNull(),
    deviceId: uuid("device_id").references(() => scannerDevices.id, { onDelete: "set null" }),
    leaveRequestId: uuid("leave_request_id"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("daily_attendance_person_date").on(t.personId, t.date),
    index("daily_attendance_school_date").on(t.schoolId, t.date),
    index("daily_attendance_class_date").on(t.classGroupId, t.date),
  ],
);

export const lessonSessions = pgTable(
  "lesson_sessions",
  {
    id: id(),
    schoolId: schoolId(),
    rosterEntryId: uuid("roster_entry_id")
      .notNull()
      .references(() => rosterEntries.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    openedAt: ts("opened_at").notNull().defaultNow(),
    submittedAt: ts("submitted_at"),
  },
  (t) => [
    uniqueIndex("lesson_sessions_entry_date").on(t.rosterEntryId, t.date),
    index("lesson_sessions_school_date").on(t.schoolId, t.date),
  ],
);

export const lessonAttendance = pgTable(
  "lesson_attendance",
  {
    id: id(),
    schoolId: schoolId(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => lessonSessions.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    status: lessonStatusEnum("status").notNull(),
    method: scanMethodEnum("method").notNull().default("manual"),
    leaveRequestId: uuid("leave_request_id"),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("lesson_attendance_unique").on(t.sessionId, t.studentId),
    index("lesson_attendance_student").on(t.studentId),
  ],
);

export const leaveRequests = pgTable(
  "leave_requests",
  {
    id: id(),
    schoolId: schoolId(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    type: leaveTypeEnum("type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    reason: text("reason").notNull(),
    attachmentPath: text("attachment_path"),
    status: reviewStatusEnum("status").notNull().default("pending"),
    requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (t) => [index("leave_school_status").on(t.schoolId, t.status), index("leave_person").on(t.personId, t.startDate)],
);

// ---------- Discipline ----------

export const disciplineTypes = pgTable(
  "discipline_types",
  {
    id: id(),
    schoolId: schoolId(),
    kind: disciplineKindEnum("kind").notNull(),
    category: text("category").notNull(),
    name: text("name").notNull(),
    points: integer("points").notNull(),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [uniqueIndex("discipline_types_name").on(t.schoolId, t.kind, t.name)],
);

export const disciplineRecords = pgTable(
  "discipline_records",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    typeId: uuid("type_id")
      .notNull()
      .references(() => disciplineTypes.id, { onDelete: "restrict" }),
    /** Snapshot: renaming or re-pointing a type must not rewrite history. */
    points: integer("points").notNull(),
    note: text("note"),
    photoPath: text("photo_path"),
    occurredOn: date("occurred_on").notNull(),
    status: reviewStatusEnum("status").notNull().default("pending"),
    reportedBy: uuid("reported_by").references(() => users.id, { onDelete: "set null" }),
    reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewedAt: ts("reviewed_at"),
    reviewNote: text("review_note"),
    createdAt: createdAt(),
  },
  (t) => [index("discipline_school_status").on(t.schoolId, t.status), index("discipline_student").on(t.studentId)],
);

// ---------- Communication ----------

export const announcements = pgTable(
  "announcements",
  {
    id: id(),
    schoolId: schoolId(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    attachmentPath: text("attachment_path"),
    audience: audienceEnum("audience").notNull(),
    classGroupId: uuid("class_group_id").references(() => classGroups.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("announcements_school").on(t.schoolId, t.createdAt)],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    schoolId: schoolId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    data: jsonb("data").$type<Record<string, string>>().notNull().default({}),
    /** One notification per event per user (BR-11). */
    dedupeKey: text("dedupe_key").notNull(),
    readAt: ts("read_at"),
    pushedAt: ts("pushed_at"),
    pushAttempts: smallint("push_attempts").notNull().default(0),
    pushError: text("push_error"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("notifications_dedupe").on(t.userId, t.dedupeKey),
    index("notifications_user").on(t.userId, t.createdAt),
    index("notifications_outbox").on(t.createdAt).where(sql`${t.pushedAt} is null`),
  ],
);

export const pushTokens = pgTable(
  "push_tokens",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    platform: text("platform").notNull(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [index("push_tokens_user").on(t.userId)],
);

// ---------- Billing ----------

export type PlanQuotas = {
  dailyScan: number | null;
  lessonScan: number | null;
  extracurricularScan: number | null;
  internshipScan: number | null;
  journal: number | null;
  violation: number | null;
  award: number | null;
  devices: number | null;
};
export type PlanFeatures = {
  monitoring: boolean;
  alphaReminder: boolean;
  affiliate: boolean;
  finance: boolean;
  admission: boolean;
  substituteNotification: boolean;
};

export const plans = pgTable("plans", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  monthlyPrice: bigint("monthly_price", { mode: "number" }).notNull(),
  quotas: jsonb("quotas").$type<PlanQuotas>().notNull(),
  features: jsonb("features").$type<PlanFeatures>().notNull(),
  sortOrder: smallint("sort_order").notNull(),
  isActive: boolean("is_active").notNull().default(true),
});

export const subscriptions = pgTable("subscriptions", {
  schoolId: uuid("school_id")
    .primaryKey()
    .references(() => schools.id, { onDelete: "cascade" }),
  planCode: text("plan_code")
    .notNull()
    .references(() => plans.code),
  cycle: billingCycleEnum("cycle"),
  startedAt: ts("started_at").notNull().defaultNow(),
  /** Null for Free, which never expires. */
  expiresAt: ts("expires_at"),
  overrideQuotas: jsonb("override_quotas").$type<Partial<PlanQuotas>>(),
  overrideFeatures: jsonb("override_features").$type<Partial<PlanFeatures>>(),
  overrideNote: text("override_note"),
  overrideExpiresAt: ts("override_expires_at"),
  lastReminderDays: smallint("last_reminder_days"),
});

export const quotaUsage = pgTable(
  "quota_usage",
  {
    schoolId: schoolId(),
    metric: text("metric").notNull(),
    /** YYYY-MM-DD for daily quotas, YYYY-MM for monthly ones. */
    period: text("period").notNull(),
    used: integer("used").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.schoolId, t.metric, t.period] })],
);

export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    schoolId: schoolId(),
    number: text("number").notNull().unique(),
    planCode: text("plan_code")
      .notNull()
      .references(() => plans.code),
    cycle: billingCycleEnum("cycle").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    billedToName: text("billed_to_name").notNull(),
    status: invoiceStatusEnum("status").notNull().default("pending"),
    gateway: text("gateway").notNull(),
    gatewayRef: text("gateway_ref"),
    paymentUrl: text("payment_url"),
    paidAt: ts("paid_at"),
    createdAt: createdAt(),
  },
  (t) => [index("invoices_school").on(t.schoolId, t.createdAt)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    schoolId: uuid("school_id").references(() => schools.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    reason: text("reason"),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_school").on(t.schoolId, t.createdAt)],
);

export const personRelations = relations(people, ({ one }) => ({
  classGroup: one(classGroups, { fields: [people.classGroupId], references: [classGroups.id] }),
}));
