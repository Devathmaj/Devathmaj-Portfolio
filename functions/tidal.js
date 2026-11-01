import { getTidal } from '../lib/tidal.js';

export const onRequestGet = async ({ env }) => {
  try {
    return Response.json(await getTidal(env));
  } catch {
    return Response.json(
      { error: 'Now playing is unavailable' },
      { status: 502 },
    );
  }
};
