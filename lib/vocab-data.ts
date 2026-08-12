// Backward-compatible exports for older imports. New route/runtime code should
// import from "@/lib/vocab-repository".

export {
  getEntryById,
  getPopularEntries,
  getTrancheEntries,
  getTrancheIds,
  getVocabIndex,
  searchEntries,
} from "@/lib/vocab-repository";

export { TRANCHE_IDS } from "@/lib/vocab-data-json";
