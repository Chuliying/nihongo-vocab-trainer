import { NextResponse } from "next/server";
import { getEntriesByPos } from "@/lib/vocab-repository";
import type { CollectionId } from "@/lib/types";
import { getCollectionConfig } from "@/lib/collections";

const COLLECTION_IDS: CollectionId[] = ["popular-adj", "popular-adv", "popular-conj"];

export const dynamic = "force-static";

export async function generateStaticParams() {
  return COLLECTION_IDS.map((id) => ({ id }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!COLLECTION_IDS.includes(id as CollectionId)) {
    return NextResponse.json({ error: "Unknown collection" }, { status: 404 });
  }

  const config = getCollectionConfig(id as CollectionId);
  if (!config.pos) {
    return NextResponse.json({ error: "Collection has no pos filter" }, { status: 400 });
  }

  const entries = await getEntriesByPos(config.pos, config.limit);
  return NextResponse.json(entries);
}
