import { readFileSync } from 'node:fs';

/**
 * Renders an `npm audit --json` report as Markdown for the GitHub Actions job
 * summary. Never exits non-zero, so it cannot mask the real gate
 * (`npm audit --audit-level=...`) that runs before it.
 */

const SEVERITY_ORDER = ['critical', 'high', 'moderate', 'low', 'info'];
const severityRank = (severity) => SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(severity);

const [, , reportPath = 'audit.json'] = process.argv;

let report;
try {
  // Strip a UTF-8 BOM: npm on Windows can emit one, and JSON.parse rejects it.
  const raw = readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '');
  report = JSON.parse(raw);
} catch (error) {
  console.log(`_No audit report available (${error.message})._`);
  process.exit(0);
}

const counts = report.metadata?.vulnerabilities ?? {};
const total = counts.total ?? 0;
const rows = Object.entries(report.vulnerabilities ?? {}).sort(
  ([, a], [, b]) => severityRank(b.severity) - severityRank(a.severity),
);

const icon = total === 0 ? '✅' : (counts.critical ?? 0) + (counts.high ?? 0) > 0 ? '❌' : '⚠️';

console.log(`## ${icon} Dependency audit\n`);
console.log(
  `**${total}** ${total === 1 ? 'finding' : 'findings'} — ` +
    `${counts.critical ?? 0} critical, ${counts.high ?? 0} high, ` +
    `${counts.moderate ?? 0} moderate, ${counts.low ?? 0} low\n`,
);

if (rows.length === 0) {
  console.log('No vulnerabilities reported.');
} else {
  console.log('| Package | Severity | Direct | Fix |');
  console.log('| --- | --- | --- | --- |');
  for (const [name, entry] of rows) {
    const fix = entry.fixAvailable;
    const fixText =
      fix === false
        ? 'none available'
        : typeof fix === 'object'
          ? `${fix.name}@${fix.version}${fix.isSemVerMajor ? ' (breaking)' : ''}`
          : 'n/a';
    console.log(`| \`${name}\` | ${entry.severity} | ${entry.isDirect ? 'yes' : 'no'} | ${fixText} |`);
  }
}
