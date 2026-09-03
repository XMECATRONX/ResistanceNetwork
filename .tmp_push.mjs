// Temporary push script using GitHub GitData REST API.
import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const TOKEN = process.env.GH_TOKEN;
const OWNER = "XMECATRONX";
const REPO = "ResistanceNetwork";
const BRANCH = "main";
const api = "https://api.github.com";

if (!TOKEN) { console.error("No token"); process.exit(1); }

const EXCLUDE = new Set(["node_modules", ".git", "dist", "build", "target", ".next"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (EXCLUDE.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else acc.push(p);
  }
  return acc;
}

const files = walk(".").map((p) => "./" + p.replace(/^\.\//, ""));
console.log("Files to push:", files.length);

async function gh(path, opts = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const res = await fetch(`${api}${path}`, {
      ...opts,
      headers: {
        Authorization: `token ${TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.headers || {}),
      },
    });
    const text = await res.text();
    if (res.status === 403 || res.status === 429) {
      const rl = res.headers.get("retry-after") || res.headers.get("x-ratelimit-reset");
      let wait = Math.min(60, 2000 * Math.pow(2, attempt));
      if (rl) {
        const secs = parseInt(rl, 10);
        if (!isNaN(secs) && secs > 0 && secs < 120) wait = secs * 1000 + 500;
      }
      console.log(`  rate-limited on ${path.split("/").pop()} (attempt ${attempt+1}), waiting ${Math.round(wait/1000)}s`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} ${path}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  }
  throw new Error(`Exhausted retries on ${path}`);
}

const branch = await gh(`/repos/${OWNER}/${REPO}/branches/${BRANCH}`);
const parentSha = branch.commit.sha;
console.log("Parent commit:", parentSha);

const CONC = 4;
let created = 0;
async function makeBlob(file) {
  const content = readFileSync(file);
  const b64 = content.toString("base64");
  const r = await gh(`/repos/${OWNER}/${REPO}/git/blobs`, {
    method: "POST",
    body: JSON.stringify({ content: b64, encoding: "base64" }),
  });
  created++;
  if (created % 20 === 0) console.log("blobs:", created, "/", files.length);
  // small delay to respect secondary rate limits
  await new Promise((res) => setTimeout(res, 250));
  return { path: file.replace(/^\.\//, ""), sha: r.sha };
}

const results = [];
const queue = [...files];
async function worker() {
  while (queue.length) {
    const f = queue.shift();
    results.push(await makeBlob(f));
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
console.log("All blobs created:", results.length);

const tree = results.map((r) => ({ path: r.path, mode: "100644", type: "blob", sha: r.sha }));
const treeRes = await gh(`/repos/${OWNER}/${REPO}/git/trees`, {
  method: "POST",
  body: JSON.stringify({ tree }),
});
console.log("Tree created:", treeRes.sha);

const commitRes = await gh(`/repos/${OWNER}/${REPO}/git/commits`, {
  method: "POST",
  body: JSON.stringify({
    message: "Cierre Bloque A: docs=código, claims alineados al código real\n\n- VERIFICATION.md reescrito como fuente única de verdad\n- README/frontend sin claims falsos (Move resources, transporte PQ total)\n- 85/85 tests en verde\n- Bloque A de auditoría directiva completado",
    tree: treeRes.sha,
    parents: [parentSha],
  }),
});
console.log("Commit created:", commitRes.sha);

await gh(`/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
  method: "PATCH",
  body: JSON.stringify({ sha: commitRes.sha, force: false }),
});
console.log("Ref updated. Push complete.");
console.log("Commit URL:", commitRes.html_url);
