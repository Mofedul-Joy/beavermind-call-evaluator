/**
 * Client-side wrappers around the recording-upload contract (`src/server/delivery.ts` and
 * its three routes). Mirrors `run-client.ts`'s shape: thin, typed, `{ok:true,...} |
 * {ok:false,message}`. Nothing here writes to the database directly — every call either
 * hits our own API routes or PUTs bytes straight to Supabase Storage with a short-lived
 * signed URL, per D2 (a Vercel function body caps out at 4.5 MB; a call recording routinely
 * doesn't).
 *
 * `MAX_RECORDING_BYTES` is a local constant rather than an import from
 * `src/server/delivery.ts` on purpose: that file also builds the server-only admin
 * Supabase client (secret key), and nothing in it should end up in a browser bundle. The
 * value is not a secret, so keeping two copies in sync by comment is enough.
 *
 * `uploadToSignedUrl` (the `@supabase/supabase-js` storage method this file uses to consume
 * the signed-URL triple) is implemented on top of `fetch`, which has no byte-level progress
 * event — that only exists on `XMLHttpRequest`. There is no real progress percentage to
 * report here, so `uploadRecording`'s callback reports *phase* (`uploading` then
 * `processing`), not a fake percentage. `UploadCapture` renders those as honest
 * indeterminate states, not a progress bar.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { DeliveryStatus, RunError } from "@/scoring/types";

/** Mirrors `src/server/delivery.ts`'s `MAX_RECORDING_BYTES` and the bucket's own
 *  `file_size_limit`. Supabase's per-object ceiling. */
export const MAX_RECORDING_BYTES = 52_428_800;

const RECORDINGS_BUCKET = "recordings";

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client, authenticated with the publishable key (`NEXT_PUBLIC_`-prefixed,
 *  safe to expose client-side). Its only job is `uploadToSignedUrl` against a token minted
 *  by our own API — RLS never grants this client anything else. */
function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
  return browserClient;
}

// ── Client-side validation, matching the server's ───────────────────────────────

export type ValidationError = "invalid_type" | "too_large";

/** Mirrors `upload-url/route.ts`'s checks. A courtesy, not the enforcement — the bucket's
 *  own `file_size_limit` / `allowed_mime_types` and the route's own checks still apply. */
export function validateRecording(file: File): ValidationError | null {
  if (!/^(audio|video)\//.test(file.type)) return "invalid_type";
  if (file.size > MAX_RECORDING_BYTES) return "too_large";
  return null;
}

export function describeValidationError(file: File, err: ValidationError): string {
  if (err === "invalid_type")
    return `"${file.name}" isn't an audio or video file. Upload a Zoom, Fathom or Fireflies export.`;
  return `"${file.name}" is ${(file.size / 1_048_576).toFixed(1)} MB. Recordings are capped at 50 MB.`;
}

// ── The three-step flow, as three callable steps ────────────────────────────────

export type UploadTarget = { path: string; token: string; signedUrl: string };

export type GetUploadUrlResult = ({ ok: true } & UploadTarget) | { ok: false; message: string };

export async function getUploadUrl(
  runId: string,
  input: { filename: string; contentType: string; sizeBytes: number },
): Promise<GetUploadUrlResult> {
  const res = await fetch(`/api/runs/${runId}/recording/upload-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, message: body?.error ?? `Could not start the upload (${res.status}).` };
  }
  return { ok: true, path: body.path, token: body.token, signedUrl: body.signedUrl };
}

/** What every delivery route hands back, mirrored from `src/server/delivery.ts`. */
export type DeliveryState = {
  recordingFilename: string | null;
  deliveryStatus: DeliveryStatus;
  deliveryError: RunError | null;
};

export type CompleteUploadResult = ({ ok: true } & DeliveryState) | { ok: false; message: string };

export async function completeUpload(
  runId: string,
  input: { path: string; filename: string },
): Promise<CompleteUploadResult> {
  const res = await fetch(`/api/runs/${runId}/recording/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    return { ok: false, message: body?.error ?? `Could not complete the upload (${res.status}).` };
  }
  return { ok: true, ...(body as DeliveryState) };
}

// ── The whole flow, given a File ─────────────────────────────────────────────────

export type UploadPhase = "uploading" | "processing";

export type UploadRecordingResult = ({ ok: true } & DeliveryState) | { ok: false; message: string };

/**
 * Signed URL → PUT to Storage → tell the server it landed. `onPhaseChange` fires once per
 * phase transition, not per byte (see file header — there is no real progress to report).
 */
export async function uploadRecording(
  runId: string,
  file: File,
  onPhaseChange?: (phase: UploadPhase) => void,
): Promise<UploadRecordingResult> {
  const invalid = validateRecording(file);
  if (invalid) return { ok: false, message: describeValidationError(file, invalid) };

  const target = await getUploadUrl(runId, {
    filename: file.name,
    contentType: file.type,
    sizeBytes: file.size,
  });
  if (!target.ok) return target;

  onPhaseChange?.("uploading");
  const { error } = await supabaseBrowser()
    .storage.from(RECORDINGS_BUCKET)
    .uploadToSignedUrl(target.path, target.token, file, { contentType: file.type });
  if (error) return { ok: false, message: `The upload to storage failed: ${error.message}` };

  onPhaseChange?.("processing");
  return completeUpload(runId, { path: target.path, filename: file.name });
}
