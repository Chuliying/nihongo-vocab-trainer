import { LibraryPage } from "@/components/LibraryPage";
import tranches from "@/public/data/tranches.json";
import type { Tranche } from "@/lib/types";

export default function Home() {
  return <LibraryPage tranches={tranches as Tranche[]} />;
}
