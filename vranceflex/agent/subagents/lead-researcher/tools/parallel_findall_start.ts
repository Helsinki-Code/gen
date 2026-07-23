import { defineTool } from "eve/tools";
import { once } from "eve/tools/approval";
import { z } from "zod";

import { parallelFindAllRequest } from "../lib/parallel";

const criterion = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
});

export default defineTool({
  description:
    "Start an asynchronous Parallel FindAll run to discover people or companies matching explicit criteria. This consumes Parallel credits and returns a findall_id for status/result calls.",
  inputSchema: z.object({
    objective: z.string().min(10),
    entity_type: z.string().min(1),
    match_conditions: z.array(criterion).min(1),
    enrichments: z.array(criterion).optional(),
    generator: z.enum(["preview", "base", "core", "pro"]).default("core"),
    match_limit: z.number().int().min(1).max(500),
  }),
  approval: once(),
  async execute(input, ctx) {
    return parallelFindAllRequest(
      "/v1beta/findall/runs",
      { method: "POST", body: JSON.stringify(input) },
      ctx.abortSignal,
    );
  },
});
