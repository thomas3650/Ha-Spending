// Fails the build when `dist/index.html` points anywhere but `./web/`: under Ingress the site lives at a changing
// prefix, so every asset URL must be relative, and the add-on serves the assets at `web/` only. It also fails when a
// file in `dist/web/` has no content hash in its name, because the server lets the browser keep those for a year.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";

const index = fileURLToPath(new URL("../dist/index.html", import.meta.url));
if (!existsSync(index)) throw new Error(`${index} is missing; did the build run?`);

const html = readFileSync(index, "utf-8");
const urls = [...html.matchAll(/\s(?:src|href)\s*=\s*["']([^"']*)["']/g)].map((match) => match[1]);
if (urls.length === 0) throw new Error(`${index} has no src or href; the build looks broken`);

const wrong = urls.filter((url) => !url.startsWith("./web/"));
if (wrong.length > 0) throw new Error(`${index} has URLs outside ./web/: ${wrong.join(", ")}`);

const webDir = fileURLToPath(new URL("../dist/web/", import.meta.url));
const entries = existsSync(webDir) ? readdirSync(webDir, { withFileTypes: true }) : [];
if (entries.length === 0) throw new Error(`${webDir} is empty or missing; the build looks broken`);

const nested = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
if (nested.length > 0) throw new Error(`${webDir} has subfolders, which this check does not read: ${nested.join(", ")}`);

const unhashed = entries.filter((entry) => !/-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(entry.name)).map((entry) => entry.name);
if (unhashed.length > 0) throw new Error(`${webDir} has files without a content hash: ${unhashed.join(", ")}`);
