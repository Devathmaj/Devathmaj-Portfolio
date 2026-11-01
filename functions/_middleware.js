import { BUILD_ID } from './_shared/build.js';

const API_PREFIX = '/api/';

/**
 * Cloudflare Pages `_headers` cannot express a per-deployment value, so every
 * API response is stamped here. The page compares X-Site-Build with its own
 * <meta name="site-build"> to detect a deployment without polling.
 */
export const onRequest = async (context) => {
  const url = new URL(context.request.url);
  if (!url.pathname.startsWith(API_PREFIX)) return context.next();

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set('X-Site-Build', BUILD_ID);
  headers.set('Cache-Control', 'no-store');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
