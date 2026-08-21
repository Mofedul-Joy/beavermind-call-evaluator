import "server-only";
import { headers } from "next/headers";
import type { Run, RunSummary } from "@/scoring/types";
import fixtureRuns from "@/fixtures/runs.json";

const USE_FIXTURES = process.env.NEXT_PUBLIC_USE_FIXTURES === "1";

async function baseUrl(): Promise<string> {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

function toSummary(run: Run): RunSummary {
  return {
    id: run.id,
    callType: run.callType,
    status: run.status,
    coachName: run.coachName,
    clientName: run.clientName,
    isSample: run.isSample,
    createdAt: run.createdAt,
    score: run.report?.trace.normalised ?? null,
    band: run.report?.trace.band.name ?? null,
    costUsd: run.cost?.usd ?? null,
  };
}

export async function listRuns(): Promise<RunSummary[]> {
  if (USE_FIXTURES) {
    const runs = fixtureRuns as unknown as Run[];
    return [...runs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(toSummary);
  }
  const res = await fetch(`${await baseUrl()}/api/runs`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to load runs (${res.status})`);
  return res.json();
}

export async function getRun(id: string): Promise<Run | null> {
  if (USE_FIXTURES) {
    const runs = fixtureRuns as unknown as Run[];
    return runs.find((r) => r.id === id) ?? null;
  }
  const res = await fetch(`${await baseUrl()}/api/runs/${id}`, { cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Failed to load run (${res.status})`);
  return res.json();
}

export async function listSampleRuns(): Promise<Run[]> {
  if (USE_FIXTURES) return fixtureRuns as unknown as Run[];
  const summaries = await listRuns();
  const samples = summaries.filter((s) => s.isSample);
  const runs = await Promise.all(samples.map((s) => getRun(s.id)));
  return runs.filter((r): r is Run => r !== null);
}
