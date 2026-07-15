"use client";


import { useEffect, useState, type CSSProperties } from "react";

const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

type Student = {
  "Student code": number;
  "Student Name": string;
  Nationality?: string;
  Studio?: string;
  Gender?: string;
  "Seminar 1"?: string;
  "Seminar 2"?: string;
  Workshop?: string;
  [key: string]: string | number | undefined;
};

function Donut({
  value,
  total,
  size = 120,
  stroke = 14,
  color = "#111",
  track = "rgba(0,0,0,0.10)",
}: {
  value: number;
  total: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  const dash = c * pct;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </g>
      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ fontSize: 16, fontWeight: 700, fill: "#111" }}
      >
        {Math.round(pct * 100)}%
      </text>
    </svg>
  );
}

function GenderDonut({
  male,
  female,
  size = 140,
  stroke = 14,
}: {
  male: number;
  female: number;
  size?: number;
  stroke?: number;
}) {
  const total = male + female;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  const maleDash = total ? (male / total) * c : 0;
  const femaleDash = c - maleDash;

  return (
    <svg width={size} height={size}>
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        {/* Female (background segment) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#db2777"
          strokeWidth={stroke}
          strokeDasharray={`${femaleDash} ${maleDash}`}
          strokeDashoffset={-maleDash}
        />

        {/* Male (foreground segment) */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2563eb"
          strokeWidth={stroke}
          strokeDasharray={`${maleDash} ${femaleDash}`}
          strokeLinecap="round"
        />
      </g>

      <text
        x="50%"
        y="50%"
        dominantBaseline="middle"
        textAnchor="middle"
        style={{ fontSize: 14, fontWeight: 700, fill: "#111" }}
      >
        {Math.round((male / total) * 100)}% M
      </text>
    </svg>
  );
}


export default function StudentsPage() {
  const [studentRows, setStudentRows] = useState<Student[]>([]);

  useEffect(() => {
    if (isDemoMode) return;

    import("../data/students.json")
      .then((module) => setStudentRows(module.default as Student[]))
      .catch((error) => console.warn("Failed to load students data:", error));
  }, []);

  // helper: build dropdown options from a field
  const getOptions = (key: string) =>
    Array.from(new Set(studentRows.map((s) => s[key])))
      .filter(Boolean)
      .map(String)
      .sort();

const countBy = (rows: Student[], key: string) => {
  const map = new Map<string, number>();
  for (const r of rows) {
    const v = String(r[key] ?? "").trim();
    if (!v) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
};

const groupBy = (rows: Student[], key: string) => {
  const map = new Map<string, Student[]>();
  for (const r of rows) {
    const v = String(r[key] ?? "").trim();
    if (!v) continue;
    map.set(v, [...(map.get(v) ?? []), r]);
  }
  return Array.from(map.entries());
};


  // dropdown option lists
  const nationalities = getOptions("Nationality");
  const studentnames = getOptions("Student Name");
  const studios = getOptions("Studio");
  const seminar1 = getOptions("Seminar 1");
  const seminar2 = getOptions("Seminar 2");
  const workshops = getOptions("Workshop");

  // selected filters (state)
  const [selectedNationality, setSelectedNationality] = useState("All");
  const [selectedStudentName, setSelectedStudentName] = useState("All");
  const [selectedStudio, setSelectedStudio] = useState("All");
  const [selectedSeminar1, setSelectedSeminar1] = useState("All");
  const [selectedSeminar2, setSelectedSeminar2] = useState("All");
  const [selectedWorkshop, setSelectedWorkshop] = useState("All");

  const [selectedStudentCode, setSelectedStudentCode] = useState<number | null>(null);

  if (isDemoMode) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.title}>Students</div>
          <div style={styles.subtitle}>Unavailable in the public playground.</div>
        </div>
      </div>
    );
  }

