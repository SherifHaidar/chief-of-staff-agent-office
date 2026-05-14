import type { FastifyInstance } from "fastify";

import { loadEnv } from "../src/config/env.js";
import { createConfiguredAgentOfficeApp } from "../src/server/create-configured-app.js";

const VERCEL_API_PREFIX = "/api";
const VERCEL_RUN_LOG_PATH = "/tmp/agent-office-run-log.jsonl";

let appPromise: Promise<FastifyInstance> | undefined;

function loadVercelEnv() {
  return loadEnv({
    ...process.env,
    RUN_LOG_PATH: process.env.RUN_LOG_PATH ?? VERCEL_RUN_LOG_PATH,
  });
}

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    const app = createConfiguredAgentOfficeApp(loadVercelEnv());
    appPromise = app.ready().then(() => app);
  }

  return appPromise;
}

export function toFastifyInjectUrl(requestUrl: string): string {
  const url = new URL(requestUrl);
  let pathname = url.pathname;

  if (pathname === VERCEL_API_PREFIX) {
    pathname = "/";
  } else if (pathname.startsWith(`${VERCEL_API_PREFIX}/`)) {
    pathname = pathname.slice(VERCEL_API_PREFIX.length);
  }

  return `${pathname}${url.search}`;
}

function toRequestHeaders(headers: Headers): Record<string, string> {
  const requestHeaders: Record<string, string> = {};
  headers.forEach((value, key) => {
    requestHeaders[key] = value;
  });

  return requestHeaders;
}

async function toRequestPayload(request: Request): Promise<Buffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  return Buffer.from(await request.arrayBuffer());
}

function toResponseHeaders(headers: Record<string, string | string[] | number | undefined>): Headers {
  const responseHeaders = new Headers();

  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        responseHeaders.append(name, item);
      }
      continue;
    }

    responseHeaders.set(name, String(value));
  }

  return responseHeaders;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const app = await getApp();
    const response = await app.inject({
      headers: toRequestHeaders(request.headers),
      method: request.method,
      payload: await toRequestPayload(request),
      url: toFastifyInjectUrl(request.url),
    });

    return new Response(response.payload, {
      headers: toResponseHeaders(response.headers),
      status: response.statusCode,
    });
  },
};
