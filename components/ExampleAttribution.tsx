import type { VocabEntry } from "@/lib/types";

export function ExampleAttribution({ source }: { source: VocabEntry["source"] }) {
  const credit = source.attribution;
  if (!credit) return null;
  return (
    <footer className="pt-2 text-xs leading-relaxed text-muted-foreground">
      <a href={credit.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        Tatoeba #{credit.sentenceId}
      </a>
      {" · "}
      <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">
        CC BY 2.0 FR
      </a>
      {credit.contributors.length > 0 && <span className="block break-words">貢獻者：{credit.contributors.join("、")}</span>}
      {credit.ownerMissing && <span className="block">來源未提供句子署名。</span>}
      <span className="block">讀音與繁中翻譯經本專案整理。</span>
    </footer>
  );
}
