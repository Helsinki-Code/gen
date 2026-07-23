import { NextRequest } from "next/server";
import { proxyAmrogenAuth } from "../../_proxy";

export async function GET(request: NextRequest) {
  const tempToken = request.nextUrl.searchParams.get("tempToken");
  const searchParams = new URLSearchParams();
  if (tempToken) searchParams.set("tempToken", tempToken);
  return proxyAmrogenAuth({
    method: "GET",
    path: "/auth/security/mfa-methods",
    authorization: request.headers.get("authorization"),
    searchParams,
  });
}
