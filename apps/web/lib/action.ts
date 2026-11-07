import { DomainError } from "@lonceng/core";
import { z } from "zod";

export type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

const UNIQUE_MESSAGES: Record<string, string> = {
  people_identifier: "NIS/NIP sudah dipakai",
  people_card: "UID kartu sudah dipakai orang lain",
  departments_code: "Kode jurusan sudah ada",
  subjects_code: "Kode mapel sudah ada",
  grades_name: "Nama tingkat sudah ada",
  class_groups_name: "Nama rombel sudah ada di tahun ajaran ini",
  academic_years_name: "Tahun ajaran sudah ada",
  holidays_date: "Tanggal tersebut sudah terdaftar",
  lesson_periods_slot: "Jam ke- tersebut sudah ada di hari itu",
  roster_class_slot: "Rombel sudah punya pelajaran di jam ini",
  roster_teacher_slot: "Guru sudah mengajar rombel lain di jam ini",
  discipline_types_name: "Jenis tersebut sudah ada",
  users_email_unique: "Email sudah dipakai",
  users_phone_unique: "Nomor HP sudah dipakai",
};

/** Turns expected failures into a message for the form; anything else stays a real error. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    if (error instanceof z.ZodError) return { ok: false, error: error.issues[0]?.message ?? "Data tidak valid" };
    const pg = pgError(error);
    if (pg?.code === "23505") return { ok: false, error: UNIQUE_MESSAGES[pg.constraint ?? ""] ?? "Data sudah ada" };
    if (pg?.code === "23503") return { ok: false, error: "Data masih dipakai sehingga tidak bisa dihapus" };
    throw error;
  }
}

/** Drizzle wraps the driver error in `cause`. */
function pgError(error: unknown): { code?: string; constraint?: string } | null {
  let current = error as { code?: string; constraint?: string; cause?: unknown } | undefined;
  while (current) {
    if (typeof current.code === "string") return current;
    current = current.cause as typeof current;
  }
  return null;
}

export const formObject = (form: FormData) =>
  Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
