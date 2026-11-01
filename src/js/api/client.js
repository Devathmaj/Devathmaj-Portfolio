/**
 * Every API response carries the build id of the Worker that produced it.
 * Comparing that header with the page build is the deployment signal: it needs
 * no polling and costs nothing when the deployment has not changed.
 */
export async function apiFetch(input, init = {}) {
  const response = await fetch(input, {
    cache: 'no-store',
    ...init,
  });

  const buildId = response.headers.get('X-Site-Build');
  if (buildId) {
    window.assetManager?.observeBuild?.(buildId);
  }

  return response;
}
