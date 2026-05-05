import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  XCircle
} from "lucide-react";
import { useMemo, useState } from "react";

const sampleTenderText = `Bidder shall have minimum annual turnover of INR 5 crore.
The firm should have at least 3 years of experience in similar work.
ISO 9001:2015 certification is mandatory.
MSME registration is desirable.`;

const sampleBidderData = `{
  "annualTurnover": "6 crore",
  "experienceYears": 2,
  "certifications": ["ISO 9001:2015"],
  "msmeRegistration": true
}`;

const navItems = [
  { id: "audit", label: "Audit", icon: ClipboardList },
  { id: "results", label: "Results", icon: BarChart3 },
  { id: "next-steps", label: "Next Steps", icon: Sparkles }
];

const statusStyles = {
  pass: {
    label: "Passed",
    icon: CheckCircle2,
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    border: "border-emerald-200",
    accent: "bg-emerald-500",
    panel: "bg-emerald-50/70"
  },
  fail: {
    label: "Failed",
    icon: XCircle,
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
    border: "border-rose-200",
    accent: "bg-rose-500",
    panel: "bg-rose-50/70"
  },
  review: {
    label: "Needs Review",
    icon: AlertTriangle,
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
    border: "border-amber-200",
    accent: "bg-amber-500",
    panel: "bg-amber-50/80"
  }
};

function classNames(...values) {
  return values.filter(Boolean).join(" ");
}

