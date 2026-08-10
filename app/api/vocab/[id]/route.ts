import { NextResponse } from "next/server";
import { parseVocabId } from "@/lib/vocab-search";
import { getEntryById } from "@/lib/vocab-repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const parsedId = parseVocabId(id);
  if (parsedId === null) {
    return NextResponse.json({ error: "invalid vocab id" }, { status: 400 });
  }

  const entry = await getEntryById(parsedId);
  if (!entry) {
    return NextResponse.json({ error: "vocab not found" }, { status: 404 });
  }

  return NextResponse.json(entry);
}
