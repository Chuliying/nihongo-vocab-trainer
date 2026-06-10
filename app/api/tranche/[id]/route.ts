import { NextResponse } from "next/server";
import { getTrancheEntries, getTrancheIds } from "@/lib/vocab-repository";

// Statically generated at build time, one JSON response per tranche.
export const dynamic = "force-static";

export async function generateStaticParams() {
  const trancheIds = await getTrancheIds();
  return trancheIds.map((id) => ({ id: String(id) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const trancheId = Number(id);
  const trancheIds = await getTrancheIds();
  if (!Number.isInteger(trancheId) || !trancheIds.includes(trancheId)) {
    return NextResponse.json({ error: "unknown tranche" }, { status: 404 });
  }
  return NextResponse.json(await getTrancheEntries(trancheId));
}