function downloadReport(report) {
  const download = report?.formattedReport?.download;

  if (!download?.markdown) {
    return;
  }

  const blob = new Blob([download.markdown], { type: download.mimeType || "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = download.fileName || "audit-report.md";
  link.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ card }) {
  const toneClasses = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    neutral: "border-slate-200 bg-white text-slate-800"
  };

  return (
    <div className={classNames("rounded-lg border p-4 shadow-sm", toneClasses[card.tone] || toneClasses.neutral)}>
      <div className="text-sm font-medium">{card.label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-normal">{card.value}</div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-float-in rounded-lg border border-sky-200 bg-sky-50 p-5">
      <div className="flex items-center gap-3 text-sky-900">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="font-semibold">Generating audit report</span>
      </div>
      <div className="mt-4 space-y-3">
        <div className="loading-track h-3 rounded-full animate-shimmer" />
        <div className="loading-track h-3 w-3/4 rounded-full animate-shimmer" />
        <div className="loading-track h-3 w-1/2 rounded-full animate-shimmer" />
      </div>
    </div>
  );
}

function CriterionCard({ card }) {
  const styles = statusStyles[card.status] || statusStyles.review;
  const StatusIcon = styles.icon;

  return (
    <article
      className={classNames(
        "animate-float-in overflow-hidden rounded-lg border bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-glow",
        styles.border
      )}
    >
      <div className={classNames("h-1.5", styles.accent)} />
      <div className="p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">{card.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">{card.explanation}</p>
          </div>
          <span className={classNames("inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ring-1", styles.badge)}>
            <StatusIcon className="h-4 w-4" />
            {card.statusLabel}
          </span>
        </div>
        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          {card.rows.map((row) => (
            <div key={row.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <dt className="text-xs font-semibold uppercase text-slate-500">{row.label}</dt>
              <dd className="mt-1 break-words text-sm font-medium text-slate-900">{String(row.value)}</dd>
            </div>
          ))}
        </dl>
        {card.nextSteps.length > 0 && (
          <div className={classNames("mt-5 rounded-lg border p-4", styles.panel, styles.border)}>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Sparkles className="h-4 w-4" />
              Suggested next steps
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
              {card.nextSteps.map((step) => (
                <li key={step} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{step}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </article>
  );
}

function App() {
  const [tenderText, setTenderText] = useState(sampleTenderText);
  const [bidderData, setBidderData] = useState(sampleBidderData);
  const [bidderName, setBidderName] = useState("Acme Supplies");
  const [useModel, setUseModel] = useState(false);
  const [file, setFile] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const formatted = report?.formattedReport;
  const reviewHighlights = formatted?.ui?.reviewHighlights || [];
  const criteriaCards = formatted?.ui?.criteriaCards || [];
  const summaryCards = formatted?.ui?.summaryCards || [];

  const overallStyle = useMemo(() => statusStyles[report?.overallStatus] || statusStyles.review, [report]);
  const OverallIcon = overallStyle.icon;

  async function submitAudit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("bidderData", bidderData);
      formData.append("bidderName", bidderName);
      formData.append("useModel", String(useModel));

      if (file) {
        formData.append("file", file);
      } else {
        formData.append("tenderText", tenderText);
      }

      const response = await fetch("/audit-report", {
        method: "POST",
        body: formData
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || payload.message || "Audit report generation failed.");
      }

      setReport(payload.auditReport);
      window.requestAnimationFrame(() => {
        document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#f6f8fb_34%,#f8fafc_100%)] text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-white/70 glass-panel px-5 py-6 lg:block">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-lg bg-slate-950 text-white shadow-lg">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <div className="text-sm font-semibold uppercase text-slate-500">CRPF Tender</div>
            <div className="text-lg font-bold text-slate-950">Audit Workbench</div>
          </div>
        </div>
        <nav className="mt-10 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white hover:text-slate-950 hover:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="absolute bottom-6 left-5 right-5 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <BadgeCheck className="h-4 w-4 text-emerald-600" />
            Ready for review
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">Upload a tender or paste text, then evaluate bidder eligibility in one pass.</p>
        </div>
      </aside>

      <main className="lg:pl-72">
        <header className="border-b border-white/70 glass-panel">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-3 py-1 text-sm font-semibold text-sky-800">
                <Sparkles className="h-4 w-4" />
                AI-assisted eligibility audit
              </div>
              <h1 className="mt-4 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">CRPF Tender Audit Dashboard</h1>
              <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">Evaluate bidder data against tender criteria and generate a polished, downloadable audit report.</p>
            </div>
            {report && (
              <button
                type="button"
                onClick={() => downloadReport(report)}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800"
              >
                <Download className="h-4 w-4" />
                Download Report
              </button>
            )}
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 sm:px-8 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <section id="audit" className="space-y-6">
            <form onSubmit={submitAudit} className="rounded-lg border border-white bg-white/90 p-5 shadow-glow">
              <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-950">Tender and bidder input</h2>
                  <p className="text-sm text-slate-500">Use a document upload or paste tender text directly.</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Bidder name</span>
                  <input
                    value={bidderName}
                    onChange={(event) => setBidderName(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder="Bidder name"
                  />
                </label>

                <label className="block rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-cyan-300 hover:bg-cyan-50/40">
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <UploadCloud className="h-4 w-4" />
                    Tender document
                  </span>
                  <input
                    type="file"
                    accept=".txt,.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                    className="mt-3 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
                  />
                  <p className="mt-2 text-sm text-slate-500">{file ? file.name : "No file selected. Pasted text below will be used."}</p>
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Tender text</span>
                  <textarea
                    value={tenderText}
                    onChange={(event) => setTenderText(event.target.value)}
                    rows={8}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder="Paste tender eligibility text"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">Bidder data JSON</span>
                  <textarea
                    value={bidderData}
                    onChange={(event) => setBidderData(event.target.value)}
                    rows={8}
                    className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-sm leading-6 text-slate-100 outline-none transition focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
                    placeholder='{"annualTurnover":"6 crore"}'
                  />
                </label>

                <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Use model extraction</div>
                    <div className="text-sm text-slate-500">Falls back to local parsing when model access is unavailable.</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setUseModel((value) => !value)}
                    className={classNames(
                      "relative h-8 w-14 rounded-full transition",
                      useModel ? "bg-emerald-500" : "bg-slate-300"
                    )}
                    aria-pressed={useModel}
                  >
                    <span
                      className={classNames(
                        "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
                        useModel ? "left-7" : "left-1"
                      )}
                    />
                  </button>
                </div>

                {error && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                  {loading ? "Running audit" : "Generate Audit Report"}
                </button>
              </div>
            </form>
          </section>

          <section id="results" className="space-y-6">
            {loading && <LoadingState />}

            {!loading && !report && (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg bg-cyan-50 text-cyan-700">
                  <BarChart3 className="h-7 w-7" />
                </div>
                <h2 className="mt-4 text-xl font-semibold text-slate-950">Results will appear here</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">Run the audit to see color-coded outcomes, reasons, and next steps.</p>
              </div>
            )}

            {report && (
              <div className="space-y-6">
                <div className="animate-float-in rounded-lg border border-white bg-white p-5 shadow-glow">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold uppercase text-slate-500">Final audit report</p>
                      <h2 className="mt-1 text-2xl font-semibold text-slate-950">{report.bidderName || "Bidder"}</h2>
                    </div>
                    <span className={classNames("inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ring-1", overallStyle.badge)}>
                      <OverallIcon className="h-4 w-4" />
                      {formatted?.ui?.overallStatusLabel || overallStyle.label}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {summaryCards.map((card) => (
                      <SummaryCard key={card.label} card={card} />
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  {criteriaCards.map((card) => (
                    <CriterionCard key={card.id} card={card} />
                  ))}
                </div>

                <div id="next-steps" className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
                  <div className="flex items-center gap-2 text-lg font-semibold text-amber-950">
                    <AlertTriangle className="h-5 w-5" />
                    Review focus
                  </div>
                  {reviewHighlights.length > 0 ? (
                    <div className="mt-4 space-y-4">
                      {reviewHighlights.map((item) => (
                        <div key={item.title} className="rounded-lg border border-amber-200 bg-white p-4">
                          <div className="font-semibold text-slate-950">{item.title}</div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{item.explanation}</p>
                          <ul className="mt-3 space-y-2 text-sm text-slate-700">
                            {item.nextSteps.map((step) => (
                              <li key={step} className="flex gap-2">
                                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                                <span>{step}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-amber-900">No criteria currently require manual review.</p>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
