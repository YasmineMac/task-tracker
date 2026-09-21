export type AlcoholEntry = {
  id: string;
  signalType: "alcohol";
  drinkType: string;
  quantity: number;
  startedAt: string;
  endedAt?: string | null;
  alcoholUnits?: number | null;
  feelingsSymptoms?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createAlcoholEntryId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function isValidAlcoholEntryUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function positiveNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function nullableMetadata(value: unknown) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return undefined;
}

export function normalizeAlcoholEntry(value: unknown): AlcoholEntry | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const id = raw.id;
  const signalType = raw.signalType;
  const drinkType = typeof raw.drinkType === "string" ? raw.drinkType.trim() : "";
  const quantity = positiveNumber(raw.quantity);
  const startedAt = typeof raw.startedAt === "string" ? raw.startedAt : "";
  const endedAt = raw.endedAt === null || raw.endedAt === undefined ? null : String(raw.endedAt);
  const alcoholUnits = positiveNumber(raw.alcoholUnits);
  const feelingsSymptoms = nullableMetadata(raw.feelingsSymptoms);
  const startedAtMs = Date.parse(startedAt);
  const endedAtMs = endedAt ? Date.parse(endedAt) : null;

  if (
    !isValidAlcoholEntryUuid(id) ||
    signalType !== "alcohol" ||
    !drinkType ||
    quantity === null ||
    quantity === undefined ||
    !Number.isFinite(startedAtMs) ||
    (endedAtMs !== null && (!Number.isFinite(endedAtMs) || endedAtMs < startedAtMs)) ||
    alcoholUnits === undefined ||
    feelingsSymptoms === undefined
  ) {
    return null;
  }

  return {
    id,
    signalType: "alcohol",
    drinkType,
    quantity,
    startedAt,
    endedAt,
    alcoholUnits,
    feelingsSymptoms,
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : undefined,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
  };
}
