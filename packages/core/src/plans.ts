import type { PlanFeatures, PlanQuotas } from "@lonceng/db";

const q = (
  dailyScan: number | null,
  lessonScan: number | null,
  extra: number | null,
  journal: number | null,
  discipline: number | null,
  devices: number | null,
): PlanQuotas => ({
  dailyScan,
  lessonScan,
  extracurricularScan: extra,
  internshipScan: extra,
  journal,
  violation: discipline,
  award: discipline,
  devices,
});

const f = (level: number): PlanFeatures => ({
  monitoring: level >= 1,
  alphaReminder: level >= 2,
  affiliate: level >= 2,
  finance: level >= 3,
  admission: level >= 4,
  substituteNotification: level >= 6,
});

/** BRD section 9. Back-office edits the database copy; this only seeds it. */
export const PLAN_SEED = [
  { code: "free", name: "Free", monthlyPrice: 0, sortOrder: 0, quotas: q(25, 25, 5, 0, 0, 0), features: f(0) },
  { code: "lite", name: "Lite", monthlyPrice: 49_000, sortOrder: 1, quotas: q(150, 300, 25, 75, 5, 0), features: f(1) },
  { code: "basic", name: "Basic", monthlyPrice: 99_000, sortOrder: 2, quotas: q(250, 500, 50, 100, 15, 2), features: f(2) },
  { code: "standard", name: "Standard", monthlyPrice: 185_000, sortOrder: 3, quotas: q(450, 900, 125, 175, 50, 3), features: f(3) },
  { code: "pro", name: "Pro", monthlyPrice: 285_000, sortOrder: 4, quotas: q(650, 1300, 225, 250, 150, 4), features: f(4) },
  { code: "premium", name: "Premium", monthlyPrice: 375_000, sortOrder: 5, quotas: q(850, 1700, 325, 350, 250, 5), features: f(5) },
  { code: "enterprise", name: "Enterprise", monthlyPrice: 455_000, sortOrder: 6, quotas: q(null, null, null, null, null, 10), features: f(6) },
];
