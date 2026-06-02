"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RotateCcw, Search, Sparkles, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { TrancheSelector } from "@/components/TrancheSelector";
import { VocabCard } from "@/components/VocabCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { track } from "@vercel/analytics";
import { useStudyProgress } from "@/lib/storage";
import {
  filterVocab,
  findRelatedTarget,
  getJlptOptions,
  getPartOfSpeechOptions
} from "@/lib/vocab";
import type { PopularVerb, Tranche, VocabEntry } from "@/lib/types";

const PAGE_SIZE = 24;
type LibraryMode = "tranche" | "popular-verbs";

export function LibraryPage({
  popularVerbs,
  tranches,
  vocab
}: {
  popularVerbs: PopularVerb[];
  tranches: Tranche[];
  vocab: VocabEntry[];
}) {
  const { progress, setProgress, toggleLearned, resetProgress } =
    useStudyProgress();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("tranche");

  const selectedTrancheId = progress.selectedTrancheId || 1;
  const selectedJlpt = progress.selectedJlpt || "全部";
  const selectedPart = progress.selectedPartOfSpeech || "全部";

  const jlptOptions = useMemo(() => getJlptOptions(vocab), [vocab]);
  const partOptions = useMemo(() => getPartOfSpeechOptions(vocab), [vocab]);

  const learnedCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    const learned = new Set(progress.learnedWordIds);
    vocab.forEach((entry) => {
      if (learned.has(entry.id)) {
        counts[entry.tranche_id] = (counts[entry.tranche_id] ?? 0) + 1;
      }
    });
    return counts;
  }, [progress.learnedWordIds, vocab]);

  const popularVerbIds = useMemo(
    () => new Set(popularVerbs.map((verb) => verb.id)),
    [popularVerbs]
  );
  const popularVerbLearned = useMemo(
    () =>
      popularVerbs.filter((verb) => progress.learnedWordIds.includes(verb.id))
        .length,
    [popularVerbs, progress.learnedWordIds]
  );

  const filtered = useMemo(() => {
    if (libraryMode === "popular-verbs") {
      const queryText = query.trim().toLowerCase();
      return vocab
        .filter((entry) => popularVerbIds.has(entry.id))
        .filter((entry) => {
          const haystack =
            `${entry.word} ${entry.reading} ${entry.meaning} ${entry.example.chinese}`.toLowerCase();
          return !queryText || haystack.includes(queryText);
        })
        .sort((a, b) => a.frequency_rank - b.frequency_rank);
    }
    return filterVocab(vocab, {
        query,
        trancheId: selectedTrancheId,
        jlpt: selectedJlpt,
        partOfSpeech: selectedPart
      });
  }, [
    libraryMode,
    popularVerbIds,
    query,
    selectedJlpt,
    selectedPart,
    selectedTrancheId,
    vocab
  ]);

  const visible = filtered.slice(0, visibleCount);
  const selectedTranche =
    tranches.find((item) => item.id === selectedTrancheId) ?? tranches[0];
  const learnedHere = learnedCounts[selectedTrancheId] ?? 0;
  const activeFilters =
    (selectedJlpt !== "全部" ? 1 : 0) +
    (selectedPart !== "全部" ? 1 : 0) +
    (libraryMode === "popular-verbs" ? 1 : 0);

  function setTranche(id: number) {
    track("tranche_selected", { tranche: id, source: "library" });
    setLibraryMode("tranche");
    setProgress({ selectedTrancheId: id, currentPracticeIndex: 0 });
    setVisibleCount(PAGE_SIZE);
  }

  function handleToggleLearned(wordId: number) {
    if (!progress.learnedWordIds.includes(wordId)) {
      const entry = vocab.find((item) => item.id === wordId);
      if (entry) {
        track("word_learned", {
          word: entry.word,
          jlpt: entry.jlpt_level,
          tranche: entry.tranche_id,
          source: libraryMode === "popular-verbs" ? "popular_verbs" : "library"
        });
      }
    }
    toggleLearned(wordId);
  }

  function selectRelated(targetId: number) {
    const target = findRelatedTarget(vocab, targetId);
    if (!target) return;
    setProgress({ selectedTrancheId: target.tranche_id });
    setQuery(target.word);
    setVisibleCount(PAGE_SIZE);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`word-${target.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  return (
    <AppShell>
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-5">
        {/* Tranche scroller */}
        <p className="font-display text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
          Tranches
        </p>
        <div className="mt-2.5">
          <TrancheSelector
            tranches={tranches}
            selectedId={selectedTrancheId}
            learnedCounts={learnedCounts}
            onSelect={setTranche}
          />
        </div>

        {/* Header */}
        <header className="mt-6">
          <p className="font-display text-xs italic text-muted-foreground">
            {libraryMode === "popular-verbs"
              ? "Top 300 verbs"
              : selectedTranche.rank_range}
          </p>
          <h1 className="mt-1 font-serif text-2xl font-semibold sm:text-3xl">
            {libraryMode === "popular-verbs"
              ? "常用動詞 300"
              : `${selectedTranche.title} · ${selectedTranche.label}`}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {libraryMode === "popular-verbs"
              ? "從 10,000 詞庫中依 JMdict priority-derived rank 抽出的前 300 個常用動詞，含動詞變化 info。"
              : selectedTranche.description}
          </p>

          <div className="mt-4 flex items-center gap-3">
            <Progress
              value={
                libraryMode === "popular-verbs"
                  ? Math.min(100, (popularVerbLearned / 300) * 100)
                  : Math.min(100, (learnedHere / 1000) * 100)
              }
              className="max-w-xs"
            />
            <span className="font-display text-xs tabular-nums whitespace-nowrap text-muted-foreground">
              {libraryMode === "popular-verbs"
                ? `${popularVerbLearned} / 300 學會`
                : `${learnedHere} / 1000 學會`}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="w-full sm:w-auto">
              <Link href={`/practice?tranche=${selectedTrancheId}`}>
                <Sparkles className="size-4" /> 開始練習
              </Link>
            </Button>
            <Button
              type="button"
              variant={libraryMode === "popular-verbs" ? "default" : "outline"}
              className="w-full sm:w-auto"
              onClick={() => {
                if (libraryMode !== "popular-verbs") {
                  track("popular_verbs_opened");
                }
                setLibraryMode((mode) =>
                  mode === "popular-verbs" ? "tranche" : "popular-verbs"
                );
                setVisibleCount(PAGE_SIZE);
                setQuery("");
              }}
            >
              <Sparkles className="size-4" />
              {libraryMode === "popular-verbs"
                ? "回到分層詞庫"
                : "常用動詞 300"}
            </Button>
          </div>
        </header>

        {/* Search + filter */}
        <div className="mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              placeholder="搜尋單字、假名、釋義"
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="pl-11"
            />
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative size-12 shrink-0 rounded-2xl"
                aria-label="篩選"
              >
                <SlidersHorizontal className="size-4" />
                {activeFilters > 0 ? (
                  <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
                    {activeFilters}
                  </span>
                ) : null}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mx-auto max-w-md pb-8">
              <SheetHeader>
                <SheetTitle>篩選</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-5">
                <div className="space-y-2">
                  <Label>推估等級</Label>
                  <Select
                    value={selectedJlpt}
                    onValueChange={(value) => {
                      setProgress({ selectedJlpt: value });
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {jlptOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>詞性</Label>
                  <Select
                    value={selectedPart}
                    onValueChange={(value) => {
                      setProgress({ selectedPartOfSpeech: value });
                      setVisibleCount(PAGE_SIZE);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {partOptions.map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={resetProgress}
                >
                  <RotateCcw className="size-4" /> 重設進度
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <p className="mt-4 font-display text-xs tracking-wide text-muted-foreground">
          {filtered.length} 個單字
          {activeFilters > 0 ? (
            <span className="ml-2 inline-flex gap-1.5 align-middle">
              {libraryMode === "popular-verbs" ? (
                <Badge variant="secondary">常用動詞300</Badge>
              ) : null}
              {selectedJlpt !== "全部" ? (
                <Badge variant="secondary">{selectedJlpt}</Badge>
              ) : null}
              {selectedPart !== "全部" ? (
                <Badge variant="secondary">{selectedPart}</Badge>
              ) : null}
            </span>
          ) : null}
        </p>

        {/* Grid */}
        {visible.length === 0 ? (
          <p className="mt-12 text-center text-muted-foreground">
            找不到符合條件的單字。
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((entry) => (
              <VocabCard
                key={entry.id}
                entry={entry}
                isLearned={progress.learnedWordIds.includes(entry.id)}
                onToggleLearned={handleToggleLearned}
                onRelatedSelect={selectRelated}
              />
            ))}
          </div>
        )}

        {visibleCount < filtered.length ? (
          <div className="mt-8 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              載入更多
            </Button>
          </div>
        ) : null}
      </main>
    </AppShell>
  );
}
