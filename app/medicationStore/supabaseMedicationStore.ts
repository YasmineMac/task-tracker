import { supabase } from "@/lib/supabase";
import {
  isValidMedicationUuid,
  normalizeMedicationEntry,
  type MedicationEntry,
} from "./medicationTypes";

type MedicationEntryRow = Record<string, unknown>;

function medicationEntryFromRow(row: MedicationEntryRow) {
  return normalizeMedicationEntry({
    id: row.id,
    entryType: row.entry_type,
    timestamp: row.occurred_at,
    medication: row.medication,
    amount: row.amount,
    unit: row.unit,
    feeling: row.feeling,
    valence: row.valence,
    intensity: row.intensity,
    daypart: row.daypart,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function medicationEntryPayload(entry: MedicationEntry, syncCode: string) {
  return {
    id: entry.id,
    sync_code: syncCode,
    entry_type: entry.entryType,
    occurred_at: entry.timestamp,
    medication: entry.entryType === "input" ? entry.medication ?? null : null,
    amount: entry.entryType === "input" ? entry.amount ?? null : null,
    unit: entry.entryType === "input" ? entry.unit ?? null : null,
    feeling: entry.entryType === "observation" ? entry.feeling ?? null : null,
    valence: entry.entryType === "observation" ? entry.valence ?? null : null,
    intensity: entry.entryType === "observation" ? entry.intensity ?? null : null,
    daypart: entry.entryType === "observation" ? entry.daypart ?? null : null,
    metadata: entry.metadata ?? {},
  };
}

export async function loadMedicationEntries(syncCode: string) {
  if (!supabase) {
    console.warn("Skipped medication entry load: Supabase env vars are missing");
    return { ok: false, entries: [] as MedicationEntry[] };
  }

  const { data, error } = await supabase
    .from("medication_entries")
    .select(
      [
        "id",
        "entry_type",
        "occurred_at",
        "medication",
        "amount",
        "unit",
        "feeling",
        "valence",
        "intensity",
        "daypart",
        "metadata",
        "created_at",
        "updated_at",
      ].join(",")
    )
    .eq("sync_code", syncCode)
    .order("occurred_at", { ascending: false });

  if (error) {
    console.warn("Failed to load medication entries from Supabase:", error);
    return { ok: false, entries: [] as MedicationEntry[] };
  }

  const rows = (data ?? []) as unknown as MedicationEntryRow[];
  const entries = rows
    .map((row) => medicationEntryFromRow(row))
    .filter((entry): entry is MedicationEntry => Boolean(entry));

  if (entries.length !== rows.length) {
    console.warn("Skipped invalid medication rows while loading from Supabase", {
      received: rows.length,
      normalized: entries.length,
    });
  }

  return { ok: true, entries };
}

export async function saveMedicationEntry(entry: MedicationEntry, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped medication entry save: Supabase env vars are missing");
    return false;
  }

  const normalizedEntry = normalizeMedicationEntry(entry);

  if (!normalizedEntry) {
    console.warn("Skipped medication entry save: entry failed normalization", { id: entry.id });
    return false;
  }

  const { error } = await supabase
    .from("medication_entries")
    .upsert(medicationEntryPayload(normalizedEntry, syncCode), { onConflict: "id" });

  if (error) {
    console.warn("Failed to save medication entry to Supabase:", {
      operation: "upsert",
      id: normalizedEntry.id,
      error,
    });
    return false;
  }

  return true;
}

export async function updateMedicationEntry(entry: MedicationEntry, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped medication entry update: Supabase env vars are missing");
    return false;
  }

  const normalizedEntry = normalizeMedicationEntry(entry);

  if (!normalizedEntry) {
    console.warn("Skipped medication entry update: entry failed normalization", { id: entry.id });
    return false;
  }

  const { data, error } = await supabase
    .from("medication_entries")
    .update(medicationEntryPayload(normalizedEntry, syncCode))
    .eq("sync_code", syncCode)
    .eq("id", normalizedEntry.id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Failed to update medication entry in Supabase:", {
      operation: "update",
      id: normalizedEntry.id,
      error,
    });
    return false;
  }

  if (!data) {
    console.warn("Skipped medication entry update: no matching row was updated", { id: normalizedEntry.id });
    return false;
  }

  return true;
}

export async function deleteMedicationEntry(id: string, syncCode: string) {
  if (!supabase) {
    console.warn("Skipped medication entry delete: Supabase env vars are missing");
    return false;
  }

  if (!isValidMedicationUuid(id)) {
    console.warn("Skipped medication entry delete: id is not a Supabase-compatible UUID", { id });
    return false;
  }

  const { data, error } = await supabase
    .from("medication_entries")
    .delete()
    .eq("sync_code", syncCode)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.warn("Failed to delete medication entry from Supabase:", {
      operation: "delete",
      id,
      error,
    });
    return false;
  }

  if (!data) {
    console.warn("Skipped medication entry delete: no matching row was deleted", { id });
    return false;
  }

  return true;
}
