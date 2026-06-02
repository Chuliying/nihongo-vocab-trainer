"use client";

import type { Tranche } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TrancheSelector({
  tranches,
  selectedId,
  learnedCounts,
  onSelect
}: {
  tranches: Tranche[];
  selectedId: number;
  learnedCounts: Record<number, number>;
  onSelect: (id: number) => void;
}) {
  return (
    <nav aria-label="Tranche 分類" className="-mx-4">
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-4 pb-1">
        {tranches.map((tranche) => {
          const learned = learnedCounts[tranche.id] ?? 0;
          const pct = Math.min(100, Math.round((learned / 1000) * 100));
          const isActive = tranche.id === selectedId;
          return (
            <button
              key={tranche.id}
              type="button"
              onClick={() => onSelect(tranche.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "flex w-36 shrink-0 flex-col gap-2 rounded-2xl border p-3.5 text-left transition-colors",
                isActive
                  ? "border-primary/50 bg-primary/10"
                  : "border-border/70 bg-card/40 hover:border-border"
              )}
            >
              <span
                className={cn(
                  "font-serif text-lg font-semibold leading-none",
                  isActive ? "text-primary" : "text-foreground"
                )}
              >
                {tranche.title}
              </span>
              <span className="font-display text-[0.65rem] tracking-wide text-muted-foreground uppercase">
                {tranche.rank_range}
              </span>
              <span className="mt-1 h-1 w-full overflow-hidden rounded-full bg-foreground/10">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </span>
              <span className="font-display text-[0.7rem] tabular-nums text-muted-foreground">
                {learned} / 1000
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
