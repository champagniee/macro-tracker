import { and, ilike, inArray, or, eq, sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { foods, searchedQueries } from "@/db/schema";
import { searchUsda } from "./usda";
import { searchOpenFoodFacts } from "./openfoodfacts";
import { upsertFoods } from "./cache";
import type { NormalizedFood } from "./types";

// Toggle to skip USDA/Open Food Facts entirely and serve purely from our own
// `foods` table (custom foods + whatever create_custom_food/estimate_macros
// has populated) — set DISABLE_EXTERNAL_FOOD_APIS=true in .env.local.
const EXTERNAL_APIS_DISABLED = process.env.DISABLE_EXTERNAL_FOOD_APIS === "true";

// Extracted out of GET /api/foods/search so the MCP server can reuse the exact
// same search behavior (word matching, fuzzy typo tolerance, the
// searched_queries cache-skip, unbranded-first sorting) instead of
// reimplementing it — used by both the REST route and the search_food MCP tool.
export async function searchFoods(query: string) {
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
  const words = query.split(/\s+/).filter(Boolean);

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

  // Macros for a given food don't change, so once a *source* has actually been
  // asked this exact query before, there's no need to re-hit it — but "already
  // asked" has to be tracked as its own fact, not inferred from whether any row
  // in `foods` happens to match today's search. That inference is what broke
  // live: a "BUNDT, COCONUT PINEAPPLE" row (cached from an unrelated earlier
  // search) satisfied the word filter for "apple" purely because "pineapple"
  // contains that substring, which permanently blocked USDA from ever being
  // asked about "apple" at all — the real whole-food entries were never
  // missing from USDA, they were just never fetched. `searched_queries` records
  // the literal fact "(source, this exact query) was fetched" instead, keyed on
  // a normalized form so "Apple" / " apple " count as the same query.
  //
  // Run alongside the `cached` lookup rather than after it — they're
  // independent, and Neon's driver has no connection pooling (each round trip
  // costs ~250-350ms), so sequencing them would double this function's DB tax
  // for no reason.
  const normalizedQuery = query.toLowerCase().replace(/\s+/g, " ");
  const [cached, alreadySearched] = await Promise.all([
    // Custom foods are shared/public across all users, same as USDA/OFF's own
    // cached rows — no ownership filter here at all.
    db.select().from(foods).where(nameMatches).limit(30),
    EXTERNAL_APIS_DISABLED
      ? Promise.resolve([])
      : db
          .select({ source: searchedQueries.source })
          .from(searchedQueries)
          .where(and(eq(searchedQueries.query, normalizedQuery), inArray(searchedQueries.source, ["usda", "openfoodfacts"]))),
  ]);
  // Forcing both to true reuses the exact same cache-skip path below (which
  // already substitutes an empty result instead of calling out) rather than
  // adding a parallel "disabled" branch through the rest of the function.
  const hasSearchedUsda = EXTERNAL_APIS_DISABLED || alreadySearched.some((row) => row.source === "usda");
  const hasSearchedOff = EXTERNAL_APIS_DISABLED || alreadySearched.some((row) => row.source === "openfoodfacts");

  const [usdaResult, offResult] = await Promise.allSettled([
    hasSearchedUsda ? Promise.resolve<NormalizedFood[]>([]) : searchUsda(query),
    hasSearchedOff ? Promise.resolve<NormalizedFood[]>([]) : searchOpenFoodFacts(query),
  ]);

  const fresh = [
    ...(usdaResult.status === "fulfilled" ? usdaResult.value : []),
    ...(offResult.status === "fulfilled" ? offResult.value : []),
  ];

  const upserted = await upsertFoods(fresh);

  const warnings: string[] = [];
  if (usdaResult.status === "rejected") warnings.push("USDA search unavailable");
  if (offResult.status === "rejected") warnings.push("Open Food Facts search unavailable");

  // Only record a source as "searched" once it's actually succeeded — a
  // rejected (rate-limited/down) attempt leaves no row, so the next search for
  // this query retries that source instead of being locked into a false
  // "already searched" state the way a bad cache match used to lock things in
  // permanently. onConflictDoNothing since two concurrent searches for the
  // same brand-new query could both attempt the insert.
  const newlySearched = [
    ...(!hasSearchedUsda && usdaResult.status === "fulfilled" ? [{ source: "usda" as const, query: normalizedQuery }] : []),
    ...(!hasSearchedOff && offResult.status === "fulfilled"
      ? [{ source: "openfoodfacts" as const, query: normalizedQuery }]
      : []),
  ];
  if (newlySearched.length > 0) {
    await db
      .insert(searchedQueries)
      .values(newlySearched)
      .onConflictDoNothing({ target: [searchedQueries.source, searchedQueries.query] });
  }

  // Freshly-fetched results still need to pass the same nameMatches relevance
  // filter as cached ones — verified live this was missing: Open Food Facts's
  // own search engine matches on more than just the product name (likely
  // ingredients too), so searching "eggs" returned mayonnaise and cheese
  // verbatim on the first-ever search for that query, before anything was
  // cached. Re-querying the newly-upserted rows through the same SQL predicate
  // (rather than reimplementing the pg_trgm fuzzy check in JS) keeps both
  // paths consistent.
  const freshIds = upserted.map((row) => row.id);
  const freshMatching =
    freshIds.length > 0
      ? await db
          .select()
          .from(foods)
          .where(and(inArray(foods.id, freshIds), nameMatches))
      : [];

  const byId = new Map<string, (typeof cached)[number]>();
  for (const row of [...cached, ...freshMatching]) {
    byId.set(row.id, row);
  }

  // USDA's own relevance ranking (and virtually all of Open Food Facts) puts
  // branded/packaged products ahead of generic whole foods — verified live:
  // searching "chicken breast" returned 10 Branded products before any
  // Foundation/SR Legacy entry. Push unbranded (generic) results above branded
  // ones, after custom foods, so a plain "chicken breast"/"eggs" search surfaces
  // the whole food first instead of burying it under packaged products.
  const results = Array.from(byId.values()).sort((a, b) => {
    if (a.source === "custom" && b.source !== "custom") return -1;
    if (a.source !== "custom" && b.source === "custom") return 1;
    const aBranded = a.brand !== null;
    const bBranded = b.brand !== null;
    if (aBranded !== bBranded) return aBranded ? 1 : -1;
    return 0;
  });

  return { results, warnings };
}
