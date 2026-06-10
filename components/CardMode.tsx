"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Settings2, Undo2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DraggableProgress } from "@/components/ui/DraggableProgress";
import { FilterSheet } from "@/components/FilterSheet";
import { RelatedWords } from "@/components/RelatedWords";
import { SessionEndSummary } from "@/components/SessionEndSummary";
import { VerbInfoPanel } from "@/components/VerbInfoPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { filterByScope } from "@/lib/vocab";
import { getCollectionLabel } from "@/lib/collections";
import { cn } from "@/lib/utils";
import { track } from "@vercel/analytics";
import type { CollectionId, JlptLevel, SessionMode, VocabEntry } from "@/lib/types";

type Props = {
  entries: VocabEntry[];
  loadingEntries: boolean;
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  partOfSpeechOptions: string[];
  activeFilterCount: number;
  activeSession: SessionMode;
  sequentialIndex: number;
  randomSessionIds: number[];
  randomSessionIndex: number;
  randomIncludeLearned: boolean;
  randomQuantity: number | "all";
  learnedWordIds: number[];
  onSwitchSession: (mode: SessionMode) => void;
  onSetSequentialIndex: (i: number) => void;
  onSetRandomIndex: (i: number) => void;
  onGenerateRandom: () => void;
  onMarkSeen: (id: number) => void;
  onToggleLearned: (id: number) => void;
  onRelatedSelect: (targetId: number) => void;
  onBackToList: () => void;
  onCollectionChange: (id: CollectionId) => void;
  onJlptChange: (level: JlptLevel) => void;
  onPartOfSpeechChange: (pos: string) => void;
  onRandomIncludeLearnedChange: (val: boolean) => void;
  onRandomQuantityChange: (val: number | "all") => void;
  onResetProgress: () => void;
};

