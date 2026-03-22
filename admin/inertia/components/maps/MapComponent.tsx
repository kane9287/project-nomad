import Map, { FullscreenControl, NavigationControl, MapProvider } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'
import { useEffect, useState } from 'react'

// Register the PMTiles protocol at module level so it is available
// before MapLibre mounts and begins fetching tiles.
const _pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', _pmtilesProtocol.tile)

/**
 * Rewrite any absolute URL in the style JSON so that the host matches
 * window.location.origin.  This is required when the app is accessed
 * through a reverse proxy: the server builds tile/sprite/glyph URLs from
 * request.host() (the internal host), but the browser can only reach those
 * resources through the proxy.
 */
function rewriteStyleUrls(style: any): any {
  const origin = window.location.origin

  // Rewrite pmtiles:// source URLs
  if (style.sources) {
    for (const source of Object.values(style.sources) as any[]) {
      if (typeof source.url === 'string' && source.url.startsWith('pmtiles://')) {
        const inner = source.url.slice('pmtiles://'.length)
        try {
          const url = new URL(inner)
          source.url = `pmtiles://${origin}${url.pathname}`
        } catch {}
      }
    }
  }

  // Rewrite sprite URL (string or array form)
  if (typeof style.sprite === 'string') {
    const match = style.sprite.match(/^https?:\/\/[^/]+(\/.*)?$/)
    if (match) style.sprite = `${origin}${match[1] ?? ''}`
  }

  // Rewrite glyphs URL — preserve {fontstack}/{range} template tokens
  if (typeof style.glyphs === 'string') {
    const match = style.glyphs.match(/^https?:\/\/[^/]+(\/.*)?$/)
    if (match) style.glyphs = `${origin}${match[1] ?? ''}`
  }

  return style
}

export default function MapComponent() {
  const [mapStyle, setMapStyle] = useState<object | undefined>(undefined)

  useEffect(() => {
    fetch('/api/maps/styles')
      .then((r) => r.json())
      .then((style) => setMapStyle(rewriteStyleUrls(style)))
      .catch(console.error)
  }, [])

  if (!mapStyle) return null

  return (
    <MapProvider>
      <Map
        reuseMaps
        style={{
          width: '100%',
          height: '100vh',
        }}
        mapStyle={mapStyle}
        mapLib={maplibregl}
        initialViewState={{
          longitude: -101,
          latitude: 40,
          zoom: 3.5,
        }}
      >
        <NavigationControl style={{ marginTop: '110px', marginRight: '36px' }} />
        <FullscreenControl style={{ marginTop: '30px', marginRight: '36px' }} />
      </Map>
    </MapProvider>
  )
}
