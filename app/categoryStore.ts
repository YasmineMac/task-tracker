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

function categoryFromRow(row: Record<string, unknown>, index = 0): Category {
  return {
    id: String(row.id ?? ""),
    label: String(row.label ?? ""),
    emoji: typeof row.emoji === "string" ? row.emoji : "",
    colour: typeof row.colour === "string" ? row.colour : null,
    sortOrder: typeof row.sort_order === "number" ? row.sort_order : index,
    archived: row.archived === true,
  };
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
    .map((row: Record<string, unknown>, index) => categoryFromRow(row, index))
    .filter((category) => category.id && category.label);

  if (categories.length === 0) {
    console.warn("Supabase category load returned 0 categories. Falling back to app/courses.ts.");
    return { ok: false, categories: [] as Category[] };
  }

  return { ok: true, categories };
}

export async function createCategory(
  syncCode: string,
  category: Pick<Category, "id" | "label" | "emoji" | "colour" | "sortOrder">
) {
  if (!supabase) {
    console.warn("Failed to create category: Supabase env vars are missing");
    return { ok: false, category: null as Category | null };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      id: category.id,
      sync_code: syncCode,
      label: category.label,
      emoji: category.emoji,
      colour: category.colour,
      sort_order: category.sortOrder,
      archived: false,
    })
    .select("id,label,emoji,colour,sort_order,archived")
    .single();

  if (error) {
    console.warn("Failed to create category in Supabase:", error);
    return { ok: false, category: null };
  }

  return { ok: true, category: categoryFromRow(data as Record<string, unknown>) };
}

export async function updateCategory(
  syncCode: string,
  id: string,
  changes: Pick<Category, "label" | "emoji" | "colour">
) {
  if (!supabase) {
    console.warn("Failed to update category: Supabase env vars are missing");
    return { ok: false, category: null as Category | null };
  }

  const { data, error } = await supabase
    .from("categories")
    .update({
      label: changes.label,
      emoji: changes.emoji,
      colour: changes.colour,
    })
    .eq("sync_code", syncCode)
    .eq("id", id)
    .select("id,label,emoji,colour,sort_order,archived")
    .single();

  if (error) {
    console.warn("Failed to update category in Supabase:", error);
    return { ok: false, category: null };
  }

  return { ok: true, category: categoryFromRow(data as Record<string, unknown>) };
}
