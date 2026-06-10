// Backward-compatible exports for older imports. New route/runtime code should
// import from "@/lib/vocab-repository".

export {
  getPopularEntries,
  getTrancheEntries,
  getTrancheIds,
  getVocabIndex,
} from "@/lib/vocab-repository";

export { TRANCHE_IDS } from "@/lib/vocab-data-json";
