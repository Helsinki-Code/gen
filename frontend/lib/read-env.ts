import fs from "node:fs";
import path from "node:path";

/** Read env from process.env, then frontend .env.local, then backend .env (local dev). */
export function readEnvValue(name: string): string {
  if (process.env[name]) return process.env[name] as string;

  const candidates = [
    path.resolve(process.cwd(), ".env.local"),
    path.resolve(process.cwd(), ".env.production"),
    path.resolve(process.cwd(), "..", "backend", ".env.local"),
    path.resolve(process.cwd(), "..", "backend", ".env"),
    path.resolve(process.cwd(), "..", ".env"),
  ];

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    const match = fs
      .readFileSync(filePath, "utf8")
      .match(new RegExp(`^${name}=([^\\n\\r]*)`, "m"));
    if (match?.[1]?.trim()) return match[1].trim();
  }

  return "";
}
