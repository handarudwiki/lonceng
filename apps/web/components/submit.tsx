"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./ui";

export function Submit({ children, className, tone }: { children: React.ReactNode; className?: string; tone?: "primary" | "secondary" | "danger" }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className={className} tone={tone}>
      {pending ? "Memproses..." : children}
    </Button>
  );
}
