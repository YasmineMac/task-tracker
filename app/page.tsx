export const metadata = {
  title:
    process.env.NEXT_PUBLIC_DEMO_MODE === "true"
      ? "Task Tracker Playground"
      : "Yasmine's Tracker",
};


import MinimalTaskTracker from "./MinimalTaskTracker";

export default function Page() {
  return <MinimalTaskTracker />;
}
