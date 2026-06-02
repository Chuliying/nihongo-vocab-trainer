import { NextResponse } from "next/server";
import { getPopularEntries } from "@/lib/vocab-data";

// Full entries for the 300 popular verbs (they span many tranches).
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json(getPopularEntries());
}
