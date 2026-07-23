import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Analyze a website or a structured product idea, define evidence-backed ICPs, discover leads with Parallel FindAll, enrich and verify contact data with the Parallel Task MCP, and return cited lead research.",
  model: "anthropic/claude-sonnet-4.6",
  reasoning: "medium",
  limits: {
    maxOutputTokensPerSession: 100_000,
  },
});
