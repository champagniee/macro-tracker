import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { and, ilike, ne, or, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { foods } from "@/db/schema";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getSession } from "@/lib/auth/session";
import { searchUsda } from "@/lib/food-sources/usda";
import { searchOpenFoodFacts } from "@/lib/food-sources/openfoodfacts";
import { upsertFoods } from "@/lib/food-sources/cache";
import type { NormalizedFood } from "@/lib/food-sources/types";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query must be at least 2 characters" }, { status: 400 });
  }

  const session = await getSession();

  // Match each word in the query independently (AND'd together) rather than the
  // whole phrase as one substring — "adobo chicken" should still find "Chicken
  // Adobo" even though that exact phrase never appears in the name. Each word
  // matches on an exact substring OR a pg_trgm fuzzy match, so a typo like
  // "chiken" still finds "Chicken Adobo".
  //
  // Checked against name AND brand, not just name: some products don't repeat
  // their brand in the name at all (Open Food Facts: "Corned Beef" with brand
  // "Argentina", not "Argentina Corned Beef") — name-only search silently misses
  // those for a brand-only query.
  //
  // The fuzzy check compares the query word against each *individual* word of
  // name/brand (via similarity(), word vs word), not word_similarity() against
  // the whole multi-word blob. That first version shipped and then broke in
  // practice: word_similarity('banana', 'Chicken breast cured, cooked, baked')
  // scored 0.33 — above the 0.3 threshold — because "banana"'s heavy internal
  // letter repetition (an/na/ana) gives it very few distinct trigrams, so
  // matching just one or two common ones against a long, unrelated string was
  // enough to look similar. Comparing single words against single words instead
  // (with the threshold raised to 0.4) verified clean against real data: it
  // blocks all the observed false positives (0.07-0.14, occasionally 0.3 for a
  // visually similar word) while still catching the most common typo patterns —
  // missing a letter or an adjacent-key slip both score 0.5+. Rarer transposition
  // typos ("chicekn") score lower (~0.3) and can still slip through the cracks;
  // that's an accepted tradeoff, not an oversight — false positives cluttering
  // results are worse than occasionally missing an unusual typo.
  const FUZZY_THRESHOLD = 0.4;
  const words = q.split(/\s+/).filter(Boolean);

  function fuzzyWordMatch(column: PgColumn, word: string) {
    return sql`EXISTS (
      SELECT 1 FROM unnest(string_to_array(lower(${column}), ' ')) AS t(w)
      WHERE similarity(lower(${word}), t.w) > ${FUZZY_THRESHOLD}
    )`;
  }

  const nameMatches = and(
    ...words.map((word) =>
      or(
        ilike(foods.name, `%${word}%`),
        ilike(foods.brand, `%${word}%`),
        fuzzyWordMatch(foods.name, word),
        fuzzyWordMatch(foods.brand, word),
      ),
    ),
  );

  const cached = await db
    .select()
    .from(foods)
    .where(
      and(
        nameMatches,
        session ? or(ne(foods.source, "custom"), eq(foods.userId, session.sub)) : ne(foods.source, "custom"),
      ),
    )
    .limit(30);

  // Macros for a given food don't change, so once a *source* already has a cached
  // match for this query, there's no need to re-hit that source — but this has to
  // be checked per source, not as one combined flag. A combined check meant that
  // once either source had ever produced a cached match for a query, the other
  // source got silently skipped forever too, even if it was never actually tried —
  // found live: "banana" had 13 cached Open Food Facts rows and zero USDA rows,
  // so USDA was never being queried at all, not even once its rate limit reset.
  const hasCachedUsda = cached.some((row) => row.source === "usda");
  const hasCachedOff = cached.some((row) => row.source === "openfoodfacts");

  const [usdaResult, offResult] = await Promise.allSettled([
    hasCachedUsda ? Promise.resolve<NormalizedFood[]>([]) : searchUsda(q),
    hasCachedOff ? Promise.resolve<NormalizedFood[]>([]) : searchOpenFoodFacts(q),
  ]);

  const fresh = [
    ...(usdaResult.status === "fulfilled" ? usdaResult.value : []),
    ...(offResult.status === "fulfilled" ? offResult.value : []),
  ];

  const upserted = await upsertFoods(fresh);

  const warnings: string[] = [];
  if (usdaResult.status === "rejected") warnings.push("USDA search unavailable");
  if (offResult.status === "rejected") warnings.push("Open Food Facts search unavailable");

  const byId = new Map<string, (typeof cached)[number]>();
  for (const row of [...cached, ...upserted]) {
    byId.set(row.id, row);
  }

  const results = Array.from(byId.values()).sort((a, b) => {
    if (a.source === "custom" && b.source !== "custom") return -1;
    if (a.source !== "custom" && b.source === "custom") return 1;
    return 0;
  });

  return NextResponse.json({ results, warnings });
}
