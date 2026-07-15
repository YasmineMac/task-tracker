export type Course = { id: string; label: string };

const privateCourses: Course[] = [
  { id: "robotics_studio", label: "Robotics Studio 🌱" },
  { id: "computational_design", label: "Computational Design 🪲" },
  { id: "thesis", label: "Thesis 🦋" },
  { id: "the_yas_project", label: "The Yas Project ❄️" },
  { id: "project_vernacular", label: "Project Vernacular 🌳" },
  { id: "project_bloomberg", label: "Project Bloomberg 📈" },
];

const demoCourses: Course[] = [
  { id: "studio_work", label: "Studio Work" },
  { id: "design_research", label: "Design Research" },
  { id: "thesis", label: "Capstone" },
  { id: "practice", label: "Practice" },
  { id: "field_notes", label: "Field Notes" },
  { id: "client_project", label: "Client Project" },
];

export const COURSES: Course[] =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" ? demoCourses : privateCourses;
