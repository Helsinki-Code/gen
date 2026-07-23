import { NextRequest } from "next/server";
import { proxyAmrogenAuth } from "../../_proxy";

export async function POST(request: NextRequest) {
  return proxyAmrogenAuth({
    path: "/auth/security/add-email",
    body: {},
    authorization: request.headers.get("authorization"),
  });
}
