import { listSampleRuns } from "@/lib/client-data";
import { PasteForm, type SampleOption } from "@/components/PasteForm";

export default async function RunFormPage() {
  const samples = await listSampleRuns();
  const options: SampleOption[] = samples.map((run) => ({
    id: run.id,
    label: `${run.clientName ?? "Untitled"} · ${run.callType === "kickoff" ? "Kick-off" : "Coaching"}`,
    callType: run.callType,
    transcript: run.transcript.lines.map((l) => l.raw).join("\n"),
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-ink">Run an evaluation</h1>
      <p className="mt-2 text-body">Score one call at a time against its rubric.</p>

      <div className="mt-8">
        <PasteForm samples={options} />
      </div>
    </div>
  );
}
