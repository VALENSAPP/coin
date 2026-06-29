/**
 * Google Places Autocomplete + Geocoding for post location.
 * Set GOOGLE_PLACES_API_KEY in `.env` (see `.env.example`).
 */
import { GOOGLE_PLACES_API_KEY } from '../shims/env';

const PLACES_AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const PLACES_NEARBY_URL =
  'https://maps.googleapis.com/maps/api/place/nearbysearch/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export function getGooglePlacesApiKey() {
  const key = GOOGLE_PLACES_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

export function isGooglePlacesConfigured() {
  return getGooglePlacesApiKey().length > 0;
}

/**
 * @param {Record<string, string>} params
 * @returns {Promise<any>}
 */
async function fetchGoogleMapsJson(url, params) {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error('Google Places API key is not configured');
  }

  const search = new URLSearchParams({ ...params, key: apiKey });
  const res = await fetch(`${url}?${search.toString()}`);
  if (!res.ok) {
    throw new Error('Google Places request failed');
  }

  const json = await res.json();
  if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(json.error_message || json.status);
  }

  return json;
}

/**
 * @param {string} input
 * @param {{ latitude?: number, longitude?: number, radius?: number }} [options]
 * @returns {Promise<Array<{ id: string, description: string, types?: string[] }>>}
 */
export async function searchPlacePredictions(input, options = {}) {
  const query = String(input || '').trim();
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || query.length < 2) return [];

  const params = {
    input: query,
    // Businesses (restaurants, shops, etc.) plus cities/addresses — like Instagram.
    types: 'establishment|geocode',
  };

  const { latitude, longitude, radius = 50000 } = options;
  if (
    typeof latitude === 'number' &&
    !Number.isNaN(latitude) &&
    typeof longitude === 'number' &&
    !Number.isNaN(longitude)
  ) {
    params.location = `${latitude},${longitude}`;
    params.radius = String(Math.max(1000, Math.min(radius, 50000)));
  }

  const json = await fetchGoogleMapsJson(PLACES_AUTOCOMPLETE_URL, params);
  const predictions = Array.isArray(json.predictions) ? json.predictions : [];

  const seen = new Set();
  return predictions.reduce((acc, item) => {
    const description = String(item?.description || '').trim();
    if (!description || seen.has(description)) return acc;
    seen.add(description);
    acc.push({
      id: item.place_id,
      description,
      types: Array.isArray(item.types) ? item.types : [],
    });
    return acc;
  }, []);
}

/**
 * Prefer a nearby business name when the user is at a POI (restaurant, store, etc.).
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string|null>}
 */
async function findNearbyEstablishmentLabel(latitude, longitude) {
  const json = await fetchGoogleMapsJson(PLACES_NEARBY_URL, {
    location: `${latitude},${longitude}`,
    rankby: 'distance',
    type: 'establishment',
  });

  const results = Array.isArray(json.results) ? json.results : [];
  const nearest = results[0];
  const name = String(nearest?.name || '').trim();
  if (!name) return null;

  const vicinity = String(nearest?.vicinity || '').trim();
  return vicinity ? `${name}, ${vicinity}` : name;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>}
 */
export async function reverseGeocodeCoordinates(latitude, longitude) {
  try {
    const establishmentLabel = await findNearbyEstablishmentLabel(latitude, longitude);
    if (establishmentLabel) return establishmentLabel;
  } catch {
    // Fall back to street address when nearby search is unavailable.
  }

  const json = await fetchGoogleMapsJson(GEOCODE_URL, {
    latlng: `${latitude},${longitude}`,
  });

  const first = Array.isArray(json.results) ? json.results[0] : null;
  const label = first?.formatted_address;
  if (!label) {
    throw new Error('No address found for this location');
  }

  return label;
}
