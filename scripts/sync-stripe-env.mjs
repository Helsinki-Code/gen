#!/usr/bin/env node
/**
 * Run from amrogen/ root: forwards to backend/scripts/sync-stripe-env.mjs
 *
 *   node scripts/sync-stripe-env.mjs
 *   node scripts/sync-stripe-env.mjs --ensure-prices
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendScript = path.resolve(__dirname, "..", "backend", "scripts", "sync-stripe-env.mjs");

const result = spawnSync(process.execPath, [backendScript, ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: path.resolve(__dirname, "..", "backend"),
});

process.exit(result.status ?? 1);
