import { NextResponse } from "next/server";
import { getTrancheEntries, TRANCHE_IDS } from "@/lib/vocab-data";

// Statically generated at build time, one JSON response per tranche.
export const dynamic = "force-static";

export function generateStaticParams() {
  return TRANCHE_IDS.map((id) => ({ id: String(id) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trancheId = Number(id);
  if (!Number.isInteger(trancheId) || !TRANCHE_IDS.includes(trancheId)) {
    return NextResponse.json({ error: "unknown tranche" }, { status: 404 });
  }
  return NextResponse.json(getTrancheEntries(trancheId));
}
