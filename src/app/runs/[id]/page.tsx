import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRun } from "@/lib/client-data";
import { callTypeLabel } from "@/lib/format";
import { RunPageClient } from "./RunPageClient";

export async function generateMetadata({ params }: PageProps<"/runs/[id]">): Promise<Metadata> {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return { title: "Report not found" };
  const score = run.status === "done" && run.report ? run.report.trace.normalised : null;
  return {
    title: run.clientName ?? "Untitled call",
    description:
      score === null
        ? `${callTypeLabel(run.callType)} call, scored against its rubric.`
        : `${callTypeLabel(run.callType)} call scored ${score}/100 against its rubric.`,
  };
}

export default async function RunPage({ params }: PageProps<"/runs/[id]">) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();
  return <RunPageClient initialRun={run} />;
}
