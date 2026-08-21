import { notFound } from "next/navigation";
import { getRun } from "@/lib/client-data";
import { embeddedFontFaces } from "@/lib/embedded-fonts";
import { ReportView } from "@/components/ReportView";
import { callTypeLabel, formatDate } from "@/lib/format";

export default async function PrintPage({ params }: PageProps<"/print/[id]">) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) notFound();

  return (
    <div className="text-[#111111]" style={{ fontFamily: "SwitzerPDF, ui-sans-serif, system-ui, sans-serif" }}>
      <style
        dangerouslySetInnerHTML={{
          __html: `
          ${embeddedFontFaces()}
          @page { size: A4; margin: 16mm 15mm; }
          html, body { background: #ffffff; margin: 0; }
          #print-root code, #print-root pre { font-family: 'GeistMonoPDF', ui-monospace, monospace; }
          #print-root h1 { break-after: avoid; }
          #print-root [id^="dim-"] { break-inside: avoid; }
          #print-root { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        `,
        }}
      />
      <div id="print-root" style={{ padding: "10mm 12mm", fontSize: 12.5, lineHeight: 1.55 }}>
        <p style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8A8680", margin: 0 }}>
          Full analysis · {callTypeLabel(run.callType)} call
        </p>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", margin: "4px 0 0" }}>
          {run.clientName ?? "Untitled call"}
        </h1>
        <p style={{ fontSize: 12, color: "#57534E", margin: "4px 0 0" }}>
          {run.coachName ? `Coached by ${run.coachName}` : null}
          {run.finishedAt ? `${run.coachName ? " · " : ""}Evaluated ${formatDate(run.finishedAt)}` : null}
        </p>

        <div style={{ marginTop: 20 }}>
          {run.report ? (
            <ReportView report={run.report} print />
          ) : (
            <p style={{ color: "#57534E" }}>This run has no finished report to print yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
