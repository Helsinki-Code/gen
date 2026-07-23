import { defineTool } from "eve/tools";
import { z } from "zod";

import { parallelFindAllRequest } from "../lib/parallel";

export default defineTool({
  description:
    "Check the current status of an asynchronous Parallel FindAll run. Use the findall_id returned by parallel_findall_start.",
  inputSchema: z.object({ findall_id: z.string().min(1) }),
  async execute({ findall_id }, ctx) {
    return parallelFindAllRequest(
      `/v1beta/findall/runs/${encodeURIComponent(findall_id)}`,
      { method: "GET" },
      ctx.abortSignal,
    );
  },
});