//Reset button
const resetFilters = () => {
  setSelectedNationality("All");
  setSelectedStudentName("All");
  setSelectedStudio("All");
  setSelectedSeminar1("All");
  setSelectedSeminar2("All");
  setSelectedWorkshop("All");
};


  // filtered list

  const filtered = studentRows.filter((s) => {

    const matchNationality =
      selectedNationality === "All" || s.Nationality === selectedNationality;

    const matchStudentName = 
      selectedStudentName === "All" || s["Student Name"] === selectedStudentName;

    const matchStudio = 
      selectedStudio === "All" || s.Studio === selectedStudio;

    const matchSeminar1 =
      selectedSeminar1 === "All" || s["Seminar 1"] === selectedSeminar1;

    const matchSeminar2 =
      selectedSeminar2 === "All" || s["Seminar 2"] === selectedSeminar2;

    const matchWorkshop =
      selectedWorkshop === "All" || s.Workshop === selectedWorkshop;

    return (
      matchNationality && 
      matchStudentName && 
      matchStudio && 
      matchSeminar1 && 
      matchSeminar2 && 
      matchWorkshop
    );
  });

  const genderByStudio = groupBy(filtered, "Studio").map(
  ([studio, rows]) => ({
    studio,
    counts: countBy(rows, "Gender"),
  })
);

const countsByGender = countBy(filtered, "Gender");

const maleCount =
  countsByGender.find(([g]) => String(g).toLowerCase() === "male")?.[1] ?? 0;

const femaleCount =
  countsByGender.find(([g]) => String(g).toLowerCase() === "female")?.[1] ?? 0;

const totalGender = maleCount + femaleCount;


    // alphabatise
const sorted = [...filtered].sort((a, b) =>
  String(a["Student Name"] || "").localeCompare(String(b["Student Name"] || ""))
);

const countsByNationality = countBy(filtered, "Nationality");
const countsByStudio = countBy(filtered, "Studio");
const countsBySeminar1 = countBy(filtered, "Seminar 1");



  const selectedStudent =
    selectedStudentCode !== null
      ? studentRows.find((s) => s["Student code"] === selectedStudentCode)
      : null;


