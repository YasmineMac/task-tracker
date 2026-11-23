import { createMedicationEntryId, normalizeMedicationEntry, type MedicationEntry } from "./medicationTypes";

export type QuickSignal = "Vyvanse" | "Prozac" | "Creatine";
export type SignalCoffee = { drinkId: string; label: string; mg: number; shots?: number };
export type SignalBatch = {
  version: 1;
  entries: { entry: MedicationEntry; status: "pending" | "saved" | "failed" }[];
};

export function caffeineMgForShots(preset: { mg: number; shots?: number }, shots?: number) {
  return Math.round(preset.mg * (shots ?? 1));
}

export function createSignalBatch(
  timestamp: string,
  selected: QuickSignal[],
  creatineGrams: number,
  coffee: SignalCoffee | null,
  createId = createMedicationEntryId
): SignalBatch {
  if (!Number.isFinite(Date.parse(timestamp))) throw new Error("Choose a valid date and time.");
  if (selected.includes("Creatine") && (!Number.isFinite(creatineGrams) || creatineGrams <= 0)) {
    throw new Error("Enter a positive Creatine quantity in grams.");
  }
  if (coffee && (!Number.isFinite(coffee.mg) || coffee.mg <= 0)) throw new Error("Enter a positive caffeine amount.");
  const entries: MedicationEntry[] = [...new Set(selected)].map((medication) => ({
    id: createId(), entryType: "input", timestamp, medication,
    amount: medication === "Vyvanse" ? 30 : medication === "Prozac" ? 20 : creatineGrams,
    unit: medication === "Creatine" ? "g" : "mg", metadata: { source: "signals_multi" },
  }));
  if (coffee) entries.push({
    id: createId(), entryType: "input", timestamp, medication: "Coffee", amount: coffee.mg, unit: "mg",
    metadata: { source: "signals_multi_caffeine", drinkType: coffee.drinkId, drinkLabel: coffee.label,
      size: "M", shots: coffee.shots ?? null, note: null },
  });
  if (!entries.length) throw new Error("Select at least one signal.");
  // Match the existing numeric(10,3) column without silently rounding entered amounts.
  if (entries.some((entry) => !Number.isFinite(entry.amount) || entry.amount! > 9999999.999 || Math.abs(entry.amount! * 1000 - Math.round(entry.amount! * 1000)) > 0.00001)) {
    throw new Error("Amounts must fit within 7 digits and 3 decimal places.");
  }
  return { version: 1, entries: entries.map((entry) => ({ entry, status: "pending" })) };
}

export function parseSignalBatch(raw: string | null): SignalBatch | null {
  if (!raw) return null;
  const value = JSON.parse(raw) as SignalBatch;
  if (value.version !== 1 || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 4) {
    throw new Error("Invalid pending signals.");
  }
  const ids = new Set<string>();
  const substances = new Set<string>();
  let timestamp: string | undefined;
  for (const item of value.entries) {
    const entry = normalizeMedicationEntry(item.entry);
    if (!entry || entry.entryType !== "input" || !["Vyvanse", "Prozac", "Creatine", "Coffee"].includes(entry.medication ?? "") ||
      !["pending", "saved", "failed"].includes(item.status) || ids.has(entry.id) || substances.has(entry.medication!) ||
      (timestamp && entry.timestamp !== timestamp) || !(entry.amount! > 0) ||
      entry.unit !== (entry.medication === "Creatine" ? "g" : "mg") ||
      entry.metadata?.source !== (entry.medication === "Coffee" ? "signals_multi_caffeine" : "signals_multi")) {
      throw new Error("Invalid pending signals.");
    }
    ids.add(entry.id);
    substances.add(entry.medication!);
    timestamp = entry.timestamp;
  }
  return value;
}

export async function saveSignalBatch(
  batch: SignalBatch,
  save: (entry: MedicationEntry) => Promise<boolean>,
  onProgress: (batch: SignalBatch) => void
): Promise<SignalBatch> {
  let current = batch;
  for (let index = 0; index < current.entries.length; index++) {
    if (current.entries[index].status === "saved") continue;
    let saved = false;
    try { saved = await save(current.entries[index].entry); } catch { /* An uncertain result retries the same UUID. */ }
    current = { ...current, entries: current.entries.map((item, i) => i === index ? { ...item, status: saved ? "saved" : "failed" } : item) };
    onProgress(current);
  }
  return current;
}
