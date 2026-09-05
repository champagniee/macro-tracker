import { pgTable, pgEnum, uuid, text, real, integer, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodSourceEnum = pgEnum("food_source", ["usda", "openfoodfacts", "custom"]);
export const foodBaseUnitEnum = pgEnum("food_base_unit", ["g", "ml"]);

// Nutrition values are stored per 100 base units (100g or 100ml), matching how
// both USDA FoodData Central and Open Food Facts report data natively —
// serving size becomes a display/conversion concern, not a storage concern.
export const foods = pgTable(
  "foods",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: foodSourceEnum("source").notNull(),
    // USDA fdcId or OFF barcode, as a string. Null for custom foods.
    // Used as the cache key for repeat API lookups.
    externalId: text("external_id"),
    name: text("name").notNull(),
    brand: text("brand"),
    baseUnit: foodBaseUnitEnum("base_unit").notNull().default("g"),
    caloriesPer100: real("calories_per_100").notNull(),
    proteinPer100: real("protein_per_100").notNull(),
    carbsPer100: real("carbs_per_100").notNull(),
    fatPer100: real("fat_per_100").notNull(),
    // Display-only serving info (e.g. "1 bar", 30, "g") — not used for macro math.
    servingSize: real("serving_size"),
    servingUnit: text("serving_unit"),
    servingLabel: text("serving_label"),
    // Optional micronutrients per 100 base units, e.g. { "fiber_g": 3.5, "sodium_mg": 450 }.
    // Kept as jsonb since which micros matter is open-ended and shouldn't need a migration per nutrient.
    micros: jsonb("micros").$type<Record<string, number>>(),
    // Owner for source = 'custom' only; null for usda/openfoodfacts (shared, public cache rows).
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Cache key: repeat lookups of the same USDA/OFF item hit this instead of the external API.
    // Nulls (all custom foods) don't collide under a unique index, so this only constrains cached rows.
    uniqueIndex("foods_source_external_id_idx").on(table.source, table.externalId),
    index("foods_user_id_idx").on(table.userId),
    // GIN + gin_trgm_ops accelerates both ILIKE '%word%' substring search and
    // pg_trgm's similarity()/word_similarity() fuzzy matching, used together in
    // the search query for typo tolerance. Requires `CREATE EXTENSION pg_trgm`,
    // enabled once directly on the database (not managed by drizzle-kit).
    index("foods_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
  ],
);

// User-created recipes for quick-logging a repetitive dish (e.g. "Peanut Butter
// Sandwich"). Always personal — no public/shared recipes. Macros are computed on
// read by summing ingredients, never stored here, so editing an ingredient or a
// cached food's data can't leave a recipe's totals stale.
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    servings: real("servings").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("recipes_user_id_idx").on(table.userId),
    index("recipes_name_trgm_idx").using("gin", table.name.op("gin_trgm_ops")),
  ],
);

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipeId: uuid("recipe_id").notNull().references(() => recipes.id, { onDelete: "cascade" }),
    // Cascade, not restrict: a user's own custom foods are commonly referenced by
    // their own recipes, and RESTRICT here blocks deleting that user's account
    // entirely (Postgres checks the constraint before the parallel recipes->user
    // cascade path clears the reference) — verified live, not a rare edge case.
    // There's no deletion path for shared USDA/OFF foods today; if one is added,
    // guard that specific case at the application layer instead of a blanket RESTRICT.
    foodId: uuid("food_id").notNull().references(() => foods.id, { onDelete: "cascade" }),
    amount: real("amount").notNull(), // quantity of the food, in the food's base unit (g/ml)
    amountLabel: text("amount_label"), // display label, e.g. "2 tbsp"
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("recipe_ingredients_recipe_id_idx").on(table.recipeId)],
);

export const mealEnum = pgEnum("meal", ["Breakfast", "Lunch", "Dinner", "Snacks"]);

// The daily diary log. Snapshots its own macros at log time (like a custom food),
// with an optional food_id back-reference for provenance — editing or deleting the
// referenced food never changes a past day's numbers.
export const foodEntries = pgTable(
  "food_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    // set null, not cascade: losing the catalog link is harmless since the entry
    // already carries its own snapshot — unlike recipe_ingredients, nothing here
    // is derived from food_id at read time.
    foodId: uuid("food_id").references(() => foods.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    serving: text("serving").notNull(),
    meal: mealEnum("meal").notNull(),
    calories: real("calories").notNull(),
    protein: real("protein").notNull(),
    carbs: real("carbs").notNull(),
    fat: real("fat").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("food_entries_user_id_idx").on(table.userId),
    index("food_entries_user_id_logged_at_idx").on(table.userId, table.loggedAt),
  ],
);

// One row per user — goals aren't versioned/historical, just the current target.
export const macroGoals = pgTable("macro_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  calories: real("calories").notNull(),
  protein: real("protein").notNull(),
  carbs: real("carbs").notNull(),
  fat: real("fat").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
