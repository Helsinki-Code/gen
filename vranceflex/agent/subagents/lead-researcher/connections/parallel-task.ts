import { defineMcpClientConnection } from "eve/connections";
import { once } from "eve/tools/approval";

export default defineMcpClientConnection({
  url: "https://task-mcp.parallel.ai/mcp",
  description:
    "Parallel Task MCP for citation-backed deep research and batch enrichment of lead candidates. Use task groups for contact enrichment and deep research only for exceptional company-level questions.",
  auth: {
    getToken: async () => {
      const token = process.env.PARALLEL_API_KEY?.trim();
      if (!token) {
        throw new Error(
          "PARALLEL_API_KEY is not configured in the Eve deployment environment.",
        );
      }
      return { token };
    },
  },
  tools: {
    allow: ["createTaskGroup", "createDeepResearch", "getStatus", "getResultMarkdown"],
  },
  // Parallel tasks can consume credits and process contact data. Approve the
  // connection once per lead-research session; status/result calls then resume normally.
  approval: once(),
});
