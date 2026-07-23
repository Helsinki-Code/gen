import { defineTool } from "eve/tools";
import { z } from "zod";

import { parallelFindAllRequest } from "../lib/parallel";

export default defineTool({
  description:
    "Retrieve the current candidates and citation-backed results of a Parallel FindAll run after status indicates completion.",
  inputSchema: z.object({ findall_id: z.string().min(1) }),
  async execute({ findall_id }, ctx) {
    return parallelFindAllRequest(
      `/v1beta/findall/runs/${encodeURIComponent(findall_id)}/result`,
      { method: "GET" },
      ctx.abortSignal,
    );
  },
});
