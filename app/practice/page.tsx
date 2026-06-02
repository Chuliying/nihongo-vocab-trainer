import { PracticePage } from "@/components/PracticePage";
import tranches from "@/public/data/tranches.json";
import type { Tranche } from "@/lib/types";

export default function Practice() {
  return <PracticePage tranches={tranches as Tranche[]} />;
}