export function CardMode({
  entries,
  loadingEntries,
  collection,
  jlpt,
  partOfSpeech,
  partOfSpeechOptions,
  activeFilterCount,
  activeSession,
  sequentialIndex,
  randomSessionIds,
  randomSessionIndex,
  randomIncludeLearned,
  randomQuantity,
  learnedWordIds,
  onSwitchSession,
  onSetSequentialIndex,
  onSetRandomIndex,
  onGenerateRandom,
  onMarkSeen,
  onToggleLearned,
  onRelatedSelect,
  onBackToList,
  onCollectionChange,
  onJlptChange,
  onPartOfSpeechChange,
  onRandomIncludeLearnedChange,
  onRandomQuantityChange,
  onResetProgress,
}: Props) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [showEndSummary, setShowEndSummary] = useState(false);
  const sessionLearnedRef = useRef<Set<number>>(new Set());

  const filteredEntries = useMemo(
    () => filterByScope(entries, { query: "", jlpt, partOfSpeech }),
    [entries, jlpt, partOfSpeech]
  );

  const sequentialWords = filteredEntries;

  const randomWords = useMemo(() => {
    const byId = new Map(entries.map((e) => [e.id, e]));
    return randomSessionIds
      .map((id) => byId.get(id))
      .filter((e): e is VocabEntry => Boolean(e));
  }, [entries, randomSessionIds]);

  const sessionWords = activeSession === "random" ? randomWords : sequentialWords;
  const currentIndex = activeSession === "random" ? randomSessionIndex : sequentialIndex;
  const setIndex = activeSession === "random" ? onSetRandomIndex : onSetSequentialIndex;

  const safeIndex =
    sessionWords.length === 0 ? 0 : Math.min(currentIndex, sessionWords.length - 1);

  const current = sessionWords[safeIndex];
  const isLearned = current ? learnedWordIds.includes(current.id) : false;

  useEffect(() => {
    if (current && isLearned) sessionLearnedRef.current.add(current.id);
  }, [current, isLearned]);

  useEffect(() => {
    if (current) onMarkSeen(current.id);
  }, [current, onMarkSeen]);

  function go(delta: number) {
    if (sessionWords.length === 0) return;
    const next = safeIndex + delta;
    if (next >= sessionWords.length) {
      setShowEndSummary(true);
      return;
    }
    const clamped = Math.max(0, next);
    setIndex(clamped);
    setIsFlipped(false);
  }

  function flipToBack() {
    if (!isFlipped && current) {
      track("flashcard_flip", { word: current.word, jlpt: current.jlpt_level });
    }
    setIsFlipped(true);
  }

  function handleToggleLearned() {
    if (!current) return;
    if (!isLearned) {
      track("word_learned", { word: current.word, jlpt: current.jlpt_level, source: "card" });
    }
    onToggleLearned(current.id);
  }

  function handleRestart() {
    setShowEndSummary(false);
    sessionLearnedRef.current.clear();
    setIndex(0);
    setIsFlipped(false);
  }

  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    setTouchStartX(t.clientX);
    setTouchStartY(t.clientY);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (touchStartX === null || touchStartY === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartX;
    const dy = t.clientY - touchStartY;
    setTouchStartX(null);
    setTouchStartY(null);
    if (Math.abs(dx) < 54 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) go(1);
    if (dx > 0) go(-1);
  }

  const collectionLabel = collection === "all" ? "全部詞庫" : getCollectionLabel(collection);
  const progressLabel =
    activeSession === "random"
      ? "Random Session"
      : `${collectionLabel}${jlpt !== "全部" ? ` · ${jlpt}` : ""}${partOfSpeech !== "全部" ? ` · ${partOfSpeech}` : ""}`;

  // Show skeleton while loading OR while we have no words but are expecting some (non-all collection still loading)
  const showSkeleton = loadingEntries;
  const showEmpty = !loadingEntries && sessionWords.length === 0;

  if (showSkeleton || showEmpty) {
    return (
      <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] max-w-md flex-col items-center justify-center gap-4 px-4">
        {showSkeleton ? (
          <div className="h-[clamp(22rem,60svh,34rem)] w-full animate-pulse rounded-3xl border border-border/60 bg-card/50" />
        ) : collection === "all" ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">
              卡片模式請先選擇一個詞庫（常用動詞、常用形容詞等）。
            </p>
            <Button variant="outline" onClick={onBackToList}>
              <ArrowLeft className="size-4" />
              回到列表選擇詞庫
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">目前沒有可練習的單字。</p>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-md flex-col px-4 pb-6 pt-3">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          onClick={onBackToList}
          aria-label="回到列表"
        >
          <ArrowLeft className="size-5" />
        </Button>

        <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
          {(["sequential", "random"] as SessionMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                onSwitchSession(mode);
                setIsFlipped(false);
                setShowEndSummary(false);
              }}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                activeSession === mode
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {mode === "sequential" ? "循序" : "Random"}
            </button>
          ))}
        </div>

        <FilterSheet
          collection={collection}
          jlpt={jlpt}
          partOfSpeech={partOfSpeech}
          partOfSpeechOptions={partOfSpeechOptions}
          activeFilterCount={activeFilterCount}
          showRandomSettings={activeSession === "random"}
          randomIncludeLearned={randomIncludeLearned}
          randomQuantity={randomQuantity}
          onCollectionChange={onCollectionChange}
          onJlptChange={onJlptChange}
          onPartOfSpeechChange={onPartOfSpeechChange}
          onRandomIncludeLearnedChange={onRandomIncludeLearnedChange}
          onRandomQuantityChange={onRandomQuantityChange}
          onRegenerateRandom={onGenerateRandom}
          onResetProgress={onResetProgress}
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              aria-label="設定"
            >
              <Settings2 className="size-5" />
            </Button>
          }
        />
      </div>

      <DraggableProgress
        value={safeIndex}
        max={sessionWords.length}
        onChange={(i) => {
          setIndex(i);
          setIsFlipped(false);
          setShowEndSummary(false);
        }}
        label={progressLabel}
        className="mt-3"
      />

      <div className="flex flex-1 items-center justify-center py-5">
        <div className="flip-scene w-full">
          {showEndSummary ? (
            <SessionEndSummary
              totalSeen={sessionWords.length}
              learnedThisSession={sessionLearnedRef.current.size}
              onRestart={handleRestart}
              onBackToList={onBackToList}
            />
          ) : (
            <div
              className={cn(
                "flip-card relative h-[clamp(22rem,60svh,34rem)] w-full",
                isFlipped && "is-flipped"
              )}
              onTouchStart={onTouchStart}
              onTouchEnd={onTouchEnd}
            >
              {/* FRONT */}
              <button
                type="button"
                onClick={flipToBack}
                className="flip-face flex flex-col items-center justify-center gap-5 rounded-3xl border border-border bg-card px-6 text-center shadow-[0_30px_70px_-32px_var(--glow)]"
              >
                <Badge className="absolute left-5 top-5">
                  推估 {current?.jlpt_level}
                </Badge>
                <span className="font-serif text-[clamp(3.6rem,18vw,5.8rem)] leading-none font-semibold">
                  {current?.word}
                </span>
                <span className="absolute bottom-6 font-display text-xs tracking-wide text-muted-foreground/70">
                  tap to flip · swipe ↔
                </span>
              </button>

              {/* BACK */}
              <div className="flip-face flip-face--back flex flex-col overflow-hidden rounded-3xl border border-primary/25 bg-card shadow-[0_30px_80px_-30px_var(--glow)]">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
                  <Badge variant="outline">{current?.part_of_speech}</Badge>
                  <button
                    type="button"
                    onClick={() => setIsFlipped(false)}
                    className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <Undo2 className="size-3.5" />
                    翻回正面
                  </button>
                </div>
                {current && (
                  <div
                    key={current.id}
                    className="no-scrollbar flex-1 space-y-4 overflow-y-auto px-5 py-4"
                  >
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
                    <RelatedWords related={current.related} onSelect={onRelatedSelect} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {!showEndSummary && (
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-0">
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
            onClick={handleToggleLearned}
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
      )}
    </main>
  );
}
