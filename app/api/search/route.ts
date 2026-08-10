import { NextResponse } from "next/server";
import {
  normalizeSearchQuery,
  parseSearchLimit,
} from "@/lib/vocab-search";
import { searchEntries } from "@/lib/vocab-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = parseSearchLimit(url.searchParams.get("limit"));
  if (limit === null) {
    return NextResponse.json({ error: "invalid limit" }, { status: 400 });
  }

  const query = normalizeSearchQuery(url.searchParams.get("q") ?? "");
  if (!query) return NextResponse.json([]);

  try {
    return NextResponse.json(await searchEntries(query, limit));
  } catch {
    return NextResponse.json({ error: "search failed" }, { status: 500 });
  }
}
