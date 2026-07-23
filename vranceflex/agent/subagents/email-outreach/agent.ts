import { defineAgent } from "eve";
import { z } from "zod";

const emailStep = z.object({
  step: z.number().int().min(1).max(5),
  day: z.number().int().nonnegative(),
  channel: z.literal("email"),
  type: z.enum(["intro", "follow_up", "value_drop", "soft_cta", "breakup"]),
  subject: z.string().min(1).max(49),
  subject_b: z.string().min(1).max(49),
  content: z.string().min(1),
});

export default defineAgent({
  description:
    "Write a deeply personalized five-step email-only outreach sequence with two short subject-line variants per step. Generates copy only; never sends email.",
  model: "anthropic/claude-haiku-4.5",
  outputSchema: z.array(
    z.object({
      lead_name: z.string().min(1),
      title: z.string(),
      company: z.string().min(1),
      email: z.string().email(),
      personalisation_note: z.string().min(1),
      sequence: z.array(emailStep).length(5),
    }),
  ),
});
