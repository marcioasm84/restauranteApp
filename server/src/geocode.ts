const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

// Nominatim (OpenStreetMap's free geocoder, no API key) requires every
// caller to identify itself via User-Agent — this is the app's contact,
// not a secret. See https://operations.osmfoundation.org/policies/nominatim/
const USER_AGENT = 'MeuRestaurante/1.0 (contato@meurestaurante.app)'

export interface GeocodeResult {
  lat: number
  lng: number
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const url = `${NOMINATIM_URL}?format=json&limit=1&q=${encodeURIComponent(address)}`
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) return null
  const results = (await res.json()) as Array<{ lat: string; lon: string }>
  const first = results[0]
  if (!first) return null
  return { lat: Number(first.lat), lng: Number(first.lon) }
}
