import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

const SOURCES = [
  {
    name: "JMdict / EDRDG",
    note: "用於單字、假名、詞性、priority tags 與字典釋義對照。需保留 EDRDG attribution 與 CC BY-SA 4.0 授權資訊。",
    href: "https://www.edrdg.org/edrdg/licence.html",
    label: "EDRDG licence"
  },
  {
    name: "Tranche / frequency layer",
    note: "目前 10 個 tranche 是產品內部分層：依 JMdict priority tags 排序後每 1,000 詞切一層。這不是 JLPT 官方層級，也不是 BCCWJ 官方排名。",
    href: "https://clrd.ninjal.ac.jp/bccwj/freq-list.html",
    label: "BCCWJ frequency list reference"
  },
  {
    name: "JLPT 等級標記",
    note: "JLPT 官方公開考試科目與題型，但現行 N1-N5 沒有公開官方單字表。本專案的 jlpt_level 目前是頻率區間推估，只能作為學習提示，不能視為官方分類。",
    href: "https://www.jlpt.jp/guideline/testsections.html",
    label: "JLPT official test sections"
  },
  {
    name: "Tatoeba / Tanaka Corpus",
    note: "優先用於日文例句與翻譯對照。缺少繁中翻譯時，會標記為待補齊或生成補齊。",
    href: "https://tatoeba.org/en/downloads",
    label: "Tatoeba downloads"
  },
  {
    name: "wordfreq",
    note: "作為詞頻備援資料來源，避免單一公開詞頻來源無法覆蓋完整 10,000 詞。",
    href: "https://pypi.org/project/wordfreq/",
    label: "wordfreq"
  }
];

export default function SourcesPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        <p className="font-display text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
          Sources
        </p>
        <h1 className="mt-2 font-serif text-3xl font-semibold">資料來源與授權</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          本專案規劃優先使用公開資料建立 10,000 筆常用日語單字資料。正式資料匯入後，
          此頁會列出資料版本、下載日期與每筆資料來源標記。
        </p>

        <div className="mt-6 space-y-3">
          {SOURCES.map((source) => (
            <Card key={source.name} className="gap-0 p-5">
              <h2 className="font-serif text-lg font-semibold">{source.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {source.note}
              </p>
              <a
                href={source.href}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary transition-opacity hover:opacity-80"
              >
                {source.label}
                <ArrowUpRight className="size-4" />
              </a>
            </Card>
          ))}
        </div>

        <Link
          href="/"
          className="mt-8 inline-block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          ← 回到詞庫
        </Link>
      </main>
    </AppShell>
  );
}
