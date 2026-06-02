import { LibraryPage } from "@/components/LibraryPage";
import popularVerbs from "@/public/data/popular_verbs_300.json";
import tranches from "@/public/data/tranches.json";
import vocab from "@/public/data/vocab_13000.json";
import type { PopularVerb, Tranche, VocabEntry } from "@/lib/types";

export default function Home() {
  return (
    <LibraryPage
      popularVerbs={popularVerbs as PopularVerb[]}
      tranches={tranches as Tranche[]}
      vocab={vocab as VocabEntry[]}
    />
  );
}
