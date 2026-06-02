"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
import { getJlptOptions, getPartOfSpeechOptions } from "@/lib/vocab";
import { fetchPopularVerbs, fetchTranche, fetchVocabIndex } from "@/lib/vocab-client";
import type { Tranche, VocabEntry } from "@/lib/types";

const PAGE_SIZE = 24;
type LibraryMode = "tranche" | "popular-verbs";

export function LibraryPage({ tranches }: { tranches: Tranche[] }) {
  const { progress, setProgress, toggleLearned, resetProgress } =
    useStudyProgress();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [libraryMode, setLibraryMode] = useState<LibraryMode>("tranche");

  const [vocabIndex, setVocabIndex] = useState<Record<number, number> | null>(null);
  const [trancheEntries, setTrancheEntries] = useState<VocabEntry[]>([]);
  const [trancheLoading, setTrancheLoading] = useState(true);
  const [popularEntries, setPopularEntries] = useState<VocabEntry[] | null>(null);
  const [popularLoading, setPopularLoading] = useState(false);

  const selectedTrancheId = progress.selectedTrancheId || 1;
  const selectedJlpt = progress.selectedJlpt || "全部";
  const selectedPart = progress.selectedPartOfSpeech || "全部";

  // id → tranche_id, for learned-count tallies + related-word navigation
  useEffect(() => {
    fetchVocabIndex().then(setVocabIndex).catch(() => setVocabIndex({}));
  }, []);

  // Load the selected tranche on demand
  useEffect(() => {
    let active = true;
    setTrancheLoading(true);
    fetchTranche(selectedTrancheId)
      .then((entries) => {
        if (active) setTrancheEntries(entries);
      })
      .finally(() => {
        if (active) setTrancheLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedTrancheId]);

  // Load popular verbs the first time that mode is opened
  useEffect(() => {
    if (libraryMode !== "popular-verbs" || popularEntries) return;
    setPopularLoading(true);
    fetchPopularVerbs()
      .then(setPopularEntries)
      .finally(() => setPopularLoading(false));
  }, [libraryMode, popularEntries]);

  const activeEntries = libraryMode === "popular-verbs" ? popularEntries ?? [] : trancheEntries;
  const loading = libraryMode === "popular-verbs" ? popularLoading : trancheLoading;

  const jlptOptions = useMemo(() => getJlptOptions(trancheEntries), [trancheEntries]);
  const partOptions = useMemo(() => getPartOfSpeechOptions(trancheEntries), [trancheEntries]);

  const learnedCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    if (!vocabIndex) return counts;
    for (const id of progress.learnedWordIds) {
      const t = vocabIndex[id];
      if (t) counts[t] = (counts[t] ?? 0) + 1;
    }
    return counts;
  }, [vocabIndex, progress.learnedWordIds]);

  const popularVerbLearned = useMemo(
    () =>
      popularEntries
        ? popularEntries.filter((e) => progress.learnedWordIds.includes(e.id)).length
        : 0,
    [popularEntries, progress.learnedWordIds]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (e: VocabEntry) =>
      !q ||
      `${e.word} ${e.reading} ${e.meaning} ${e.example.chinese}`
        .toLowerCase()
        .includes(q);
    if (libraryMode === "popular-verbs") {
      return (popularEntries ?? []).filter(matchesQuery);
    }
    return trancheEntries.filter(
      (e) =>
        (selectedJlpt === "全部" || e.jlpt_level === selectedJlpt) &&
        (selectedPart === "全部" || e.part_of_speech.includes(selectedPart)) &&
        matchesQuery(e)
    );
  }, [libraryMode, popularEntries, trancheEntries, query, selectedJlpt, selectedPart]);

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
      const entry = activeEntries.find((item) => item.id === wordId);
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

  async function selectRelated(targetId: number) {
    const trancheId = vocabIndex?.[targetId];
    if (!trancheId) return;
    setLibraryMode("tranche");
    const entries =
      trancheId === selectedTrancheId ? trancheEntries : await fetchTranche(trancheId);
    setProgress({ selectedTrancheId: trancheId });
    const target = entries.find((e) => e.id === targetId);
    if (target) setQuery(target.word);
    setVisibleCount(PAGE_SIZE);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`word-${targetId}`)
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
              ? "從詞庫依 JMdict priority-derived rank 抽出的前 300 個常用動詞，含動詞變化 info。"
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
              {libraryMode === "popular-verbs" ? "回到分層詞庫" : "常用動詞 300"}
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
          {loading ? "載入中…" : `${filtered.length} 個單字`}
          {!loading && activeFilters > 0 ? (
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
        {loading ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-48 animate-pulse rounded-xl border border-border/60 bg-card/40"
              />
            ))}
          </div>
        ) : visible.length === 0 ? (
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

        {!loading && visibleCount < filtered.length ? (
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
