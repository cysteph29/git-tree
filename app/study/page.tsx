import { notFound } from "next/navigation";
import { AestheticStudy } from "./study";

export const dynamic = "force-dynamic";

export default function StudyPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AestheticStudy />;
}
