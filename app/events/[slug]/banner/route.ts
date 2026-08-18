import { NextResponse } from "next/server";
import { getTournamentBanner } from "@/lib/tournaments";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const banner = await getTournamentBanner(slug);
  if (!banner) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(banner.data), {
    headers: {
      "Content-Type": banner.mime,
      "Cache-Control": "private, max-age=300",
    },
  });
}
