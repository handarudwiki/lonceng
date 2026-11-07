export const colors = {
  bg: "#f4f5fb",
  surface: "#ffffff",
  surface2: "#f6f7fc",
  border: "#e9ebf3",
  ink: "#171a2c",
  ink2: "#5c6178",
  ink3: "#8d92a8",
  brand: "#4f46e5",
  brandSoft: "#eceafd",
  brandText: "#4338ca",
  good: "#15803d",
  goodSoft: "#e3f6ea",
  warn: "#a16207",
  warnSoft: "#fdf3d7",
  bad: "#c62828",
  badSoft: "#fde8e8",
  info: "#1d6fc4",
  infoSoft: "#e3effb",
};

export type Tone = "neutral" | "good" | "warn" | "bad" | "info";

export const STATUS_TONE: Record<string, Tone> = { Hadir: "good", Terlambat: "warn", Izin: "info", Sakit: "info", Alpha: "bad" };

export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return `${MONTHS[m - 1]} ${y}`;
};

export const shiftMonth = (month: string, by: number) => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 7);
};

export const dateLabel = (date: string) => {
  const [y, m, d] = date.slice(0, 10).split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]!.slice(0, 3)} ${y}`;
};

/** The device's local date. `toISOString` would give yesterday before 07:00 WIB. */
export const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const shiftDate = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
