import { defineAgent } from "eve";
import { z } from "zod";

export default defineAgent({
  description:
    "Classify a supplied email or SMS reply, assess sentiment and buying intent, recommend the next action, and draft a concise response. Does not poll inboxes.",
  model: "anthropic/claude-haiku-4.5",
  outputSchema: z.object({
    lead_name: z.string(),
    company: z.string(),
    reply_channel: z.enum(["email", "sms"]),
    intent: z.enum([
      "HOT",
      "WARM",
      "NEUTRAL",
      "OBJECTION",
      "NOT_FIT",
      "OUT_OF_OFFICE",
      "UNSUBSCRIBE",
    ]),
    sentiment_score: z.number().int().min(1).max(10),
    confidence: z.enum(["high", "medium", "low"]),
    reasoning: z.string().min(1),
    next_action: z.enum([
      "book_meeting",
      "send_case_study",
      "send_pricing",
      "address_objection",
      "continue_sequence",
      "pause_30_days",
      "pause_sequence",
      "stop_sequence",
      "wait_for_ooo",
      "escalate_to_human",
    ]),
    action_detail: z.string().min(1),
    ooo_return_date: z.string().nullable(),
    suggested_response: z.string(),
    flag_for_human: z.boolean(),
    flag_reason: z.string().nullable(),
  }),
});
