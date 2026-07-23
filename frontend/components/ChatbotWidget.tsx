"use client";

import Script from "next/script";

/** Vikram's AmroGen bot (amroagents.com / vikram@vranceflex.online). */
const DEFAULT_CHATBOT_ID = "0dfb6377-f1e1-4469-9501-e63870bbf1e5";
const WIDGET_SCRIPT_URL =
  process.env.NEXT_PUBLIC_AMROBOT_WIDGET_SCRIPT_URL?.trim() ||
  "https://amroagents.com/widget-loader.js";

const chatbotId =
  process.env.NEXT_PUBLIC_AMROBOT_CHATBOT_ID?.trim() || DEFAULT_CHATBOT_ID;

/**
 * Loads widget-loader.js from amroagents.com (canonical CDN for Amro Agents embeds).
 */
export default function ChatbotWidget() {
  return (
    <>
      <Script src={WIDGET_SCRIPT_URL} strategy="afterInteractive" />
      <div
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: `<amrobot-chat bot-id="${chatbotId}" position="bottom-right"></amrobot-chat>`,
        }}
      />
    </>
  );
}
