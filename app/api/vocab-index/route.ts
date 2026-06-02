import { NextResponse } from "next/server";
import { getVocabIndex } from "@/lib/vocab-data";

// id → tranche_id map for learned-count tallies and related-word navigation.
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(getVocabIndex());
}
