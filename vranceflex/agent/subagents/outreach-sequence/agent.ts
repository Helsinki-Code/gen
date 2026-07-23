import { defineAgent } from "eve";
import { z } from "zod";

const sequenceStep = z.object({
  step: z.number().int().positive(),
  day: z.number().int().nonnegative(),
  channel: z.enum(["email", "linkedin", "phone"]),
  type: z.string().min(1),
  subject: z.string().nullable(),
  content: z.string().min(1),
});

export default defineAgent({
  description:
    "Create personalized multi-channel outreach sequences from confirmed lead records, using only channels present in each lead's data.",
  model: "anthropic/claude-haiku-4.5",
  outputSchema: z.array(
    z.object({
      lead_name: z.string().min(1),
      title: z.string(),
      company: z.string().min(1),
      channels: z.array(z.enum(["email", "linkedin", "phone"])),
      sequence: z.array(sequenceStep).min(1),
    }),
  ),
});
