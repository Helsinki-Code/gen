const PARALLEL_API_ORIGIN = "https://api.parallel.ai";
const FINDALL_BETA = "findall-2025-09-15";

export async function parallelFindAllRequest(
  path: string,
  init: RequestInit,
  abortSignal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const apiKey = process.env.PARALLEL_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "PARALLEL_API_KEY is not configured in the Eve deployment environment.",
    );
  }

  const response = await fetch(`${PARALLEL_API_ORIGIN}${path}`, {
    ...init,
    signal: abortSignal,
    headers: {
      "content-type": "application/json",
      "parallel-beta": FINDALL_BETA,
      "x-api-key": apiKey,
      ...init.headers,
    },
  });

  const raw = await response.text();
  let payload: unknown;
  try {
    payload = raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
    payload = { message: raw.slice(0, 2_000) };
  }

  if (!response.ok) {
    const reason =
      response.status === 401 || response.status === 403
        ? "Parallel credential was rejected; verify or rotate PARALLEL_API_KEY."
        : `Parallel FindAll request failed with HTTP ${response.status}.`;
    throw new Error(reason, { cause: payload });
  }

  return payload as Record<string, unknown>;
}
