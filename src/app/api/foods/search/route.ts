import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { searchFoods } from "@/lib/food-sources/search-foods";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const { results, warnings } = await searchFoods(q);

  return NextResponse.json({ results, warnings });
}
