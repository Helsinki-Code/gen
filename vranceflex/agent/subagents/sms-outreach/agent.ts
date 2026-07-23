import { defineAgent } from "eve";
import { z } from "zod";

const smsStep = z.object({
  step: z.number().int().min(1).max(3),
  day: z.number().int().nonnegative(),
  channel: z.literal("sms"),
  type: z.enum(["sms_opener", "sms_follow_up", "sms_cta"]),
  subject: z.null(),
  content: z.string().min(1).max(160),
  char_count: z.number().int().min(1).max(160),
});

export default defineAgent({
  description:
    "Write a personalized three-step B2B SMS outreach sequence with every message limited to 160 characters. Generates copy only; never sends SMS.",
  model: "anthropic/claude-haiku-4.5",
  outputSchema: z.array(
    z.object({
      lead_name: z.string().min(1),
      title: z.string(),
      company: z.string().min(1),
      phone: z.string().min(5),
      char_counts: z.tuple([
        z.number().int().min(1).max(160),
        z.number().int().min(1).max(160),
        z.number().int().min(1).max(160),
      ]),
      sequence: z.array(smsStep).length(3),
    }),
  ),
});
