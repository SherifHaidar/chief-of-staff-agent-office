import { handleVercelRequest } from "../../../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/agent-office/github/implementation/approve";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
