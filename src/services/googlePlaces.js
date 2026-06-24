/**
 * Google Places Autocomplete + Geocoding for post location.
 * Set GOOGLE_PLACES_API_KEY in `.env` (see `.env.example`).
 */
import { GOOGLE_PLACES_API_KEY } from '../shims/env';

const PLACES_AUTOCOMPLETE_URL =
  'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

export function getGooglePlacesApiKey() {
  const key = GOOGLE_PLACES_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

export function isGooglePlacesConfigured() {
  return getGooglePlacesApiKey().length > 0;
}

/**
 * @param {string} input
 * @returns {Promise<Array<{ id: string, description: string }>>}
 */
export async function searchPlacePredictions(input) {
  const query = String(input || '').trim();
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || query.length < 2) return [];

  const params = new URLSearchParams({
    input: query,
    key: apiKey,
    types: 'geocode',
  });

  const res = await fetch(`${PLACES_AUTOCOMPLETE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Places autocomplete request failed');
  }

  const json = await res.json();
  if (json.status && json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
    throw new Error(json.error_message || json.status);
  }

  const predictions = Array.isArray(json.predictions) ? json.predictions : [];
  return predictions.map(item => ({
    id: item.place_id,
    description: item.description,
  }));
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string>}
 */
export async function reverseGeocodeCoordinates(latitude, longitude) {
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    throw new Error('Google Places API key is not configured');
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: apiKey,
  });

  const res = await fetch(`${GEOCODE_URL}?${params.toString()}`);
  if (!res.ok) {
    throw new Error('Geocoding request failed');
  }

  const json = await res.json();
  if (json.status && json.status !== 'OK') {
    throw new Error(json.error_message || json.status);
  }

  const first = Array.isArray(json.results) ? json.results[0] : null;
  const label = first?.formatted_address;
  if (!label) {
    throw new Error('No address found for this location');
  }

  return label;
}
