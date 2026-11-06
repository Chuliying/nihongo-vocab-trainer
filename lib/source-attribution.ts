import manifest from "@/public/data/attribution/tatoeba.json";
import type { VocabEntry } from "@/lib/types";

type Credit = { owner: string | null; readingContributors: string[] };
const credits: Record<string, Credit> = manifest.credits;

// Applied at the server repository boundary, keeping the full attribution
// manifest out of client bundles and preserving identical JSON/DB behavior.
export function withSourceAttribution(entry: VocabEntry): VocabEntry {
  const sentenceId = /^Tatoeba sentence (\d+) \(CC-BY 2\.0 FR\)$/.exec(entry.source.example)?.[1];
  if (!sentenceId) return entry;
  const credit = credits[sentenceId];
  const contributors = [...new Set([
    ...(credit?.owner ? [credit.owner] : []),
    ...(credit?.readingContributors || []),
  ])];
  return {
    ...entry,
    source: {
      ...entry.source,
      attribution: {
        sentenceId: Number(sentenceId),
        url: `https://tatoeba.org/en/sentences/show/${sentenceId}`,
        licenseUrl: "https://creativecommons.org/licenses/by/2.0/fr/",
        contributors,
        ownerMissing: !credit?.owner,
      },
    },
  };
}
