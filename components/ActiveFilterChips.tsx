import { X } from "lucide-react";
import { getCollectionLabel } from "@/lib/collections";
import type { CollectionId, JlptLevel } from "@/lib/types";

type Props = {
  collection: CollectionId;
  jlpt: JlptLevel;
  partOfSpeech: string;
  onRemoveCollection: () => void;
  onRemoveJlpt: () => void;
  onRemovePartOfSpeech: () => void;
};

export function ActiveFilterChips({
  collection,
  jlpt,
  partOfSpeech,
  onRemoveCollection,
  onRemoveJlpt,
  onRemovePartOfSpeech,
}: Props) {
  const chips: { label: string; onRemove: () => void }[] = [];

  if (collection !== "all") {
    chips.push({ label: getCollectionLabel(collection), onRemove: onRemoveCollection });
  }
  if (jlpt !== "全部") {
    chips.push({ label: jlpt, onRemove: onRemoveJlpt });
  }
  if (partOfSpeech !== "全部") {
    chips.push({ label: partOfSpeech, onRemove: onRemovePartOfSpeech });
  }

  if (chips.length === 0) return null;

  return (
    <div className="no-scrollbar flex gap-2 overflow-x-auto">
      {chips.map((chip) => (
        <button
          key={chip.label}
          type="button"
          onClick={chip.onRemove}
          className="flex shrink-0 items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
        >
          {chip.label}
          <X className="size-3" />
        </button>
      ))}
    </div>
  );
}
