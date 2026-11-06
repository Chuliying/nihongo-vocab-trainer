import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";

const DATA_SOURCES = [
  {
    name: "JMdict／EDRDG",
    note: "詞形、假名、詞性與英文字典釋義來自 Electronic Dictionary Research and Development Group 的 JMdict。本專案整理繁中詞義、例句與學習分層；衍生字典資料沿用 CC BY-SA 4.0。原始下載版本與日期未完整保存。",
    links: [
      { href: "https://www.edrdg.org/edrdg/licence.html", label: "EDRDG 授權說明" },
      { href: "https://creativecommons.org/licenses/by-sa/4.0/", label: "CC BY-SA 4.0" },
    ],
  },
  {
    name: "wordfreq／學習排序",
    note: "目前詞條排序使用 wordfreq 的日文詞頻資料，另有少量學習優先動詞。每 1,000 詞分為一層，共 13 層。這不是官方 JLPT 或 BCCWJ 排名，也不是即時詞頻。原套件版本與下載日期未完整保存。",
    links: [
      { href: "https://github.com/rspeer/wordfreq#license", label: "wordfreq 授權與來源" },
      { href: "https://creativecommons.org/licenses/by-sa/4.0/", label: "CC BY-SA 4.0" },
    ],
  },
  {
    name: "Tatoeba 例句與讀音",
    note: "部分日文例句與讀音取自 Tatoeba 社群。例句旁提供來源、貢獻者及授權連結；讀音與繁中翻譯經本專案整理。官方匯出未提供帳號的句子，不推測作者姓名。",
    links: [
      { href: "https://tatoeba.org/en/terms_of_use", label: "Tatoeba 使用條款" },
      { href: "https://creativecommons.org/licenses/by/2.0/fr/", label: "CC BY 2.0 FR" },
      { href: "/data/attribution/tatoeba.json", label: "句子與貢獻者對照資料" },
    ],
  },
  {
    name: "JLPT 推估標記",
    note: "N1–N5 是本專案依排序區間給出的學習提示，未經官方認證。請勿將這些標記當作官方分級或考試範圍。",
    links: [
      { href: "https://www.jlpt.jp/guideline/testsections.html", label: "JLPT 官方考試科目" },
    ],
  },
];

export default function SourcesPage() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-6">
        <h1 className="font-serif text-3xl font-semibold">資料來源與授權</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          詞庫包含 13,000 筆詞條，分成 13 層與 52 個資料區塊。詞義與例句尚未逐筆完成語意複核；
          已知不適合學習的例句會隱藏，未顯示不代表沒有這個用法。
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          「精修」「已補齊」是整理流程的標記，不是日語教師認證。遇到不確定的詞義或用法，請交叉查閱字典。
          學習進度只儲存在這個瀏覽器；清除網站資料會刪除進度。
        </p>
        <div className="mt-6 space-y-3">
          {DATA_SOURCES.map((source) => (
            <Card key={source.name} className="gap-0 p-5">
              <h2 className="font-serif text-lg font-semibold">{source.name}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{source.note}</p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                {source.links.map((link) => (
                  <a key={link.href} href={link.href} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-4">
                    {link.label}<ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
                  </a>
                ))}
              </div>
            </Card>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-block text-sm text-muted-foreground underline underline-offset-4">
          回到詞庫
        </Link>
      </main>
    </AppShell>
  );
}
