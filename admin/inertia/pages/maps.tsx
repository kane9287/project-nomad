import MapsLayout from '~/layouts/MapsLayout'
import { Head, Link } from '@inertiajs/react'
import MapComponent from '~/components/maps/MapComponent'
import PoiPanel from '~/components/maps/PoiPanel'
import StyledButton from '~/components/StyledButton'
import { FileEntry } from '../../types/files'
import Alert from '~/components/Alert'
import { useEffect, useState } from 'react'
import type { Poi, PoiPayload } from '../../types/maps'
import api from '~/lib/api'

export default function Maps(props: {
  maps: { baseAssetsExist: boolean; regionFiles: FileEntry[] }
}) {
  const alertMessage = !props.maps.baseAssetsExist
    ? 'Base assets are missing. Please download them in Map Settings.'
    : null

  const [pois, setPois] = useState<Poi[]>([])
  const [placingMode, setPlacingMode] = useState(false)
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [selectedPoiId, setSelectedPoiId] = useState<number | null>(null)

  useEffect(() => {
    api.getPois().then((data) => {
      if (data) setPois(data)
    })
  }, [])

  const handleMapClick = (lat: number, lng: number) => {
    if (!placingMode) return
    setPendingCoords({ lat, lng })
  }

  const handleCreate = async (payload: PoiPayload) => {
    const created = await api.createPoi(payload)
    if (created) setPois((prev) => [...prev, created])
    setPendingCoords(null)
  }

  const handleUpdate = async (id: number, payload: Partial<PoiPayload>) => {
    const updated = await api.updatePoi(id, payload)
    if (updated) setPois((prev) => prev.map((p) => (p.id === id ? updated : p)))
  }

  const handleDelete = async (id: number) => {
    await api.deletePoi(id)
    setPois((prev) => prev.filter((p) => p.id !== id))
    if (selectedPoiId === id) setSelectedPoiId(null)
  }

  const handleSelectPoi = (poi: Poi | null) => {
    setSelectedPoiId(poi?.id ?? null)
  }

  return (
    <MapsLayout>
      <Head title="Maps" />
      <div className="relative w-full h-screen overflow-hidden">
        <div className="absolute top-0 left-0 right-0 z-50 flex justify-between p-4 bg-surface-secondary backdrop-blur-sm shadow-sm">
          <Link href="/home">
            <StyledButton variant="secondary" size="sm" icon="IconArrowLeft">
              Back
            </StyledButton>
          </Link>
        </div>

        {alertMessage && (
          <div className="absolute top-16 left-0 right-0 z-40 px-4">
            <Alert
              title="Map Setup Required"
              message={alertMessage}
              type="warning"
              buttonProps={{
                children: 'Go to Map Settings',
                onClick: () => (window.location.href = '/settings/maps'),
              }}
            />
          </div>
        )}

        <div className="absolute inset-0">
          <MapComponent
            pois={pois}
            placingMode={placingMode}
            selectedPoiId={selectedPoiId}
            onMapClick={handleMapClick}
            onPoiClick={(poi) => setSelectedPoiId(poi.id)}
          />
        </div>

        <PoiPanel
          pois={pois}
          placingMode={placingMode}
          pendingCoords={pendingCoords}
          onStartPlacing={() => {
            setPlacingMode(true)
            setPendingCoords(null)
          }}
          onCancelPlacing={() => {
            setPlacingMode(false)
            setPendingCoords(null)
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onSelectPoi={handleSelectPoi}
          selectedPoiId={selectedPoiId}
        />
      </div>
    </MapsLayout>
  )
}
