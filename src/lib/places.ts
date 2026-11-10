// Inlined at build time. An empty value leaves the suburb field as a plain input.
export const mapsBrowserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

export const placesAutocompleteEnabled = mapsBrowserKey.length > 0;

// A selected formatted address can be longer than a typed suburb. The cap
// stays at 80 when autocomplete is off, so that build matches today's field.
export const suburbFieldMaxLength = placesAutocompleteEnabled ? 200 : 80;

// Bias, not a hard limit. includedRegionCodes still limits results to Australia.
export const victoriaBias = {
  south: -39.2,
  west: 140.9617,
  north: -33.98,
  east: 149.9763,
};

export const melbourneOrigin = { lat: -37.8136, lng: 144.9631 };
