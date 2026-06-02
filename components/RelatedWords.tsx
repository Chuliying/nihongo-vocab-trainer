import type { RelatedWord } from "@/lib/types";

export function RelatedWords({
  related,
  onSelect
}: {
  related: RelatedWord[];
  onSelect?: (targetId: number) => void;
}) {
  if (related.length === 0) return null;

  return (
    <section aria-label="相關詞彙" className="space-y-2">
      <p className="font-display text-[0.7rem] tracking-[0.16em] text-muted-foreground uppercase">
        相關詞彙
      </p>
      <div className="flex flex-wrap gap-2">
        {related.map((item) => (
          <button
            key={`${item.word}-${item.reading}`}
            type="button"
            disabled={!item.target_id}
            onClick={() => item.target_id && onSelect?.(item.target_id)}
            className="flex flex-col items-start gap-0.5 rounded-xl border border-border/70 bg-background/40 px-3 py-2 text-left transition-colors enabled:hover:border-primary/50 enabled:hover:bg-primary/5 disabled:opacity-50"
          >
            <span className="font-serif text-sm font-medium">{item.word}</span>
            <span className="text-xs text-muted-foreground">
              {item.reading} · {item.meaning}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
