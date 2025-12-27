"use client";

import dynamic from "next/dynamic";

const MinimalTaskTracker = dynamic(() => import("./MinimalTaskTracker"), {
  ssr: false,
});

export default function Home() {
  return <MinimalTaskTracker />;
}
