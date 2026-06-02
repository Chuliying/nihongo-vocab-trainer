"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  RotateCcw,
  Settings2,
  Shuffle,
  Undo2
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RelatedWords } from "@/components/RelatedWords";
import { VerbInfoPanel } from "@/components/VerbInfoPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { useStudyProgress } from "@/lib/storage";
import { filterVocab, findRelatedTarget, shuffle } from "@/lib/vocab";
import { cn } from "@/lib/utils";
import type { PracticeMode, Tranche, VocabEntry } from "@/lib/types";

export function PracticePage({
  tranches,
  vocab
}: {
  tranches: Tranche[];
  vocab: VocabEntry[];
}) {
  const { progress, setProgress, markSeen, toggleLearned, resetProgress } =
    useStudyProgress();
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tranche = Number(params.get("tranche"));
    if (tranche && tranche !== progress.selectedTrancheId) {
      setProgress({ selectedTrancheId: tranche, currentPracticeIndex: 0 });
    }
  }, [progress.selectedTrancheId, setProgress]);

  const selectedTrancheId = progress.selectedTrancheId || 1;
  const selectedTranche =
    tranches.find((item) => item.id === selectedTrancheId) ?? tranches[0];

  const sequentialWords = useMemo(
    () =>
      filterVocab(vocab, {
        query: "",
        trancheId: selectedTrancheId,
        jlpt: progress.selectedJlpt,
        partOfSpeech: progress.selectedPartOfSpeech
      }),
    [
      progress.selectedJlpt,
      progress.selectedPartOfSpeech,
      selectedTrancheId,
      vocab
    ]
  );

  const sessionWords = useMemo(() => {
    if (
      progress.practiceMode === "random30" &&
      progress.randomSessionWordIds.length > 0
    ) {
      const ids = new Set(progress.randomSessionWordIds);
      return progress.randomSessionWordIds
        .map((id) => vocab.find((entry) => entry.id === id))
        .filter((entry): entry is VocabEntry => Boolean(entry && ids.has(entry.id)));
    }
    return sequentialWords;
  }, [
    progress.practiceMode,
    progress.randomSessionWordIds,
    sequentialWords,
    vocab
  ]);

  const safeIndex =
    sessionWords.length === 0
      ? 0
      : Math.min(progress.currentPracticeIndex, sessionWords.length - 1);
  const current = sessionWords[safeIndex] ?? sequentialWords[0] ?? vocab[0];
  const isLearned = current ? progress.learnedWordIds.includes(current.id) : false;
  const pct = sessionWords.length
    ? ((safeIndex + 1) / sessionWords.length) * 100
    : 0;

  useEffect(() => {
    if (current) markSeen(current.id);
  }, [current, markSeen]);

  function updateMode(mode: PracticeMode) {
    if (mode === "sequential") {
      setProgress({
        practiceMode: mode,
        currentPracticeIndex: 0,
        randomSessionWordIds: []
      });
      setIsFlipped(false);
      return;
    }
    startRandomSession();
  }

  function startRandomSession() {
    const pool =
      sequentialWords.length > 0
        ? sequentialWords
        : vocab.filter((entry) => entry.tranche_id === selectedTrancheId);
    const ids = shuffle(pool.map((entry) => entry.id)).slice(0, 30);
    setProgress({
      practiceMode: "random30",
      currentPracticeIndex: 0,
      randomSessionWordIds: ids,
      randomSessionSize: 30,
      randomRange: { type: "tranche", trancheId: selectedTrancheId }
    });
    setIsFlipped(false);
  }

  function go(delta: number) {
    if (sessionWords.length === 0) return;
    const next = Math.min(
      sessionWords.length - 1,
      Math.max(0, safeIndex + delta)
    );
    setProgress({ currentPracticeIndex: next });
    setIsFlipped(false);
  }

  function selectRelated(targetId: number) {
    const target = findRelatedTarget(vocab, targetId);
    if (!target) return;
    const targetIndex = vocab
      .filter((entry) => entry.tranche_id === target.tranche_id)
      .findIndex((entry) => entry.id === target.id);
    setProgress({
      practiceMode: "sequential",
      selectedTrancheId: target.tranche_id,
      currentPracticeIndex: Math.max(0, targetIndex),
      randomSessionWordIds: []
    });
    setIsFlipped(true);
  }

  function onTouchStart(event: React.TouchEvent) {
    const touch = event.touches[0];
    setTouchStartX(touch.clientX);
    setTouchStartY(touch.clientY);
  }

  function onTouchEnd(event: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    setTouchStartX(null);
    setTouchStartY(null);
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) go(1);
    if (dx > 0) go(-1);
  }

  if (!current) {
    return (
      <AppShell>
        <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-muted-foreground">目前沒有可練習的單字。</p>
          <Button asChild variant="outline">
            <Link href="/">← 回到詞庫</Link>
          </Button>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-md flex-col px-4 pb-6 pt-3">
        {/* Minimal top row */}
        <div className="flex items-center justify-between gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
          >
            <Link href="/" aria-label="回到詞庫">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>

          <div className="text-center">
            <p className="font-display text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">
              {progress.practiceMode === "random30"
                ? "Random 30"
                : selectedTranche.label}
            </p>
            <p className="font-display text-sm tabular-nums">
              <span className="text-primary">{safeIndex + 1}</span>
              <span className="text-muted-foreground"> / {sessionWords.length}</span>
            </p>
          </div>

          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                aria-label="練習設定"
              >
                <Settings2 className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="mx-auto max-w-md pb-8">
              <SheetHeader>
                <SheetTitle>練習設定</SheetTitle>
              </SheetHeader>
              <div className="space-y-5 px-5">
                <div className="space-y-2">
                  <Label>模式</Label>
                  <Tabs
                    value={progress.practiceMode}
                    onValueChange={(value) => updateMode(value as PracticeMode)}
                  >
                    <TabsList className="w-full">
                      <TabsTrigger value="sequential">正常學習</TabsTrigger>
                      <TabsTrigger value="random30">Random 30</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                <div className="space-y-2">
                  <Label>階段</Label>
                  <Select
                    value={String(selectedTrancheId)}
                    onValueChange={(value) => {
                      setProgress({
                        selectedTrancheId: Number(value),
                        currentPracticeIndex: 0,
                        randomSessionWordIds: [],
                        practiceMode: "sequential"
                      });
                      setIsFlipped(false);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tranches.map((tranche) => (
                        <SelectItem key={tranche.id} value={String(tranche.id)}>
                          {tranche.title} · {tranche.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  {progress.practiceMode === "random30" ? (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={startRandomSession}
                    >
                      <Shuffle className="size-4" /> 重新抽 30 張
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    className="flex-1 text-muted-foreground"
                    onClick={resetProgress}
                  >
                    <RotateCcw className="size-4" /> 重設進度
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Progress value={pct} className="mt-3" />

        {/* Centered flashcard */}
        <div className="flex flex-1 items-center justify-center py-5">
          <div className="flip-scene w-full">
            <div
              className={cn("flip-card relative h-[clamp(22rem,60svh,34rem)] w-full", isFlipped && "is-flipped")}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* FRONT */}
              <button
                type="button"
                onClick={() => setIsFlipped(true)}
                className="flip-face flex flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-card px-6 text-center shadow-[0_30px_70px_-32px_var(--glow)]"
              >
                <Badge className="absolute left-5 top-5">
                  {current.jlpt_level}
                </Badge>
                <span className="font-serif text-[clamp(3.6rem,18vw,5.8rem)] leading-none font-semibold">
                  {current.word}
                </span>
                <span className="text-lg text-muted-foreground">
                  {current.reading}
                </span>
                <span className="absolute bottom-6 font-display text-xs tracking-wide text-muted-foreground/70">
                  tap to flip ＋ swipe ↔
                </span>
              </button>

              {/* BACK */}
              <div className="flip-face flip-face--back flex flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-[0_30px_80px_-30px_var(--glow)]">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <Badge variant="outline">{current.part_of_speech}</Badge>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(false)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" /> 翻回正面
                  </button>
                </div>

                <div className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4">
                  <div>
                    <h2 className="font-serif text-3xl font-semibold">
                      {current.word}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {current.reading}
                    </p>
                  </div>

                  <p className="text-lg font-medium leading-relaxed text-primary">
                    {current.meaning}
                  </p>

                  <blockquote className="space-y-1 border-l-2 border-primary/40 pl-3">
                    <p className="font-serif leading-relaxed">
                      {current.example.japanese}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {current.example.reading}
                    </p>
                    <p className="text-sm text-foreground/80">
                      {current.example.chinese}
                    </p>
                  </blockquote>

                  <VerbInfoPanel verbInfo={current.verb_info} />
                  <RelatedWords related={current.related} onSelect={selectRelated} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <Button
            variant="secondary"
            size="icon"
            disabled={safeIndex === 0}
            onClick={() => go(-1)}
            aria-label="上一個"
            className="justify-self-start"
          >
            <ArrowLeft className="size-5" />
          </Button>

          <Button
            variant={isLearned ? "default" : "outline"}
            onClick={() => toggleLearned(current.id)}
            className="px-6"
          >
            <Check className="size-4" />
            {isLearned ? "已學會" : "標記學會"}
          </Button>

          <Button
            variant="secondary"
            size="icon"
            disabled={safeIndex >= sessionWords.length - 1}
            onClick={() => go(1)}
            aria-label="下一個"
            className="justify-self-end"
          >
            <ArrowRight className="size-5" />
          </Button>
        </div>
      </main>
    </AppShell>
  );
}
