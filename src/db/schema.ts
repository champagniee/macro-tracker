import { pgTable, pgEnum, uuid, text, real, integer, boolean, jsonb, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  // Free-typed display name, not a unique handle. Defaults to the user's
  // first name at signup (Google's `given_name` claim, or a typed name on
  // the registration form) and stays editable from Settings afterward.
  name: text("name").notNull(),
  // Nullable — a Google-only account never sets one. Password login checks
  // for null explicitly rather than ever comparing against it.
  passwordHash: text("password_hash"),
  // Google's stable per-account subject id ("sub" in the id token). Nullable
  // — only set once a Google sign-in has happened for this row, whether the
  // account was created via Google or later linked from an existing
  // email/password account with a matching email.
  googleId: text("google_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const foodSourceEnum = pgEnum("food_source", ["usda", "openfoodfacts", "custom"]);
export const foodBaseUnitEnum = pgEnum("food_base_unit", ["g", "ml", "pcs"]);
// Cosmetic-only classification (icon + color in the UI) — nullable since there's
// no automatic source for it on every creation path (a manually hand-typed food
// with no LLM call involved has nothing to classify it). See
// src/lib/food-sources/categories.ts for the icon/color/label mapping.
export const foodCategoryEnum = pgEnum("food_category", [
  "meat",
  "seafood",
  "dairy_eggs",
  "fruit",
  "vegetable",
  "grain",
  "snack",
  "beverage",
  "dessert",
  "meal",
  "other",
]);

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
    category: foodCategoryEnum("category"),
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
    // Creator for source = 'custom' only; null for usda/openfoodfacts. Attribution
    // only, not an access-control field — every food is searchable/loggable by
    // every user regardless of who created it, same as the USDA/OFF cache rows.
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

// Records that a given (source, query) pair has actually been sent to USDA/Open
// Food Facts before, so /api/foods/search can skip re-fetching a source once
// it's genuinely already been asked — as opposed to the bug this replaces,
// which inferred "already covered" from whether any row in `foods` happened to
// match the current search, even one cached from a completely different query
// (e.g. "apple" appeared "covered" because "PINEAPPLE" contains that substring).
// Only written on a successful fetch — a failed/rate-limited attempt leaves no
// row, so the next search for that query retries instead of being locked out.
export const searchedQueries = pgTable(
  "searched_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    source: foodSourceEnum("source").notNull(),
    query: text("query").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("searched_queries_source_query_idx").on(table.source, table.query)],
);

// User-created recipes for quick-logging a repetitive dish (e.g. "Peanut Butter
// Sandwich"). Private by default; the owner can flip `isPublic` so other users
// can view/quick-log it too (see GET /api/recipes) — always owner-only to edit
// or delete regardless of visibility. Macros are computed on read by summing
// ingredients, never stored here, so editing an ingredient or a cached food's
// data can't leave a recipe's totals stale.
export const recipes = pgTable(
  "recipes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    servings: real("servings").notNull().default(1),
    isPublic: boolean("is_public").notNull().default(false),
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

// User-submitted bug reports/feedback from Settings — write-only from the
// app's side today (no admin UI yet), read directly via drizzle-kit studio
// or a DB client. Cascades with the user since a report with no owner left
// to follow up with isn't useful to keep.
export const issueReports = pgTable(
  "issue_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    description: text("description").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("issue_reports_user_id_idx").on(table.userId)],
);
