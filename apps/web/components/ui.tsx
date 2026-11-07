import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6", className)} {...props} />;
}

type ButtonTone = "primary" | "secondary" | "danger" | "ghost";

export const buttonClass = (tone: ButtonTone = "primary", small = false) =>
  cx(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
    small ? "h-9 px-3 text-sm" : "h-11 px-4 text-sm",
    tone === "primary" && "bg-brand text-brand-ink hover:brightness-110",
    tone === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
    tone === "danger" && "bg-bad-soft text-bad hover:brightness-95",
    tone === "ghost" && "text-ink-2 hover:bg-surface-2",
  );

export function Button({ tone, small, className, ...props }: ComponentProps<"button"> & { tone?: ButtonTone; small?: boolean }) {
  return <button className={cx(buttonClass(tone, small), className)} {...props} />;
}

const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-3 focus:border-brand focus:outline-2 focus:outline-brand/30";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "h-auto min-h-24 py-2", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, className)} {...props} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
  brand: "bg-brand-soft text-brand-text",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone])}>{children}</span>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon: LucideIcon;
  tone?: Tone;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-semibold text-ink-2">{label}</span>
        <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", TONES[tone])}>
          <Icon size={20} aria-hidden />
        </span>
      </div>
      <div className="mt-3 text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-sm text-ink-3">{sub}</div>}
    </Card>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      {hint && <p className="mt-1 text-sm text-ink-2">{hint}</p>}
    </div>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[560px] text-left text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-5 [&_td]:py-3 sm:[&_td]:px-6 [&_th]:px-5 [&_th]:pb-3 [&_th]:text-xs [&_th]:font-semibold [&_th]:tracking-wide [&_th]:text-ink-3 [&_th]:uppercase sm:[&_th]:px-6">
        {children}
      </table>
    </div>
  );
}

export function Alert({ tone = "warn", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-xl px-4 py-3 text-sm font-medium", TONES[tone])}>{children}</div>;
}
