import type { FastifyInstance } from "fastify";

import { loadEnv } from "../config/env.js";
import { createConfiguredAgentOfficeApp } from "./create-configured-app.js";

const VERCEL_RUN_LOG_PATH = "/tmp/agent-office-run-log.jsonl";

type InjectHttpMethod = "DELETE" | "GET" | "HEAD" | "OPTIONS" | "PATCH" | "POST" | "PUT";
type RequestHeaderMap = Record<string, string | string[] | number | undefined>;
type RequestHeaderSource = Headers | RequestHeaderMap;

let appPromise: Promise<FastifyInstance> | undefined;

function loadVercelEnv() {
  return loadEnv({
    ...process.env,
    RUN_LOG_PATH: process.env.RUN_LOG_PATH ?? VERCEL_RUN_LOG_PATH,
  });
}

function toInjectMethod(method: string): InjectHttpMethod {
  return method.toUpperCase() as InjectHttpMethod;
}

async function getApp(): Promise<FastifyInstance> {
  if (!appPromise) {
    appPromise = (async () => {
      const app = createConfiguredAgentOfficeApp(loadVercelEnv());
      await app.ready();
      return app;
    })();
  }

  return appPromise;
}

export function toFastifyInjectUrl(requestUrl: string, routePath: string): string {
  const url = new URL(requestUrl);
  return `${routePath}${url.search}`;
}

function isFetchHeaders(headers: RequestHeaderSource): headers is Headers {
  return typeof (headers as Headers).forEach === "function";
}

export function toRequestHeaders(headers: RequestHeaderSource | undefined): Record<string, string | string[]> {
  const requestHeaders: Record<string, string | string[]> = {};

  if (!headers) {
    return requestHeaders;
  }

  if (isFetchHeaders(headers)) {
    headers.forEach((value, key) => {
      requestHeaders[key.toLowerCase()] = value;
    });

    return requestHeaders;
  }

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    if (rawValue === undefined) {
      continue;
    }

    const key = rawKey.toLowerCase();

    if (Array.isArray(rawValue)) {
      const values = rawValue.map(String);
      if (values.length === 1) {
        requestHeaders[key] = values[0] ?? "";
      } else if (values.length > 1) {
        requestHeaders[key] = values;
      }
      continue;
    }

    requestHeaders[key] = String(rawValue);
  }

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

export async function handleVercelRequest(request: Request, routePath: string): Promise<Response> {
  const app = await getApp();
  const response = await app.inject({
    headers: toRequestHeaders(request.headers),
    method: toInjectMethod(request.method),
    payload: await toRequestPayload(request),
    url: toFastifyInjectUrl(request.url, routePath),
  });

  return new Response(response.payload, {
    headers: toResponseHeaders(response.headers),
    status: response.statusCode,
  });
}
