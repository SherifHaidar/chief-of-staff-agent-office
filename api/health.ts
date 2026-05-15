import { handleVercelRequest } from "../src/server/vercel-adapter.js";

const ROUTE_PATH = "/health";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
