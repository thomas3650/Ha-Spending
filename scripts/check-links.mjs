// Check the relative links and `@path` imports in the repo's Markdown docs.
//
// Usage: `node scripts/check-links.mjs`
//
// Reads `CLAUDE.md`, `README.md`, every `docs/**/*.md` and `addon/*.md`. Each relative link target, and each line
// that is only `@<path>` (a Claude Code import), must exist, resolved against the file's own folder. Links with a
// scheme (`https:`, `mailto:` ...) and pure `#anchor` links are skipped, and so is anything in a fenced code block
// or an inline code span. Prints each missing target and exits 1 if there is one.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const FENCE = /^\s*(```|~~~)/;
const CODE_SPAN = /`[^`]*`/g;
const LINK = /\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const IMPORT = /^@(\S+)$/;
const SCHEME = /^[a-zA-Z][a-zA-Z0-9+.-]*:/;

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function markdownIn(folder, recursive) {
  const path = join(ROOT, folder);
  if (!existsSync(path)) {
    return [];
  }
  return readdirSync(path, { recursive })
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(path, name))
    .filter(isFile)
    .sort();
}

function markdownFiles() {
  const files = [join(ROOT, "CLAUDE.md"), join(ROOT, "README.md")].filter(isFile);
  return [...files, ...markdownIn("docs", true), ...markdownIn("addon", false)];
}

function* targets(text) {
  let inFence = false;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const imported = IMPORT.exec(line.trim());
    if (imported) {
      yield [index + 1, imported[1]];
      continue;
    }
    for (const link of line.replace(CODE_SPAN, "").matchAll(LINK)) {
      yield [index + 1, link[1]];
    }
  }
}

function* missing(path) {
  for (const [number, target] of targets(readFileSync(path, "utf8"))) {
    if (SCHEME.test(target) || target.startsWith("#")) {
      continue;
    }
    const [file] = target.split("#", 1);
    if (!existsSync(join(dirname(path), file))) {
      yield `${relative(ROOT, path).split(sep).join("/")}:${number}: ${target}`;
    }
  }
}

const problems = markdownFiles().flatMap((path) => [...missing(path)]);
for (const problem of problems) {
  process.stdout.write(`${problem}\n`);
}
process.exitCode = problems.length > 0 ? 1 : 0;
