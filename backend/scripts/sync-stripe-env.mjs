#!/usr/bin/env node
/**
 * Sync Stripe keys into AmroGen env files.
 * Run with --ensure-prices to create/fetch GBP one-time 10-campaign pack prices.
 * Run with --force-prices to create new pack prices even if old IDs exist.
 *
 *   node scripts/sync-stripe-env.mjs
 *   node scripts/sync-stripe-env.mjs --ensure-prices
 *   node scripts/sync-stripe-env.mjs --force-prices
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");
const amrogenRoot = path.resolve(backendRoot, "..");
const repoRoot = path.resolve(amrogenRoot, "..");

const TARGET_FILES = [
  path.join(backendRoot, ".env.local"),
  path.join(backendRoot, ".env.production"),
  path.join(amrogenRoot, ".env.local"),
  path.join(amrogenRoot, ".env.production"),
];

const ACADEMY_ENV = path.join(repoRoot, "academy", ".env.local");

/** 10-campaign packs (one-time GBP). */
const PLANS = [
  {
    key: "STRIPE_PRICE_STARTER",
    name: "AmroGen Starter 10-Campaign Pack",
    planId: "starter",
    amount: 539900, // £5,399 (list £5,999 − 10%)
    credits: 80,
    campaigns: 10,
  },
  {
    key: "STRIPE_PRICE_PROFESSIONAL",
    name: "AmroGen Professional 10-Campaign Pack",
    planId: "professional",
    amount: 2549200, // £25,492 (list £29,990 − 15%)
    credits: 80,
    campaigns: 10,
  },
  {
    key: "STRIPE_PRICE_ENTERPRISE",
    name: "AmroGen Enterprise 10-Campaign Pack",
    planId: "enterprise",
    amount: 3999200, // £39,992 (list £49,990 − 20%)
    credits: 80,
    campaigns: 10,
  },
];

const STRIPE_KEYS = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_PROFESSIONAL",
  "STRIPE_PRICE_ENTERPRISE",
  // Cleared on sync so old names do not linger
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_SCALE",
];

function parseEnv(content) {
  const map = new Map();
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).trim(), trimmed.slice(eq + 1).trim());
  }
  return map;
}

function serializeEnv(lines, updates) {
  const seen = new Set();
  const out = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      out.push(raw);
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      out.push(raw);
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (updates.has(key)) {
      out.push(`${key}=${updates.get(key)}`);
      seen.add(key);
    } else {
      out.push(raw);
    }
  }

  for (const key of STRIPE_KEYS) {
    if (updates.has(key) && !seen.has(key)) {
      out.push(`${key}=${updates.get(key)}`);
    }
  }

  return `${out.join("\n").replace(/\n*$/, "")}\n`;
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return { map: new Map(), lines: [] };
  const content = fs.readFileSync(filePath, "utf8");
  return { map: parseEnv(content), lines: content.split(/\r?\n/) };
}

function isPlaceholder(value) {
  if (!value) return true;
  return value === "price_..." || value.startsWith("sk_...") || value.startsWith("whsec_...");
}

