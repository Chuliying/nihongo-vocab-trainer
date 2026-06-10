import type { CollectionId } from "@/lib/types";

export type CollectionConfig = {
  id: CollectionId;
  label: string;
  limit: number;
  pos?: string;
};

export const COLLECTIONS: CollectionConfig[] = [
  { id: "all", label: "全部 13,000 語", limit: Infinity },
  { id: "popular-verbs", label: "常用動詞", limit: 300 },
  { id: "popular-adj", label: "常用形容詞", limit: 200, pos: "形容詞" },
  { id: "popular-adv", label: "常用副詞", limit: 150, pos: "副詞" },
  { id: "popular-conj", label: "常用接続詞", limit: 100, pos: "接続詞" },
];

export function getCollectionConfig(id: CollectionId): CollectionConfig {
  const config = COLLECTIONS.find((c) => c.id === id);
  if (!config) throw new Error(`Unknown collection: ${id}`);
  return config;
}

export function getCollectionLabel(id: CollectionId): string {
  return getCollectionConfig(id).label;
}
