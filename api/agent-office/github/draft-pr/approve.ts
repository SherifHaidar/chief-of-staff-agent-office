import { handleVercelRequest } from "../../../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/agent-office/github/draft-pr/approve";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
