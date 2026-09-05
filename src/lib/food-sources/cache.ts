import { db } from "@/db";
import { foods } from "@/db/schema";
import type { NormalizedFood } from "./types";

// Upserts fresh USDA/Open Food Facts results into the shared cache, keyed on
// (source, external_id), so repeat lookups hit the DB instead of the API.
//
// Uses allSettled, not all: external data is messy (crowdsourced Open Food
// Facts especially) and can violate a DB constraint in ways normalization
// doesn't anticipate — one bad item failing shouldn't take down every other
// result in the same search. Failures are logged and skipped, not surfaced.
export async function upsertFoods(items: NormalizedFood[]) {
  if (items.length === 0) return [];

  const results = await Promise.allSettled(
    items.map((item) =>
      db
        .insert(foods)
        .values(item)
        .onConflictDoUpdate({
          target: [foods.source, foods.externalId],
          set: {
            name: item.name,
            brand: item.brand,
            caloriesPer100: item.caloriesPer100,
            proteinPer100: item.proteinPer100,
            carbsPer100: item.carbsPer100,
            fatPer100: item.fatPer100,
            servingSize: item.servingSize,
            servingUnit: item.servingUnit,
            servingLabel: item.servingLabel,
            micros: item.micros,
            updatedAt: new Date(),
          },
        })
        .returning(),
    ),
  );

  const rows = [];
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      rows.push(...result.value);
    } else {
      console.error(`upsertFoods: failed to cache "${items[index].name}"`, result.reason);
    }
  }

  return rows;
}
