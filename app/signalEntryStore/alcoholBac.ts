import type { AlcoholEntry } from "./alcoholEntryTypes";

export const BAC_PROFILE = {
  weightKg: 70,
  distributionFactor: 0.55,
  eliminationPercentPerHour: 0.015,
} as const;

export const UK_UNIT_ETHANOL_GRAMS = 7.89;
export const BAC_POINT_ABSORPTION_MINUTES = 30;
export const BAC_SESSION_GAP_HOURS = 8;
export const BAC_SAMPLE_MINUTES = 5;

export type EstimatedBacSample = {
  timestamp: number;
  bac: number;
};

type BacDose = {
  startMs: number;
  endMs: number;
  ethanolGrams: number;
};

function normalizedDose(entry: AlcoholEntry): BacDose | null {
  if (typeof entry.alcoholUnits !== "number" || !Number.isFinite(entry.alcoholUnits) || entry.alcoholUnits <= 0) {
    return null;
  }

  const startMs = Date.parse(entry.startedAt);
  if (!Number.isFinite(startMs)) return null;
  const parsedEndMs = entry.endedAt ? Date.parse(entry.endedAt) : NaN;
  const endMs = Number.isFinite(parsedEndMs) && parsedEndMs > startMs
    ? parsedEndMs
    : startMs + BAC_POINT_ABSORPTION_MINUTES * 60 * 1000;

  return {
    startMs,
    endMs,
    // Stored alcohol units are UK units: 10 ml ethanol × 0.789 g/ml = 7.89 g.
    ethanolGrams: entry.alcoholUnits * UK_UNIT_ETHANOL_GRAMS,
  };
}

function gramsToBacPercent(grams: number) {
  // Widmark-style estimate using the fixed V1 profile (female r = 0.55, 70 kg).
  return (grams / (BAC_PROFILE.distributionFactor * BAC_PROFILE.weightKg * 1000)) * 100;
}

export function calculateEstimatedBacSeries(
  entries: AlcoholEntry[],
  rangeStart: number,
  rangeEnd: number
): EstimatedBacSample[] {
  if (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeEnd <= rangeStart) return [];

  const doses = entries.map(normalizedDose).filter((dose): dose is BacDose => Boolean(dose));
  if (!doses.length) return [
    { timestamp: rangeStart, bac: 0 },
    { timestamp: rangeEnd, bac: 0 },
  ];

  const stepMs = BAC_SAMPLE_MINUTES * 60 * 1000;
  const simulationStart = Math.min(rangeStart, ...doses.map((dose) => dose.startMs));
  const samples: EstimatedBacSample[] = [];
  let bac = 0;
  let previousMs = simulationStart;

  if (simulationStart >= rangeStart) samples.push({ timestamp: simulationStart, bac: 0 });

  for (let timestamp = simulationStart + stepMs; timestamp < rangeEnd; timestamp += stepMs) {
    const elapsedHours = (timestamp - previousMs) / 3_600_000;
    const absorbedGrams = doses.reduce((sum, dose) => {
      const overlapStart = Math.max(previousMs, dose.startMs);
      const overlapEnd = Math.min(timestamp, dose.endMs);
      if (overlapEnd <= overlapStart) return sum;
      return sum + dose.ethanolGrams * ((overlapEnd - overlapStart) / (dose.endMs - dose.startMs));
    }, 0);

    bac = Math.max(
      0,
      bac + gramsToBacPercent(absorbedGrams) - BAC_PROFILE.eliminationPercentPerHour * elapsedHours
    );
    if (timestamp >= rangeStart) samples.push({ timestamp, bac });
    previousMs = timestamp;
  }

  const finalElapsedHours = (rangeEnd - previousMs) / 3_600_000;
  const finalAbsorbedGrams = doses.reduce((sum, dose) => {
    const overlapStart = Math.max(previousMs, dose.startMs);
    const overlapEnd = Math.min(rangeEnd, dose.endMs);
    if (overlapEnd <= overlapStart) return sum;
    return sum + dose.ethanolGrams * ((overlapEnd - overlapStart) / (dose.endMs - dose.startMs));
  }, 0);
  bac = Math.max(
    0,
    bac + gramsToBacPercent(finalAbsorbedGrams) - BAC_PROFILE.eliminationPercentPerHour * finalElapsedHours
  );
  samples.push({ timestamp: rangeEnd, bac });

  return samples;
}

export function groupAlcoholSessions(entries: AlcoholEntry[]) {
  const validEntries = entries
    .filter((entry) => Number.isFinite(Date.parse(entry.startedAt)))
    .slice()
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const sessions: AlcoholEntry[][] = [];
  const gapMs = BAC_SESSION_GAP_HOURS * 60 * 60 * 1000;

  validEntries.forEach((entry) => {
    const current = sessions[sessions.length - 1];
    if (!current || Date.parse(entry.startedAt) - Date.parse(current[current.length - 1].startedAt) > gapMs) {
      sessions.push([entry]);
    } else {
      current.push(entry);
    }
  });

  return sessions;
}

export function estimatedSessionClearanceTime(entries: AlcoholEntry[]) {
  const doses = entries.map(normalizedDose).filter((dose): dose is BacDose => Boolean(dose));
  if (!doses.length) return null;
  const totalPotentialBac = gramsToBacPercent(doses.reduce((sum, dose) => sum + dose.ethanolGrams, 0));
  const lastAbsorptionEnd = Math.max(...doses.map((dose) => dose.endMs));
  return lastAbsorptionEnd + (totalPotentialBac / BAC_PROFILE.eliminationPercentPerHour) * 3_600_000;
}

export function alcoholSessionAbsorptionBounds(entries: AlcoholEntry[]) {
  const doses = entries.map(normalizedDose).filter((dose): dose is BacDose => Boolean(dose));
  if (!doses.length) return null;
  return {
    startMs: Math.min(...doses.map((dose) => dose.startMs)),
    endMs: Math.max(...doses.map((dose) => dose.endMs)),
  };
}
