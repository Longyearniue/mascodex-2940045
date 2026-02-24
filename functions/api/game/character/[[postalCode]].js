import { jsonResponse, errorResponse, corsResponse } from '../_lib/helpers.js';
import { getCharacterProfile } from '../_lib/character.js';

export async function onRequest(context) {
  const { request, params } = context;
  if (request.method === 'OPTIONS') return corsResponse();
  if (request.method !== 'GET') return errorResponse('Method not allowed', 405);

  try {
    // params.postalCode is an array for catch-all routes — join and clean
    const raw = (params.postalCode || []).join('');
    const clean = raw.replace(/[-\s]/g, '');

    if (!/^\d{7}$/.test(clean)) {
      return errorResponse('Invalid postal code — must be 7 digits');
    }

    const character = getCharacterProfile(clean);

    return jsonResponse({ success: true, character });
  } catch (err) {
    console.error('Character detail error:', err);
    return errorResponse('Internal server error', 500);
  }
}
