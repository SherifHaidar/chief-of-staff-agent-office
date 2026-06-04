import { handleVercelRequest } from "../../src/server/vercel-adapter.js";

const ROUTE_PATH = "/office-v2/console";

export default {
  fetch: (request: Request) => handleVercelRequest(request, ROUTE_PATH),
};
