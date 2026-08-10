"use client";

import { RotateCcw, SlidersHorizontal, Shuffle } from "lucide-react";
import { COLLECTIONS } from "@/lib/collections";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { CollectionId, JlptLevel } from "@/lib/types";

const JLPT_OPTIONS: JlptLevel[] = ["全部", "N5", "N4", "N3", "N2", "N1"];
const RANDOM_QUANTITIES = [10, 30, 50, 100] as const;

type Props = {
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  partOfSpeechOptions: string[];
  activeFilterCount: number;
  showRandomSettings?: boolean;
  randomIncludeLearned?: boolean;
  randomQuantity?: number | "all";
  trigger?: React.ReactNode;
  children?: React.ReactNode;
  onCollectionChange: (value: CollectionId) => void;
  onJlptChange: (value: JlptLevel) => void;
  onPartOfSpeechChange: (value: string) => void;
  onRandomIncludeLearnedChange?: (value: boolean) => void;
  onRandomQuantityChange?: (value: number | "all") => void;
  onRegenerateRandom?: () => void;
  onResetProgress: () => void;
};

export function FilterSheet({
  collection,
  jlpt,
  partOfSpeech,
  partOfSpeechOptions,
  activeFilterCount,
  showRandomSettings = false,
  randomIncludeLearned = false,
  randomQuantity = 30,
  trigger,
  children,
  onCollectionChange,
  onJlptChange,
  onPartOfSpeechChange,
  onRandomIncludeLearnedChange,
  onRandomQuantityChange,
  onRegenerateRandom,
  onResetProgress,
}: Props) {
  const defaultTrigger = (
    <Button
      variant="outline"
      size="icon"
      className="relative size-12 shrink-0 rounded-2xl"
      aria-label="篩選"
    >
      <SlidersHorizontal className="size-4" />
      {activeFilterCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[0.6rem] font-bold text-primary-foreground">
          {activeFilterCount}
        </span>
      ) : null}
    </Button>
  );

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger ?? children ?? defaultTrigger}
      </SheetTrigger>

      <SheetContent side="bottom" className="mx-auto max-w-md pb-8">
        <SheetHeader>
          <SheetTitle>篩選</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 px-5">
          <div className="space-y-2">
            <Label>詞庫範圍</Label>
            <div className="flex flex-wrap gap-2">
              {COLLECTIONS.map((col) => (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => onCollectionChange(col.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    collection === col.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/60"
                  )}
                >
                  {col.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>JLPT 等級</Label>
            <div className="flex flex-wrap gap-2">
              {JLPT_OPTIONS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => onJlptChange(level)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    jlpt === level
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/60"
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>詞性</Label>
            <Select value={partOfSpeech} onValueChange={onPartOfSpeechChange}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {partOfSpeechOptions.map((opt) => (
                  <SelectItem key={opt} value={opt}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showRandomSettings && (
            <div className="space-y-4 rounded-xl border border-border/60 bg-muted/30 p-4">
              <p className="text-sm font-medium">隨機練習設定</p>

              <div className="space-y-2">
                <Label>包含已學會的單字</Label>
                <div className="flex gap-2">
                  {(["否", "是"] as const).map((label, i) => {
                    const val = i === 1;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => onRandomIncludeLearnedChange?.(val)}
                        className={cn(
                          "flex-1 rounded-full border px-3 py-1 text-sm transition-colors",
                          randomIncludeLearned === val
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-card hover:border-primary/60"
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>抽取數量</Label>
                <div className="flex flex-wrap gap-2">
                  {([...RANDOM_QUANTITIES, "all"] as Array<number | "all">).map((q) => (
                    <button
                      key={String(q)}
                      type="button"
                      onClick={() => onRandomQuantityChange?.(q)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-sm transition-colors",
                        randomQuantity === q
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-card hover:border-primary/60"
                      )}
                    >
                      {q === "all" ? "全部" : q}
                    </button>
                  ))}
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onRegenerateRandom}
              >
                <Shuffle className="size-4" />
                重新產出隨機練習
              </Button>
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onResetProgress}
          >
            <RotateCcw className="size-4" />
            重設進度
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
