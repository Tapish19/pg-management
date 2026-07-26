import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Don't burn 1s/2s/4s of retry backoff on requests that will never
        // succeed without a valid session (e.g. "Please sign in first").
        // Retrying doesn't fix a missing/invalid auth cookie, it just makes
        // navigation feel slow.
        retry: (failureCount, error) => {
          if (error instanceof Error && /sign in/i.test(error.message)) return false;
          return failureCount < 3;
        },
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
