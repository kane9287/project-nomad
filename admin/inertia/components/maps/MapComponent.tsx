import Map, { FullscreenControl, NavigationControl, MapProvider, Marker, Popup } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { useEffect, useState } from 'react'
import type { MapMouseEvent } from 'react-map-gl/maplibre'
import type { Poi } from '../../../types/maps'

// Register the PMTiles protocol at module level so it is available
// before MapLibre mounts and begins fetching tiles.
const _pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', _pmtilesProtocol.tile)

/**
 * Rewrite any absolute URL in the style JSON so that the host matches
 * the current window origin. This is needed because the style JSON is
 * generated server-side and may have a different host than the client.
 */
function rewriteStyleUrls(style: any): any {
  if (!style || typeof style !== 'object') return style
  const origin = window.location.origin

  for (const source of Object.values(style.sources) as any[]) {
    if (source.url && source.url.startsWith('pmtiles://http')) {
      // pmtiles://http://old-host/pmtiles/file.pmtiles → pmtiles://{origin}/pmtiles/file.pmtiles
      const inner = source.url.slice('pmtiles://'.length)
      const url = new URL(inner)
      source.url = 'pmtiles://' + origin + url.pathname + url.search
    } else if (source.url && source.url.startsWith('http')) {
      const url = new URL(source.url)
      source.url = origin + url.pathname + url.search
    }
  }

  // Rewrite sprite URL (string or array form)
  if (typeof style.sprite === 'string' && style.sprite.startsWith('http')) {
    const url = new URL(style.sprite)
    style.sprite = origin + url.pathname + url.search
  }

  // Rewrite glyphs URL — preserve {fontstack}/{range} template tokens
  if (typeof style.glyphs === 'string' && style.glyphs.startsWith('http')) {
    const url = new URL(style.glyphs)
    style.glyphs = origin + url.pathname + url.search
  }

  return style
}

interface MapComponentProps {
  pois?: Poi[]
  placingMode?: boolean
  selectedPoiId?: number | null
  onMapClick?: (lat: number, lng: number) => void
  onPoiClick?: (poi: Poi) => void
}

export default function MapComponent({
  pois = [],
  placingMode = false,
  selectedPoiId = null,
  onMapClick,
  onPoiClick,
}: MapComponentProps) {
  const [mapStyle, setMapStyle] = useState<object | undefined>(undefined)
  const [popupPoi, setPopupPoi] = useState<Poi | null>(null)

  useEffect(() => {
    fetch('/api/maps/styles')
      .then((r) => r.json())
      .then((style) => setMapStyle(rewriteStyleUrls(style)))
      .catch(console.error)
  }, [])

  const handleMapClick = (e: MapMouseEvent) => {
    if (!placingMode || !onMapClick) return
    onMapClick(e.lngLat.lat, e.lngLat.lng)
  }

  if (!mapStyle) return null

  return (
    <MapProvider>
      <Map
        reuseMaps
        style={{ width: '100%', height: '100vh' }}
        mapStyle={mapStyle}
        mapLib={maplibregl}
        cursor={placingMode ? 'crosshair' : 'grab'}
        initialViewState={{
          longitude: -98,
          latitude: 40,
          zoom: 4,
        }}
        onClick={handleMapClick}
      >
        <NavigationControl style={{ marginTop: '110px', marginRight: '36px' }} />
        <FullscreenControl style={{ marginTop: '30px', marginRight: '36px' }} />

        {pois.map((poi) => (
          <Marker
            key={poi.id}
            longitude={poi.lng}
            latitude={poi.lat}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation()
              if (popupPoi?.id === poi.id) {
                setPopupPoi(null)
              } else {
                setPopupPoi(poi)
                onPoiClick?.(poi)
              }
            }}
          >
            <div
              title={poi.name}
              style={{ color: poi.color }}
              className={`cursor-pointer transition-transform hover:scale-125 ${
                selectedPoiId === poi.id ? 'scale-125' : ''
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                width="28"
                height="28"
                style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
              >
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </div>
          </Marker>
        ))}

        {popupPoi && (
          <Popup
            longitude={popupPoi.lng}
            latitude={popupPoi.lat}
            anchor="top"
            onClose={() => setPopupPoi(null)}
            closeButton={true}
            closeOnClick={false}
          >
            <div className="text-sm min-w-32 max-w-48">
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: popupPoi.color }}
                />
                <strong className="text-text-primary">{popupPoi.name}</strong>
              </div>
              <p className="text-xs text-text-secondary capitalize">{popupPoi.category}</p>
              {popupPoi.description && (
                <p className="text-xs text-text-secondary mt-1">{popupPoi.description}</p>
              )}
              <p className="text-xs text-text-secondary opacity-60 mt-1">
                {popupPoi.lat.toFixed(5)}, {popupPoi.lng.toFixed(5)}
              </p>
            </div>
          </Popup>
        )}
      </Map>
    </MapProvider>
  )
}
