import { notFound } from "next/navigation";
import { getRun } from "@/lib/client-data";
import { RunPageClient } from "./RunPageClient";

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  return <RunPageClient initialRun={run} />;
}