// Page interface

  return (
  <div style={styles.page}>
    <div style={styles.header}>
      <div>
        <div style={styles.title}>Students</div>
        <div style={styles.subtitle}>
          {filtered.length} shown · {studentRows.length} total
        </div>
      </div>

      <button onClick={resetFilters} style={styles.resetBtn} type="button">
        Reset
      </button>
    </div>

    <div style={styles.grid}>
      {/* LEFT PANEL */}
      <aside style={styles.left}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Filters</div>

          <div style={styles.filtersGrid}>
            <label style={styles.field}>
              <div style={styles.label}>Nationality</div>
              <select
                style={styles.select}
                value={selectedNationality}
                onChange={(e) => setSelectedNationality(e.target.value)}
              >
                <option value="All">All</option>
                {nationalities.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <div style={styles.label}>Student</div>
              <select
                style={styles.select}
                value={selectedStudentName}
                onChange={(e) => setSelectedStudentName(e.target.value)}
              >
                <option value="All">All</option>
                {studentnames.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <div style={styles.label}>Studio</div>
              <select
                style={styles.select}
                value={selectedStudio}
                onChange={(e) => setSelectedStudio(e.target.value)}
              >
                <option value="All">All</option>
                {studios.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <div style={styles.label}>Seminar 1</div>
              <select
                style={styles.select}
                value={selectedSeminar1}
                onChange={(e) => setSelectedSeminar1(e.target.value)}
              >
                <option value="All">All</option>
                {seminar1.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <div style={styles.label}>Seminar 2</div>
              <select
                style={styles.select}
                value={selectedSeminar2}
                onChange={(e) => setSelectedSeminar2(e.target.value)}
              >
                <option value="All">All</option>
                {seminar2.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>

            <label style={styles.field}>
              <div style={styles.label}>Workshop</div>
              <select
                style={styles.select}
                value={selectedWorkshop}
                onChange={(e) => setSelectedWorkshop(e.target.value)}
              >
                <option value="All">All</option>
                {workshops.map((n: string) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardTitle}>By studio</div>

          <div style={{ display: "grid", gap: 8 }}>
            {countsByStudio.map(([label, count]) => (
              <div key={label} style={styles.barRow}>
                <div style={styles.barLabel}>{label}</div>
                <div style={styles.barTrack}>
                  <div
                    style={{
                      ...styles.barFill,
                      width: `${filtered.length ? (count / filtered.length) * 100 : 0}%`,
                    }}
                  />
                </div>
                <div style={styles.barValue}>{count}</div>
              </div>
            ))}
          </div>
        </div>

     <div style={styles.card}>
  <div style={styles.cardTitle}>Gender balance</div>

  {(() => {
    const male =
      countsByGender.find(([k]) => String(k).toLowerCase() === "male")?.[1] ?? 0;

    const female =
      countsByGender.find(([k]) => String(k).toLowerCase() === "female")?.[1] ?? 0;

    return (
      <div style={{ display: "grid", justifyItems: "center", gap: 12 }}>
        <GenderDonut male={male} female={female} />

        <div style={{ display: "flex", gap: 16, fontSize: 12, opacity: 0.8 }}>
          <span>Male: {male}</span>
          <span>Female: {female}</span>
          <span>Total: {male + female}</span>
        </div>
      </div>
    );
  })()}
</div>




        {selectedStudent && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Profile</div>
            <div style={styles.profileName}>{selectedStudent["Student Name"]}</div>
            <div style={styles.profileLine}>Nationality: {selectedStudent.Nationality}</div>
            <div style={styles.profileLine}>Studio: {selectedStudent.Studio}</div>
            <div style={styles.profileLine}>Seminar 1: {selectedStudent["Seminar 1"]}</div>
            <div style={styles.profileLine}>Seminar 2: {selectedStudent["Seminar 2"]}</div>
            <div style={styles.profileLine}>Workshop: {selectedStudent.Workshop}</div>

            <button
              type="button"
              style={styles.clearBtn}
              onClick={() => setSelectedStudentCode(null)}
            >
              Clear selection
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT PANEL */}
      <main style={styles.right}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Students</div>

          <div style={styles.list}>
            {sorted.map((s) => {
              const isActive = selectedStudentCode === s["Student code"];
              return (
                <button
                  key={s["Student code"]}
                  type="button"
                  onClick={() => setSelectedStudentCode(s["Student code"])}
                  style={{
                    ...styles.row,
                    ...(isActive ? styles.rowActive : null),
                  }}
                >
                  <div style={styles.rowMain}>{s["Student Name"]}</div>
                  <div style={styles.rowMeta}>
                    {s.Nationality} · {s.Studio}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  </div>
);
}



const styles: Record<string, CSSProperties> = {
  page: {
    padding: 24,
    maxWidth: 1200,
    margin: "0 auto",
    fontFamily: "system-ui",
    background: "#fff",
    color: "#111",
  },
  header: {
    display: "flex",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: { fontSize: 22, fontWeight: 700, letterSpacing: -0.2 },
  subtitle: { fontSize: 12, opacity: 0.65, marginTop: 4 },
  resetBtn: {
    fontSize: 12,
    padding: "8px 12px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    cursor: "pointer",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 16,
    alignItems: "start",
  },
  left: { position: "sticky", top: 16, display: "grid", gap: 16 },
  right: { minWidth: 0 },
  card: {
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 16,
    padding: 14,
    background: "#fff",
  },
  cardTitle: { fontSize: 12, fontWeight: 700, opacity: 0.7, marginBottom: 10 },
  filtersGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 10 },
  field: { display: "grid", gap: 6 },
  label: { fontSize: 12, opacity: 0.7 },
  select: {
    width: "100%",
    padding: "10px 10px",
    borderRadius: 12,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    fontSize: 13,
  },
  barRow: { display: "grid", gridTemplateColumns: "1fr 140px 28px", gap: 10, alignItems: "center" },
  barLabel: { fontSize: 12, opacity: 0.9, lineHeight: 1.2 },
  barTrack: {
    height: 8,
    borderRadius: 999,
    background: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 999, background: "rgba(0,0,0,0.35)" },
  barValue: { fontSize: 12, textAlign: "right", opacity: 0.8 },
  list: { display: "grid", gap: 6, marginTop: 6 },
  row: {
    textAlign: "left",
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.08)",
    background: "#fff",
    cursor: "pointer",
  },
  rowActive: { border: "1px solid rgba(0,0,0,0.22)", background: "rgba(0,0,0,0.03)" },
  rowMain: { fontSize: 14, fontWeight: 600, letterSpacing: -0.1 },
  rowMeta: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  profileName: { fontSize: 15, fontWeight: 700, marginBottom: 8 },
  profileLine: { fontSize: 13, opacity: 0.85, marginBottom: 4, lineHeight: 1.35 },
  clearBtn: {
    marginTop: 10,
    fontSize: 12,
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "#fff",
    cursor: "pointer",
  },
};
