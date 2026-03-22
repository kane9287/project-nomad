import Map, { FullscreenControl, NavigationControl, MapProvider } from 'react-map-gl/maplibre'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Protocol } from 'pmtiles'

// Register the PMTiles protocol at module level so it is available
// before MapLibre mounts and begins fetching tiles.
const _pmtilesProtocol = new Protocol()
maplibregl.addProtocol('pmtiles', _pmtilesProtocol.tile)

export default function MapComponent() {

  return (
    <MapProvider>
      <Map
        reuseMaps
        style={{
          width: '100%',
          height: '100vh',
        }}
        mapStyle="/api/maps/styles"
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
