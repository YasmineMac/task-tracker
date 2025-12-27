export type Course = {
  id: string
  name: string
  ects: number
  colour: string
  notes?: string
}

export const courses: Course[] = [
  {
    id: "studio",
    name: "Studio",
    ects: 18,
    colour: "#111827", // near-black
    notes: "Main design studio"
  },
  {
    id: "seminar",
    name: "Seminar",
    ects: 6,
    colour: "#374151",
    notes: "Theory + writing"
  },
  {
    id: "elective",
    name: "Elective",
    ects: 6,
    colour: "#6B7280"
  }
]

