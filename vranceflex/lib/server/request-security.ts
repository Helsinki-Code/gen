import { AuthRequestError } from "./auth-errors";

export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const expected = new URL(request.url).origin;
  if (origin !== expected) {
    throw new AuthRequestError("This request origin is not allowed.", 403);
  }
}
