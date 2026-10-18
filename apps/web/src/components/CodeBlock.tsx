export function CodeBlock({ code, language }: { code: string; language?: string }) {
  // Safe rendering: code is shown as text in <pre>, never executed or injected as HTML.
  return <div className="overflow-hidden rounded-xl border border-navy-800 bg-navy-950">
    {language && <div className="border-b border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{language}</div>}
    <pre className="codeblock overflow-x-auto p-4 text-[13px] leading-relaxed text-slate-100"><code>{code}</code></pre>
  </div>;
}
