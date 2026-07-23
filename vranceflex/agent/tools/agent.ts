import { disableTool } from "eve/tools";

// The root must delegate only to the five declared VranceFlex specialists.
// Disable Eve's generic root-copy delegation tool to avoid ambiguous routing.
export default disableTool();
