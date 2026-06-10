"use client";

import { useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  max: number;
  onChange: (newIndex: number) => void;
  label?: string;
  className?: string;
};

export function DraggableProgress({ value, max, onChange, label, className }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const pct = max > 1 ? (value / (max - 1)) * 100 : 0;

  const indexFromPointer = useCallback(
    (clientX: number): number => {
      const track = trackRef.current;
      if (!track || max <= 1) return 0;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * (max - 1));
    },
    [max]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      onChange(indexFromPointer(e.clientX));
    },
    [indexFromPointer, onChange]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current) return;
      onChange(indexFromPointer(e.clientX));
    },
    [indexFromPointer, onChange]
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between">
        {label ? (
          <span className="font-display text-[0.65rem] tracking-wide text-muted-foreground">
            {label}
          </span>
        ) : (
          <span />
        )}
        <span className="font-display text-xs tabular-nums text-muted-foreground">
          <span className="text-primary">{value + 1}</span>
          <span> / {max}</span>
        </span>
      </div>

      <div
        ref={trackRef}
        role="slider"
        aria-valuemin={0}
        aria-valuemax={max - 1}
        aria-valuenow={value}
        tabIndex={0}
        className="relative h-2 cursor-pointer touch-none rounded-full bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") onChange(Math.min(max - 1, value + 1));
          if (e.key === "ArrowLeft") onChange(Math.max(0, value - 1));
        }}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-primary"
          style={{ width: `${pct}%` }}
        />
        <div
          className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-card shadow-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}
