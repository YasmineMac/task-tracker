export const metadata = {
  title:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? "Task Tracker Playground"
      : "Yasmine's Tracker",
};

export default function StudentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
