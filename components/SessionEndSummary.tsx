import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  totalSeen: number;
  learnedThisSession: number;
  onRestart: () => void;
  onBackToList: () => void;
};

export function SessionEndSummary({
  totalSeen,
  learnedThisSession,
  onRestart,
  onBackToList,
}: Props) {
  const pct =
    totalSeen > 0 ? Math.round((learnedThisSession / totalSeen) * 100) : 0;

  return (
    <div className="flex h-[clamp(22rem,60svh,34rem)] w-full flex-col items-center justify-center gap-6 rounded-3xl border border-primary/25 bg-card px-8 text-center shadow-[0_30px_80px_-30px_var(--glow)]">
      <p className="font-display text-xs tracking-[0.18em] text-muted-foreground uppercase">
        本次練習完成
      </p>
      <div className="space-y-1">
        <p className="font-serif text-5xl font-semibold text-primary">
          {learnedThisSession}
        </p>
        <p className="text-sm text-muted-foreground">
          / {totalSeen} 張標記學會（{pct}%）
        </p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Button onClick={onRestart} variant="outline" className="w-full">
          <RotateCcw className="size-4" />
          重新開始本次練習
        </Button>
        <Button onClick={onBackToList} variant="ghost" className="w-full text-muted-foreground">
          <ArrowLeft className="size-4" />
          回到列表
        </Button>
      </div>
    </div>
  );
}
