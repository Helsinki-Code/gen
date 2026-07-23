import { NextResponse } from "next/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.redirect(new URL(`/podcasts/${id}/cover-image`, _request.url), 308);
}
