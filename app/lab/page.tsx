import { notFound } from "next/navigation";
import { PerformanceLab } from "./performance-lab";

export const dynamic = "force-dynamic";

export default function LabPage() {
  if (process.env.TREE_PERF_LAB !== "1") notFound();
  return <PerformanceLab />;
}
