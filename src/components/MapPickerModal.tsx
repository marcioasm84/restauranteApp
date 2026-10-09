import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { geocodeAddressRequest } from '../lib/api'

// Brazil's geographic center — used as the starting view when the client
// doesn't have coordinates yet, so the map opens somewhere useful instead
// of the middle of the ocean at (0, 0).
const DEFAULT_CENTER: L.LatLngTuple = [-14.235, -51.9253]
const DEFAULT_ZOOM = 4
const PIN_ZOOM = 16

// A plain SVG pin via divIcon — sidesteps the classic Leaflet-in-a-bundler
// problem where the default marker images resolve to the wrong URL after
// webpack/Vite processes the package, leaving broken-image icons.
const pinIcon = L.divIcon({
  className: '',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 0C6.7 0 0 6.7 0 15c0 10.5 15 25 15 25s15-14.5 15-25C30 6.7 23.3 0 15 0z" fill="#16a34a"/>
    <circle cx="15" cy="15" r="6" fill="white"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
})

export default function MapPickerModal({
  token,
  address,
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: {
  token: string
  address?: string
  initialLat: number | null
  initialLng: number | null
  onConfirm: (lat: number, lng: number) => void
  onClose: () => void
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null,
  )
  const [geocoding, setGeocoding] = useState(false)
  const [geocodeError, setGeocodeError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    const hasInitial = initialLat != null && initialLng != null
    const center: L.LatLngTuple = hasInitial ? [initialLat, initialLng] : DEFAULT_CENTER
    const map = L.map(mapRef.current).setView(center, hasInitial ? PIN_ZOOM : DEFAULT_ZOOM)
    mapInstance.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    if (hasInitial) {
      markerRef.current = L.marker(center, { icon: pinIcon }).addTo(map)
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      setGeocodeError(null)
      setPoint({ lat: e.latlng.lat, lng: e.latlng.lng })
      if (markerRef.current) {
        markerRef.current.setLatLng(e.latlng)
      } else {
        markerRef.current = L.marker(e.latlng, { icon: pinIcon }).addTo(map)
      }
    })

    // The modal's layout settles a tick after mount; without this nudge
    // Leaflet sometimes keeps the tile grid sized for a 0x0 container.
    const resizeId = setTimeout(() => map.invalidateSize(), 50)

    let cancelled = false
    // No coordinates yet but there's an address on file — center the map
    // there right away instead of leaving the admin staring at all of
    // Brazil and having to hunt the street down by hand.
    if (!hasInitial && address?.trim()) {
      setGeocoding(true)
      geocodeAddressRequest(token, address.trim())
        .then(({ lat, lng }) => {
          if (cancelled) return
          setPoint({ lat, lng })
          map.setView([lat, lng], PIN_ZOOM)
          markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
        })
        .catch(() => {
          if (!cancelled) {
            setGeocodeError('Não encontramos esse endereço automaticamente. Marque o ponto manualmente.')
          }
        })
        .finally(() => {
          if (!cancelled) setGeocoding(false)
        })
    }

    return () => {
      cancelled = true
      clearTimeout(resizeId)
      map.remove()
      mapInstance.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-2xl bg-surface p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-ink">Marcar localização no mapa</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-[12px] text-ink-soft">
          Clique no mapa para marcar o ponto exato do estabelecimento.
        </p>
        <div ref={mapRef} className="h-80 w-full overflow-hidden rounded-xl border border-border" />
        <p className="text-[12px] font-medium text-ink-soft">
          {geocoding
            ? 'Buscando o endereço no mapa…'
            : point
              ? `${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`
              : 'Nenhum ponto marcado ainda.'}
        </p>
        {geocodeError && <p className="-mt-2 text-[12px] font-medium text-copper">{geocodeError}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!point}
            onClick={() => point && onConfirm(point.lat, point.lng)}
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-accent px-5 text-[13px] font-semibold text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Usar esta localização
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-10 items-center gap-1.5 rounded-full border border-border px-5 text-[13px] font-semibold text-ink-soft hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
