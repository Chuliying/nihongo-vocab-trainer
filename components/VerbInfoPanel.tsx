import type { VerbInfo } from "@/lib/types";

const rows: Array<[keyof VerbInfo, string]> = [
  ["verb_type", "類型"],
  ["dictionary_form", "辞書形"],
  ["masu_form", "ます形"],
  ["te_form", "て形"],
  ["ta_form", "た形"],
  ["nai_form", "ない形"],
  ["potential_form", "可能形"],
  ["passive_form", "受身形"],
  ["causative_form", "使役形"],
  ["imperative_form", "命令形"],
  ["conditional_form", "條件形"],
  ["volitional_form", "意向形"]
];

export function VerbInfoPanel({ verbInfo }: { verbInfo: VerbInfo | null }) {
  if (!verbInfo) return null;

  return (
    <details className="group rounded-2xl border border-border/70 bg-background/40">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium select-none">
        <span>動詞變化</span>
        <span className="font-display text-xs text-muted-foreground transition-transform group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border/60 px-4 pt-3 pb-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {rows.map(([key, label]) => (
            <div key={key} className="min-w-0">
              <dt className="text-[0.7rem] tracking-wide text-muted-foreground">
                {label}
              </dt>
              <dd className="mt-0.5 truncate font-medium">{verbInfo[key]}</dd>
            </div>
          ))}
        </dl>
        {verbInfo.notes ? (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {verbInfo.notes}
          </p>
        ) : null}
      </div>
    </details>
  );
}
