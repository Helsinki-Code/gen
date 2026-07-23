#!/usr/bin/env node
/**
 * Read frontend/.env.production and emit Cloud Run deploy artifacts (gitignored).
 * - deploy/env.cloudrun.yaml: runtime env for `gcloud run deploy --env-vars-file`
 * - deploy/cloudrun-build-public.vars: NEXT_PUBLIC_* values baked into `next build`
 *
 * Does not print secret values.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const prodPath = path.join(root, ".env.production");
const deployDir = path.join(root, "deploy");
const runtimeOut = path.join(deployDir, "env.cloudrun.yaml");
const buildOut = path.join(deployDir, "cloudrun-build-public.vars");

const SKIP_RUNTIME_KEYS = new Set([
  "PORT",
  "HOSTNAME",
  "K_SERVICE",
  "K_REVISION",
  "K_CONFIGURATION",
]);

function parseEnvFile(content) {
  const vars = new Map();
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars.set(key, value);
  }
  return vars;
}

function yamlQuote(value) {
  if (value === "") return '""';
  if (/^[a-zA-Z0-9_./:@-]+$/.test(value)) return `"${value}"`;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function shouldSkipRuntime(key) {
  if (SKIP_RUNTIME_KEYS.has(key)) return true;
  if (key.startsWith("NEXT_PUBLIC_")) return true;
  return false;
}

function main() {
  if (!fs.existsSync(prodPath)) {
    console.error("Missing frontend/.env.production. Copy from .env.example and set values.");
    process.exit(1);
  }

  const vars = parseEnvFile(fs.readFileSync(prodPath, "utf8"));
  vars.set("NODE_ENV", "production");

  const required = ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SITE_URL"];
  const missing = required.filter((key) => !vars.get(key));
  if (missing.length > 0) {
    console.error(`Missing required keys in .env.production: ${missing.join(", ")}`);
    process.exit(1);
  }

  fs.mkdirSync(deployDir, { recursive: true });

  const runtimeLines = ["# Generated from .env.production - do not commit"];
  const runtimeKeys = [...vars.keys()].filter((key) => !shouldSkipRuntime(key)).sort();
  for (const key of runtimeKeys) {
    const value = vars.get(key) ?? "";
    if (value === "") continue;
    runtimeLines.push(`${key}: ${yamlQuote(value)}`);
  }

  const backendUrl = vars.get("NEXT_PUBLIC_API_URL")?.trim();
  if (backendUrl && !vars.has("AMROGEN_BACKEND_URL")) {
    runtimeLines.push(`AMROGEN_BACKEND_URL: ${yamlQuote(backendUrl)}`);
  }
  fs.writeFileSync(runtimeOut, `${runtimeLines.join("\n")}\n`, "utf8");

  const buildLines = ["NODE_ENV=production"];
  for (const [key, value] of [...vars.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (key.startsWith("NEXT_PUBLIC_")) {
      buildLines.push(`${key}=${value}`);
    }
  }
  fs.writeFileSync(buildOut, `${buildLines.join("\n")}\n`, "utf8");

  const examplePath = path.join(deployDir, "cloudrun-build-public.vars.example");
  fs.writeFileSync(
    examplePath,
    "NODE_ENV=production\nNEXT_PUBLIC_API_URL=https://YOUR-API-URL.run.app\nNEXT_PUBLIC_APP_URL=https://amrogen.com\nNEXT_PUBLIC_SITE_URL=https://amrogen.com\n",
    "utf8"
  );

  console.log(`Wrote ${path.relative(root, runtimeOut)} (${runtimeKeys.length} runtime vars)`);
  console.log(`Wrote ${path.relative(root, buildOut)} (${buildLines.length - 1} NEXT_PUBLIC vars)`);
}

main();
