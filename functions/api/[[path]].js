const json = (body, status) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  });

// Unknown /api/* routes stay JSON and network-only. More specific Functions
// such as functions/api/contact.js take precedence over this catch-all.
export const onRequest = () => json({ error: 'not_found' }, 404);
