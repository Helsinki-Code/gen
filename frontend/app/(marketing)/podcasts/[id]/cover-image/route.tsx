import { ImageResponse } from "next/og";
import { getPublicPodcast, podcastMinutes } from "@/lib/podcasts";

const size = {
  width: 1200,
  height: 630,
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const episode = await getPublicPodcast(id);
  const title = episode?.title || "AmroGen Growth Brief";
  const topic = episode?.topic || "AI sales intelligence for modern revenue teams";
  const audience = episode?.audience || "B2B founders and GTM teams";
  const minutes = episode ? podcastMinutes(episode) : 6;
  const episodeNumber = episode?.id.slice(0, 8).toUpperCase() || "AMROGEN";
  const waveform = [38, 76, 54, 112, 68, 146, 88, 176, 60, 132, 94, 162, 72, 118, 48, 96, 64, 140];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#08111A",
          color: "white",
          fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 16% 18%, rgba(34,211,197,0.42), transparent 30%), radial-gradient(circle at 92% 82%, rgba(56,189,248,0.30), transparent 34%), linear-gradient(135deg, #08111A 0%, #0E1B28 48%, #041018 100%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              "linear-gradient(rgba(148,163,184,0.45) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.45) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 62,
            top: 92,
            width: 520,
            height: 328,
            borderRadius: 42,
            border: "1px solid rgba(34,211,197,0.28)",
            background:
              "linear-gradient(135deg, rgba(34,211,197,0.18), rgba(56,189,248,0.08)), radial-gradient(circle at 78% 22%, rgba(56,189,248,0.42), transparent 32%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -90,
            top: -70,
            width: 420,
            height: 420,
            borderRadius: 80,
            border: "2px solid rgba(34,211,197,0.22)",
            transform: "rotate(18deg)",
          }}
        />
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "62px 70px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <div
                style={{
                  width: 66,
                  height: 66,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 18,
                  border: "1px solid rgba(34,211,197,0.45)",
                  background: "rgba(34,211,197,0.12)",
                  color: "#22D3C5",
                  fontSize: 36,
                  fontWeight: 800,
                }}
              >
                A
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ color: "#22D3C5", fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em" }}>
                  AmroGen
                </div>
                <div style={{ color: "#94A3B8", fontSize: 18, letterSpacing: "0.18em", textTransform: "uppercase" }}>
                  Growth Brief Podcast
                </div>
              </div>
            </div>
            <div
              style={{
                border: "1px solid rgba(34,211,197,0.35)",
                borderRadius: 999,
                padding: "12px 20px",
                color: "#A7F3D0",
                fontSize: 18,
                fontWeight: 700,
                background: "rgba(2, 6, 23, 0.35)",
              }}
            >
              {minutes} min listen · {episodeNumber}
            </div>
          </div>

          <div style={{ display: "flex", gap: 58, alignItems: "flex-end" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div
                style={{
                  color: "#22D3C5",
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  marginBottom: 22,
                }}
              >
                {topic}
              </div>
              <div
                style={{
                  fontSize: title.length > 78 ? 52 : 62,
                  lineHeight: 1.02,
                  fontWeight: 900,
                  letterSpacing: "-0.055em",
                  maxWidth: 785,
                }}
              >
                {title}
              </div>
              <div
                style={{
                  marginTop: 26,
                  color: "#CBD5E1",
                  fontSize: 24,
                  lineHeight: 1.35,
                  maxWidth: 760,
                }}
              >
                Built for {audience}. AI SDR strategy, outbound quality, and practical revenue workflows.
              </div>
            </div>

            <div
              style={{
                width: 290,
                height: 250,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: 24,
                borderRadius: 34,
                border: "1px solid rgba(148,163,184,0.28)",
                background: "rgba(15,23,42,0.58)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
              }}
            >
              {waveform.map((height, index) => (
                <div
                  key={index}
                  style={{
                    width: 10,
                    height,
                    borderRadius: 999,
                    background: index % 3 === 0 ? "#38BDF8" : "#22D3C5",
                    opacity: 0.92,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}
