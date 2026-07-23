#!/usr/bin/env node
/**
 * Read backend/.env.production and emit Cloud Run runtime env YAML.
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

const SKIP_RUNTIME_KEYS = new Set([
  "GOOGLE_APPLICATION_CREDENTIALS",
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
  if (/^[a-zA-Z0-9_./:@,-]+$/.test(value)) return `"${value}"`;
  const escaped = value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
  return `"${escaped}"`;
}

function main() {
  if (!fs.existsSync(prodPath)) {
    console.error("Missing backend/.env.production. Create it from .env.example first.");
    process.exit(1);
  }

  const vars = parseEnvFile(fs.readFileSync(prodPath, "utf8"));
  vars.set("ENVIRONMENT", vars.get("ENVIRONMENT") || "production");

  fs.mkdirSync(deployDir, { recursive: true });

  const lines = ["# Generated from .env.production - do not commit"];
  const keys = [...vars.keys()].filter((key) => !SKIP_RUNTIME_KEYS.has(key)).sort();
  for (const key of keys) {
    const value = vars.get(key) ?? "";
    if (value === "") continue;
    lines.push(`${key}: ${yamlQuote(value)}`);
  }
  fs.writeFileSync(runtimeOut, `${lines.join("\n")}\n`, "utf8");

  console.log(`Wrote ${path.relative(root, runtimeOut)} (${keys.length} runtime vars)`);
  console.log("GCS: omit GOOGLE_APPLICATION_CREDENTIALS on Cloud Run; grant the service account bucket access.");
}

main();
