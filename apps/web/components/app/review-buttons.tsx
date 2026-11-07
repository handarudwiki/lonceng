"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action";
import { Button } from "../ui";

export function ReviewButtons({ review }: { review: (approve: boolean) => Promise<ActionResult> }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const act = (approve: boolean) =>
    start(async () => {
      const result = await review(approve);
      setError(result.ok ? null : result.error);
    });
  return (
    <div className="flex items-center justify-end gap-2">
      {error && <span className="text-xs text-bad">{error}</span>}
      <Button small disabled={pending} onClick={() => act(true)}>
        Setujui
      </Button>
      <Button small tone="danger" disabled={pending} onClick={() => act(false)}>
        Tolak
      </Button>
    </div>
  );
}
