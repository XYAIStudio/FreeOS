import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const forbiddenDirectories = new Set([".git", ".idea", ".hvigor", "node_modules", "oh_modules", "dist", "build", "coverage", "uploads", "backups"]);
const forbiddenExtensions = [".db", ".sqlite", ".sqlite3", ".bak", ".log", ".pem", ".key", ".p12", ".pfx", ".zip", ".tar", ".tgz", ".gz"];
const textExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".json", ".json5", ".md", ".yml", ".yaml", ".sh", ".ps1", ".env"]);
const policyAllowlist = new Set([
  "TRADEMARKS.md",
  "docs/governance/HUMAN_MACHINE_SOURCE_BOUNDARY.md",
  "docs/governance/OPEN_SOURCE_RELEASE_GATE.md",
  "docs/governance/RELEASE_CHECKLIST.md",
  "docs/governance/IP_ASSET_REGISTER_TEMPLATE.md",
  "docs/open-source-scope.md",
]);
const confidentialTerms = [/h2a2a2h/i, /governancesession/i, /taskround/i, /accessscope/i, /authoritychain/i, /humanworkitem/i, /aiworkitem/i, /decisionscope/i, /knowledge_snapshot_id/i];
const findings = [];

function isGitIgnored(relative) {
  return spawnSync("git", ["check-ignore", "-q", "--", relative], {
    cwd: root,
    stdio: "ignore",
  }).status === 0;
}

function visit(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.relative(root, absolute).replaceAll("\\", "/");
    if (isGitIgnored(relative)) continue;
    if (entry.isDirectory()) {
      if (!forbiddenDirectories.has(entry.name)) visit(absolute);
      continue;
    }

    const lower = entry.name.toLowerCase();
    if (lower.startsWith(".env") && lower !== ".env.example") findings.push(`${relative}: local environment file`);
    if (forbiddenExtensions.some(extension => lower.endsWith(extension))) findings.push(`${relative}: forbidden runtime, secret, or archive file`);
    if (!textExtensions.has(path.extname(lower)) && lower !== ".env.example") continue;

    const value = fs.readFileSync(absolute, "utf8");
    const patterns = [
      [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/, "private key"],
      [/\b(?:sk|ghp|github_pat|AKIA|tp)-[A-Za-z0-9_-]{16,}\b/, "credential-like token"],
      [/@deepseek-ai\/|@xyai\//, "unpublished private package import"],
    ];
    for (const [pattern, label] of patterns) {
      if (pattern.test(value)) findings.push(`${relative}: ${label}`);
    }

    if (relative !== "scripts/verify-open-source.mjs" && !policyAllowlist.has(relative) && confidentialTerms.some(pattern => pattern.test(value))) {
      findings.push(`${relative}: confidential-method identifier`);
    }

    if (!relative.includes("test-") && /password\s*:\s*["'][^"'$<]{6,}["']/i.test(value)) {
      findings.push(`${relative}: hard-coded password-like value`);
    }
  }
}

visit(root);
if (findings.length) {
  console.error("Open-source verification failed:\n" + findings.map(item => `- ${item}`).join("\n"));
  process.exit(1);
}
console.log("Open-source verification passed: no forbidden runtime artifacts or known credential patterns found.");
