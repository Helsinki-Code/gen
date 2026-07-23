import type { Metadata } from "next";
import ChatbotWidget from "@/components/ChatbotWidget";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

/** Always render at request time so Cloud Run runtime env can inject the API URL. */
export const dynamic = "force-dynamic";

function resolvePublicApiUrl(): string {
  return (
    process.env.AMROGEN_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_URL?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:8000" : "")
  ).replace(/\/$/, "");
}

export const metadata: Metadata = {
  title: {
    default: "AmroGen - AI-Powered B2B Outreach",
    template: "%s | AmroGen",
  },
  description: "Generate leads and personalised outreach sequences at scale with AI",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://amrogen.com"),
  icons: {
    icon: "/assets/images/favicon/amrogen_favicon.png",
    shortcut: "/assets/images/favicon/amrogen_favicon.png",
    apple: "/assets/images/favicon/amrogen_favicon.png",
  },
};

const themeInitScript = `
  try {
    var storedTheme = localStorage.getItem("amrogen-theme");
    var theme = storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.dataset.theme = theme;
  } catch (_) {
    document.documentElement.classList.add("dark");
    document.documentElement.dataset.theme = "dark";
  }
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const apiUrl = resolvePublicApiUrl();
  const apiConfigScript = apiUrl
    ? `window.__AMROGEN_API_URL__=${JSON.stringify(apiUrl)};`
    : "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {apiConfigScript ? (
          <script dangerouslySetInnerHTML={{ __html: apiConfigScript }} />
        ) : null}
      </head>
      <body className="font-sans min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
        <ChatbotWidget />
      </body>
    </html>
  );
}
