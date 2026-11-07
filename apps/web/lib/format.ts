export const rupiah = (value: number) => `Rp ${value.toLocaleString("id-ID")}`;

export const formatDate = (date: string | Date, timezone = "Asia/Jakarta", style: "long" | "medium" = "medium") =>
  new Intl.DateTimeFormat("id-ID", {
    timeZone: typeof date === "string" ? "UTC" : timezone,
    dateStyle: style === "long" ? "full" : "medium",
  }).format(typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date);

export const formatTime = (date: Date | null, timezone: string) =>
  date ? new Intl.DateTimeFormat("id-ID", { timeZone: timezone, timeStyle: "short" }).format(date).replace(".", ":") : "-";

export const DAY_NAMES = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

export const STATUS_LABELS = { present: "Hadir", late: "Terlambat", permit: "Izin", sick: "Sakit", absent: "Alpha" } as const;
export const STATUS_TONES = { present: "good", late: "warn", permit: "info", sick: "info", absent: "bad" } as const;
