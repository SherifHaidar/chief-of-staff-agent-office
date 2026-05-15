import { handleVercelRequest } from "../../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/agent-office/architect-review/revise";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
