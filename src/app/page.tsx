import Link from "next/link";
import { listRuns } from "@/lib/client-data";
import { EvaluationsTable } from "@/components/EvaluationsTable";

export default async function Home() {
  const runs = await listRuns();

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="micro-label">Evaluations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-ink">Call evaluations</h1>
        </div>
        <Link
          href="/run"
          className="pill-primary inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium hover:opacity-85"
        >
          Run an evaluation
        </Link>
      </div>

      <div className="mt-8">
        <EvaluationsTable runs={runs} />
      </div>
    </div>
  );
}
