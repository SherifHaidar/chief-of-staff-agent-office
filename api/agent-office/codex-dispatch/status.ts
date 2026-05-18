import { handleVercelRequest } from "../../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/agent-office/codex-dispatch/status";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};

