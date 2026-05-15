import { handleVercelRequest } from "../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/agent-office/run-ready-architecture";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
