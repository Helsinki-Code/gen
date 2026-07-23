import { NextRequest } from "next/server";
import { proxyAmrogenAuth, readJsonBody } from "../../_proxy";

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);
  return proxyAmrogenAuth({
    path: "/auth/security/add-totp",
    body,
    authorization: request.headers.get("authorization"),
  });
}
