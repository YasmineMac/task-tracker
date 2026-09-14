export type MedicationEntryType = "input" | "observation";
export type MedicationKind = "Vyvanse" | "Prozac" | "Coffee" | "Custom";
export type FeelingValence = "positive" | "neutral" | "negative";
export type FeelingIntensity = "low" | "medium" | "high";
export type FeelingDaypart = "morning" | "noon" | "afternoon" | "evening" | "night";

export type MedicationEntry = {
  id: string;
  entryType: MedicationEntryType;
  timestamp: string;
  medication?: string | null;
  amount?: number | null;
  unit?: string | null;
  feeling?: string | null;
  valence?: FeelingValence | null;
  intensity?: FeelingIntensity | null;
  daypart?: FeelingDaypart | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ENTRY_TYPES = new Set<MedicationEntryType>(["input", "observation"]);
const VALENCES = new Set<FeelingValence>(["positive", "neutral", "negative"]);
const INTENSITIES = new Set<FeelingIntensity>(["low", "medium", "high"]);
const DAYPARTS = new Set<FeelingDaypart>(["morning", "noon", "afternoon", "evening", "night"]);

export function createMedicationEntryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isValidMedicationUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export function isMedicationEntryType(value: unknown): value is MedicationEntryType {
  return typeof value === "string" && ENTRY_TYPES.has(value as MedicationEntryType);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function optionalValence(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && VALENCES.has(value as FeelingValence)
    ? (value as FeelingValence)
    : undefined;
}

function optionalIntensity(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && INTENSITIES.has(value as FeelingIntensity)
    ? (value as FeelingIntensity)
    : undefined;
}

function optionalDaypart(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return typeof value === "string" && DAYPARTS.has(value as FeelingDaypart)
    ? (value as FeelingDaypart)
    : undefined;
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export function normalizeMedicationEntry(value: unknown): MedicationEntry | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = raw.id;
  const entryType = raw.entryType;
  const timestamp = typeof raw.timestamp === "string" ? raw.timestamp : "";
  const parsedTimestamp = Date.parse(timestamp);
  const valence = optionalValence(raw.valence);
  const intensity = optionalIntensity(raw.intensity);
  const daypart = optionalDaypart(raw.daypart);

  if (
    !isValidMedicationUuid(id) ||
    !isMedicationEntryType(entryType) ||
    !timestamp ||
    !Number.isFinite(parsedTimestamp) ||
    valence === undefined ||
    intensity === undefined ||
    daypart === undefined
  ) {
    return null;
  }

  const medication = optionalString(raw.medication);
  const amount = optionalNumber(raw.amount);
  const unit = optionalString(raw.unit);
  const feeling = optionalString(raw.feeling);

  if (entryType === "input" && !medication) return null;
  if (entryType === "observation" && !feeling) return null;

  return {
    id,
    entryType,
    timestamp,
    medication: entryType === "input" ? medication : null,
    amount: entryType === "input" ? amount : null,
    unit: entryType === "input" ? unit : null,
    feeling: entryType === "observation" ? feeling : null,
    valence: entryType === "observation" ? valence : null,
    intensity: entryType === "observation" ? intensity : null,
    daypart: entryType === "observation" ? daypart : null,
    metadata: normalizeMetadata(raw.metadata),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}
