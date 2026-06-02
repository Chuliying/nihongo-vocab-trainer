import { PracticePage } from "@/components/PracticePage";
import tranches from "@/public/data/tranches.json";
import vocab from "@/public/data/vocab_10000.json";
import type { Tranche, VocabEntry } from "@/lib/types";

export default function Practice() {
  return <PracticePage tranches={tranches as Tranche[]} vocab={vocab as VocabEntry[]} />;
}
