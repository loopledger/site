// Copies the published schema and vocabularies from a loopledger checkout so their IRIs resolve on loopledger.org.
// Usage: node scripts/build.mjs <path-to-loopledger>
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const src = process.argv[2];
if (!src) throw new Error("usage: node scripts/build.mjs <path-to-loopledger>");
const VERSION = "v0.1";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const page = (title, body, extraHead = "") => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · LoopLedger</title>${extraHead}
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:46rem;margin:0 auto;padding:2rem max(16px,env(safe-area-inset-left,0px));color:#15211c;background:#eef1ee}
a{color:#1d6b4c}code{font:0.9em ui-monospace,Menlo,monospace}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:.35rem .5rem;border-bottom:1px solid #c9d1cb;vertical-align:top}
@media (prefers-color-scheme:dark){body{color:#e3ebe5;background:#101814}a{color:#5fbf92}td,th{border-color:#2b3a33}}</style></head>
<body><p><a href="/">LoopLedger</a></p>${body}</body></html>
`;
const write = (path, text) => { mkdirSync(join(path, ".."), { recursive: true }); writeFileSync(path, text); };

const schemaDir = join(src, "packages/spec/schema");
mkdirSync(`schema/${VERSION}`, { recursive: true });
for (const f of readdirSync(schemaDir)) copyFileSync(join(schemaDir, f), `schema/${VERSION}/${f}`);

write(`ns/${VERSION}/index.html`, page(`Namespace ${VERSION}`, `<h1>LoopLedger namespace ${VERSION}</h1>
<p>Terms in <code>https://loopledger.org/ns/${VERSION}#</code> are defined by the JSON-LD context
<a href="/schema/${VERSION}/context.jsonld"><code>/schema/${VERSION}/context.jsonld</code></a> and the
<a href="/schema/${VERSION}/passport.schema.json">passport</a> and <a href="/schema/${VERSION}/event.schema.json">event</a> schemas.</p>
<p>Source: <a href="https://github.com/loopledger/loopledger/tree/main/packages/spec">packages/spec</a>.</p>`));

const vocabDir = join(src, "packages/vocab");
for (const f of readdirSync(vocabDir).filter((f) => f.endsWith(".jsonld"))) {
  const v = JSON.parse(readFileSync(join(vocabDir, f), "utf8"));
  const s = v.scheme;
  const base = new URL(v["@id"]).pathname.slice(1);
  write(`${base}/${s}.jsonld`, readFileSync(join(vocabDir, f), "utf8"));
  const refs = (t) => (t.external_refs ?? []).filter((r) => r !== "none").map((r) => `<a href="${esc(r)}">${esc(r.split("/").pop())}</a>`).join("<br>") || "none";
  const rows = v.terms.map((t) => `<tr id="${esc(t.term_id)}"><td><code>${esc(t.term_id)}</code></td><td>${esc(t.label)}</td><td>${refs(t)}</td><td>${esc(t.status)}</td></tr>`).join("\n");
  write(`${base}/index.html`, page(`${s} v${v.version}`, `<h1>Vocabulary: <code>${esc(s)}</code> v${esc(v.version)}</h1>
<p>Machine-readable: <a href="${s}.jsonld"><code>${esc(s)}.jsonld</code></a>. Source: <a href="https://github.com/loopledger/loopledger/tree/main/packages/vocab">packages/vocab</a>.</p>
<div style="overflow-x:auto"><table><thead><tr><th>Term</th><th>Label</th><th>External refs</th><th>Status</th></tr></thead><tbody>
${rows}</tbody></table></div>`));
  for (const t of v.terms) {
    const target = `/${base}/#${t.term_id}`;
    write(`vocab/${s}/${t.term_id}/index.html`, page(`${s}/${t.term_id}`, `<h1><code>${esc(s)}/${esc(t.term_id)}</code></h1>
<p>${esc(t.label)} (${esc(t.status)}). See it in <a href="${target}">${esc(s)} v${esc(v.version)}</a>.</p>`, `<link rel="canonical" href="https://loopledger.org/vocab/${s}/${t.term_id}">`));
  }
}
