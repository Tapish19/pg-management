import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";

// Diagnostic-only: log which request is being rendered and how long it
// takes. Purpose is to give the Render logs a request URL to correlate with
// the platform's "SSR stream transform exceeded maximum lifetime" watchdog
// message, which otherwise carries no info about which route triggered it.
const requestLogMiddleware = createMiddleware().server(async ({ next, request }) => {
  const url = request?.url ?? "(unknown url)";
  const start = Date.now();
  console.log(`[ssr] start ${url}`);
  try {
    const result = await next();
    console.log(`[ssr] done  ${url} (${Date.now() - start}ms)`);
    return result;
  } catch (error) {
    console.error(`[ssr] error ${url} (${Date.now() - start}ms):`, error);
    throw error;
  }
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [requestLogMiddleware, errorMiddleware],
}));
