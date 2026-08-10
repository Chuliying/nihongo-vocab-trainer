"use client";

import { memo } from "react";
import { Check } from "lucide-react";
import type { VocabEntry } from "@/lib/types";
import { RelatedWords } from "@/components/RelatedWords";
import { VerbInfoPanel } from "@/components/VerbInfoPanel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function qualityLabel(score: string) {
  if (score === "verb_curated") return "動詞精修";
  if (score === "curated") return "精修";
  if (score === "rule_completed") return "已補齊";
  return "待檢查";
}

export const VocabCard = memo(function VocabCard({
  entry,
  isLearned,
  onToggleLearned,
  onRelatedSelect
}: {
  entry: VocabEntry;
  isLearned: boolean;
  onToggleLearned: (wordId: number) => void;
  onRelatedSelect: (targetId: number) => void;
}) {
  return (
    <Card
      id={`word-${entry.id}`}
      tabIndex={-1}
      data-vocab-id={entry.id}
      className={cn(
        "gap-0 p-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
        isLearned && "border-primary/40 bg-primary/[0.04]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={isLearned ? "default" : "outline"}>
            推估 {entry.jlpt_level}
          </Badge>
          <Badge variant={entry.quality_score === "verb_curated" ? "default" : "secondary"}>
            {qualityLabel(entry.quality_score)}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => onToggleLearned(entry.id)}
          aria-label={isLearned ? "取消已學會" : "標記已學會"}
          title={isLearned ? "取消已學會" : "標記已學會"}
          className={cn(
            "flex size-8 items-center justify-center rounded-full border transition-colors",
            isLearned
              ? "border-primary bg-primary text-primary-foreground shadow-[0_0_16px_-4px_var(--glow)]"
              : "border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
          )}
        >
          <Check className="size-4" />
        </button>
      </div>

      <h2 className="mt-3 font-serif text-3xl leading-tight font-semibold">
        {entry.word}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {entry.reading} · {entry.part_of_speech}
      </p>
      <p className="mt-3 font-medium text-primary">{entry.meaning}</p>

      <details className="group mt-4 border-t border-border/60 pt-3">
        <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground select-none">
          <span>例句・變化・相關詞</span>
          <span className="font-display transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="mt-3 space-y-4">
          <blockquote className="space-y-1 border-l-2 border-primary/40 pl-3">
            <p className="font-serif leading-relaxed">
              {entry.example.japanese}
            </p>
            <p className="text-xs text-muted-foreground">
              {entry.example.reading}
            </p>
            <p className="text-sm text-foreground/80">
              {entry.example.chinese}
            </p>
          </blockquote>
          <VerbInfoPanel verbInfo={entry.verb_info} />
          <RelatedWords related={entry.related} onSelect={onRelatedSelect} />
        </div>
      </details>
    </Card>
  );
});