async function stripeRequest(secretKey, method, endpoint, body) {
  const res = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Stripe API ${res.status}`);
  }
  return json;
}

async function ensurePrice(secretKey, plan) {
  const prices = await stripeRequest(secretKey, "GET", `/prices?active=true&limit=100`, null);
  const match = (prices.data || []).find(
    (price) =>
      price.currency === "gbp" &&
      price.unit_amount === plan.amount &&
      !price.recurring &&
      price.type === "one_time" &&
      (price.metadata?.product === "amrogen" ||
        price.metadata?.plan === plan.planId ||
        price.metadata?.plan === plan.key.replace("STRIPE_PRICE_", "").toLowerCase())
  );
  if (match?.id) return match.id;

  const productSearch = await stripeRequest(secretKey, "GET", `/products?active=true&limit=100`, null);
  let product = (productSearch.data || []).find((item) => item.name === plan.name);
  if (!product) {
    product = await stripeRequest(secretKey, "POST", "/products", {
      name: plan.name,
      "metadata[product]": "amrogen",
      "metadata[plan]": plan.planId,
      "metadata[billing]": "one_time_pack",
    });
  }

  const created = await stripeRequest(secretKey, "POST", "/prices", {
    product: product.id,
    currency: "gbp",
    unit_amount: String(plan.amount),
    "metadata[product]": "amrogen",
    "metadata[plan]": plan.planId,
    "metadata[credits]": String(plan.credits),
    "metadata[campaigns]": String(plan.campaigns),
    "metadata[billing]": "one_time_pack",
  });
  return created.id;
}

function buildKeyUpdates(academyMap, backendMap) {
  const updates = new Map();

  const secret =
    (!isPlaceholder(backendMap.get("STRIPE_SECRET_KEY")) && backendMap.get("STRIPE_SECRET_KEY")) ||
    academyMap.get("STRIPE_SECRET_KEY");
  if (secret) updates.set("STRIPE_SECRET_KEY", secret);

  const webhook = backendMap.get("STRIPE_WEBHOOK_SECRET") ?? academyMap.get("STRIPE_WEBHOOK_SECRET") ?? "";
  updates.set("STRIPE_WEBHOOK_SECRET", webhook);

  for (const plan of PLANS) {
    let existing = backendMap.get(plan.key);
    if ((!existing || isPlaceholder(existing)) && plan.key === "STRIPE_PRICE_PROFESSIONAL") {
      existing = backendMap.get("STRIPE_PRICE_GROWTH");
    }
    if ((!existing || isPlaceholder(existing)) && plan.key === "STRIPE_PRICE_ENTERPRISE") {
      existing = backendMap.get("STRIPE_PRICE_SCALE");
    }
    if (existing && !isPlaceholder(existing)) {
      updates.set(plan.key, existing);
    }
  }

  // Clear legacy keys when writing env files
  updates.set("STRIPE_PRICE_GROWTH", "");
  updates.set("STRIPE_PRICE_SCALE", "");

  return updates;
}

async function main() {
  const ensurePrices = process.argv.includes("--ensure-prices");
  const forcePrices = process.argv.includes("--force-prices");
  const insecureTls = process.argv.includes("--insecure");
  if (insecureTls) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    console.warn("WARNING: --insecure disables TLS verification (corporate proxy workaround)");
  }

  const academy = readEnvFile(ACADEMY_ENV);
  const backendLocal = readEnvFile(path.join(backendRoot, ".env.local"));
  const updates = buildKeyUpdates(academy.map, backendLocal.map);

  if (!updates.get("STRIPE_SECRET_KEY")) {
    console.error("No STRIPE_SECRET_KEY in academy/.env.local or backend/.env.local");
    process.exit(1);
  }

  if (ensurePrices || forcePrices) {
    for (const plan of PLANS) {
      if (!forcePrices && updates.get(plan.key) && !isPlaceholder(updates.get(plan.key))) {
        console.log(`${plan.key}: kept existing (use --force-prices to recreate)`);
        continue;
      }
      const priceId = await ensurePrice(updates.get("STRIPE_SECRET_KEY"), plan);
      updates.set(plan.key, priceId);
      console.log(`${plan.key}: ${forcePrices ? "forced" : "ensured"} (${priceId.slice(0, 12)}…)`);
    }
  } else {
    const missing = PLANS.filter((p) => !updates.get(p.key) || isPlaceholder(updates.get(p.key)));
    if (missing.length) {
      console.log(`Price IDs still missing: ${missing.map((p) => p.key).join(", ")}`);
      console.log("Run: node scripts/sync-stripe-env.mjs --force-prices");
    }
  }

  for (const filePath of TARGET_FILES) {
    const { lines } = readEnvFile(filePath);
    const fileUpdates = new Map(updates);
    if (filePath.includes(".env.local")) {
      fileUpdates.set("FRONTEND_URL", "http://localhost:3001");
      if (!filePath.includes("backend")) {
        fileUpdates.set("ENVIRONMENT", "development");
      }
    }
    if (filePath.endsWith(".env.production")) {
      fileUpdates.set("FRONTEND_URL", "https://amrogen.com");
      fileUpdates.set("ENVIRONMENT", "production");
    }
    const next = serializeEnv(
      lines.length ? lines : ["# Stripe (synced by scripts/sync-stripe-env.mjs)"],
      fileUpdates
    );
    fs.writeFileSync(filePath, next, "utf8");
    console.log(`Updated ${path.relative(repoRoot, filePath)}`);
  }

  console.log("Next: cd backend && node scripts/generate-cloudrun-env.mjs");
  console.log("Then update Cloud Run with --update-env-vars for the three STRIPE_PRICE_* keys only.");
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
