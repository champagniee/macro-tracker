import { CATEGORY_META, type FoodCategory } from "@/lib/food-sources/categories";

interface CategoryBadgeProps {
  category: FoodCategory | null;
  size?: number;
}

// Small colored icon badge for a food's category — shared between the Add
// Food sheet's search results and the recipe ingredient picker (FoodSearchInput)
// so both stay visually identical instead of duplicating the styling. A null
// category (USDA/OFF results, or a hand-typed food with no LLM classification)
// falls back to the neutral "other" icon rather than an inconsistent blank
// space in the row.
export function CategoryBadge({ category, size = 28 }: CategoryBadgeProps) {
  const meta = CATEGORY_META[category ?? "other"];
  const Icon = meta.icon;

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, backgroundColor: `${meta.color}1a`, color: meta.color }}
      title={meta.label}
    >
      <Icon size={Math.round(size * 0.55)} strokeWidth={2.25} />
    </div>
  );
}
