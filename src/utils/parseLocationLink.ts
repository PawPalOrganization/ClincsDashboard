export interface LatLng {
  lat: number;
  lng: number;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= -90 && lat <= 90
    && lng >= -180 && lng <= 180;
}

export function isShortenedGoogleMapsLink(input: string): boolean {
  return /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(input.trim());
}

// Tries the most precise coordinate source first: a pinned place's `!3d<lat>!4d<lng>`
// data param is the actual marker location, while `@<lat>,<lng>` is just the camera
// center and can be off if the map was panned before the link was copied.
export function parseLocationLink(input: string): LatLng | null {
  const text = input.trim();
  if (!text) return null;

  const dataMatch = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (dataMatch) {
    const lat = parseFloat(dataMatch[1]);
    const lng = parseFloat(dataMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const atMatch = text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    const lat = parseFloat(atMatch[1]);
    const lng = parseFloat(atMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const queryMatch = text.match(/[?&](?:q|ll|query)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (queryMatch) {
    const lat = parseFloat(queryMatch[1]);
    const lng = parseFloat(queryMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const bareMatch = text.match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (bareMatch) {
    const lat = parseFloat(bareMatch[1]);
    const lng = parseFloat(bareMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}
