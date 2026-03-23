export type Poi = {
  id: number
  name: string
  description: string | null
  category: string
  lat: number
  lng: number
  color: string
  createdAt: string
  updatedAt: string
}

export type PoiPayload = {
  name: string
  description?: string
  category: string
  lat: number
  lng: number
  color: string
}

export const POI_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'medical', label: 'Medical' },
  { value: 'water', label: 'Water' },
  { value: 'shelter', label: 'Shelter' },
  { value: 'food', label: 'Food' },
  { value: 'comms', label: 'Comms' },
  { value: 'hazard', label: 'Hazard' },
  { value: 'rally', label: 'Rally Point' },
] as const

export const POI_CATEGORY_COLORS: Record<string, string> = {
  general: '#3498db',
  medical: '#e74c3c',
  water: '#2980b9',
  shelter: '#8e44ad',
  food: '#27ae60',
  comms: '#f39c12',
  hazard: '#e67e22',
  rally: '#2ecc71',
}

export type BaseStylesFile = {
  version: number
  sources: {
    [key: string]: MapSource
  }
  layers: MapLayer[]
  sprite: string
  glyphs: string
}

export type MapSource = {
  type: 'vector' | 'raster' | 'raster-dem' | 'geojson' | 'image' | 'video'
  attribution?: string
  url: string
}

export type MapLayer = {
  'id': string
  'type': string
  'source'?: string
  'source-layer'?: string
  [key: string]: any
}
