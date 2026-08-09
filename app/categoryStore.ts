import { supabase } from "@/lib/supabase";
import { COURSES } from "./courses";

export type Category = {
  id: string;
  label: string;
  emoji: string;
  colour: string | null;
  sortOrder: number;
  archived: boolean;
};

export const fallbackCategories: Category[] = COURSES.map((course, index) => ({
  id: course.id,
  label: course.label,
  emoji: course.emoji ?? "",
  colour: course.colour ?? null,
  sortOrder: course.sortOrder ?? index,
  archived: course.archived ?? false,
}));

export function categoryDisplayLabel(category: Pick<Category, "label" | "emoji">) {
  return category.emoji ? `${category.label} ${category.emoji}` : category.label;
}

export async function loadCategories(syncCode: string) {
  if (!supabase) {
    console.warn("Failed to load categories: Supabase env vars are missing");
    return { ok: false, categories: [] as Category[] };
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id,label,emoji,colour,sort_order,archived")
    .eq("sync_code", syncCode)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("Failed to load categories from Supabase:", error);
    return { ok: false, categories: [] as Category[] };
  }

  const categories = (data || [])
    .map((row: Record<string, unknown>, index): Category => ({
      id: String(row.id ?? ""),
      label: String(row.label ?? ""),
      emoji: typeof row.emoji === "string" ? row.emoji : "",
      colour: typeof row.colour === "string" ? row.colour : null,
      sortOrder: typeof row.sort_order === "number" ? row.sort_order : index,
      archived: row.archived === true,
    }))
    .filter((category) => category.id && category.label);

  if (categories.length === 0) {
    console.warn("Supabase category load returned 0 categories. Falling back to app/courses.ts.");
    return { ok: false, categories: [] as Category[] };
  }

  return { ok: true, categories };
}
