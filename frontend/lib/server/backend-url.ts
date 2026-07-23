/**
 * Server-only backend URL (Cloud Run runtime env).
 * Do not import from client components.
 */
export function getBackendUrl(): string {
  const url =
    process.env.AMROGEN_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    "";

  if (url) {
    return url.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development") {
    return "http://localhost:8000";
  }

  throw new Error(
    "AMROGEN_BACKEND_URL or NEXT_PUBLIC_API_URL must be set for server API routes"
  );
}
