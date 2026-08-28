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

export async function searchPlacePredictions(input, options = {}) {
  const query = String(input || '').trim();
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || query.length < 2) return [];

  const params = {
    input: query,
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

// ── New: place details lookup, used by MyClosetAddItemShippingScreen to
// resolve a selected prediction into a city + formatted address. Purely
// additive — does not alter any function above.
const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

/**
 * @param {string} placeId
 * @returns {Promise<{ formattedAddress: string, city: string, name: string, latitude: number|null, longitude: number|null }>}
 */
export async function getPlaceDetails(placeId) {
  const id = String(placeId || '').trim();
  if (!id) {
    throw new Error('A place_id is required');
  }

  const json = await fetchGoogleMapsJson(PLACES_DETAILS_URL, {
    place_id: id,
    fields: 'formatted_address,address_component,geometry,name',
  });

  const result = json.result || {};
  const components = Array.isArray(result.address_components)
    ? result.address_components
    : [];
  const findComponent = type => components.find(c => c.types?.includes(type));

  const locality =
    findComponent('locality') ||
    findComponent('postal_town') ||
    findComponent('sublocality') ||
    findComponent('administrative_area_level_2');
  const state = findComponent('administrative_area_level_1');

  const cityName = locality?.long_name || '';
  const stateAbbr = state?.short_name || '';
  const city = cityName ? [cityName, stateAbbr].filter(Boolean).join(', ') : '';
  const location = result.geometry?.location || {};

  return {
    formattedAddress: result.formatted_address || '',
    city,
    name: result.name || '',
    latitude: typeof location.lat === 'number' ? location.lat : null,
    longitude: typeof location.lng === 'number' ? location.lng : null,
  };
}

const CITY_AUTOCOMPLETE_TYPES = '(cities)';

/**
 * @param {string} input
 * @returns {Promise<Array<{ id: string, description: string }>>}
 */
export async function searchCityPredictions(input) {
  const query = String(input || '').trim();
  const apiKey = getGooglePlacesApiKey();
  if (!apiKey || query.length < 2) return [];

  const json = await fetchGoogleMapsJson(PLACES_AUTOCOMPLETE_URL, {
    input: query,
    types: CITY_AUTOCOMPLETE_TYPES,
  });

  const predictions = Array.isArray(json.predictions) ? json.predictions : [];
  const seen = new Set();
  return predictions.reduce((acc, item) => {
    const description = String(item?.description || '').trim();
    if (!description || seen.has(description)) return acc;
    seen.add(description);
    acc.push({ id: item.place_id, description });
    return acc;
  }, []);
}