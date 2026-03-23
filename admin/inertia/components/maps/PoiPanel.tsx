import { useState, useEffect } from 'react'
import {
  IconMapPin,
  IconX,
  IconTrash,
  IconEdit,
  IconCheck,
  IconChevronLeft,
} from '@tabler/icons-react'
import type { Poi, PoiPayload } from '../../../types/maps'
import { POI_CATEGORIES, POI_CATEGORY_COLORS } from '../../../types/maps'
import StyledButton from '~/components/StyledButton'

type Mode = 'list' | 'add-placing' | 'add-form' | 'edit'

interface PoiPanelProps {
  open: boolean
  onClose: () => void
  pois: Poi[]
  placingMode: boolean
  pendingCoords: { lat: number; lng: number } | null
  onStartPlacing: () => void
  onCancelPlacing: () => void
  onCreate: (payload: PoiPayload) => Promise<void>
  onUpdate: (id: number, payload: Partial<PoiPayload>) => Promise<void>
  onDelete: (id: number) => Promise<void>
  onSelectPoi: (poi: Poi | null) => void
  selectedPoiId: number | null
}

const defaultForm = (): Omit<PoiPayload, 'lat' | 'lng'> => ({
  name: '',
  description: '',
  category: 'general',
  color: POI_CATEGORY_COLORS['general'],
})

export default function PoiPanel({
  open,
  onClose,
  pois,
  placingMode,
  pendingCoords,
  onStartPlacing,
  onCancelPlacing,
  onCreate,
  onUpdate,
  onDelete,
  onSelectPoi,
  selectedPoiId,
}: PoiPanelProps) {
  const [mode, setMode] = useState<Mode>('list')
  const [form, setForm] = useState(defaultForm())
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  // Reset panel state when closed
  useEffect(() => {
    if (!open) {
      setMode('list')
      setForm(defaultForm())
      setEditId(null)
      setDeleteConfirmId(null)
    }
  }, [open])

  // When map click sets pending coords, advance from placing to form
  useEffect(() => {
    if (placingMode && pendingCoords && mode === 'add-placing') {
      setMode('add-form')
    }
  }, [pendingCoords, placingMode, mode])

  const handleClose = () => {
    if (placingMode) onCancelPlacing()
    onSelectPoi(null)
    onClose()
  }

  const handleStartAdd = () => {
    setMode('add-placing')
    onStartPlacing()
  }

  const handleCategoryChange = (category: string) => {
    setForm((f) => ({ ...f, category, color: POI_CATEGORY_COLORS[category] ?? f.color }))
  }

  const handleEdit = (poi: Poi) => {
    setEditId(poi.id)
    setForm({
      name: poi.name,
      description: poi.description ?? '',
      category: poi.category,
      color: poi.color,
    })
    setMode('edit')
  }

  const handleSaveNew = async () => {
    if (!pendingCoords || !form.name.trim()) return
    setSaving(true)
    try {
      await onCreate({ ...form, lat: pendingCoords.lat, lng: pendingCoords.lng })
      setMode('list')
      setForm(defaultForm())
      onCancelPlacing()
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (editId === null || !form.name.trim()) return
    setSaving(true)
    try {
      await onUpdate(editId, form)
      setMode('list')
      setEditId(null)
      setForm(defaultForm())
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    setSaving(true)
    try {
      await onDelete(id)
      setDeleteConfirmId(null)
      if (mode === 'edit' && editId === id) {
        setMode('list')
        setEditId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  const renderForm = (onSave: () => void, onBack: () => void) => (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2 mb-1">
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-surface-tertiary text-text-secondary"
        >
          <IconChevronLeft size={16} />
        </button>
        <span className="text-sm font-semibold text-text-primary">
          {mode === 'edit' ? 'Edit POI' : 'New POI'}
        </span>
      </div>

      {mode === 'add-form' && pendingCoords && (
        <div className="text-xs text-text-secondary bg-surface-secondary rounded px-2 py-1">
          {pendingCoords.lat.toFixed(5)}, {pendingCoords.lng.toFixed(5)}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary font-medium">Name *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="POI name"
          className="text-sm rounded border border-border bg-surface-secondary text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary font-medium">Category</label>
        <select
          value={form.category}
          onChange={(e) => handleCategoryChange(e.target.value)}
          className="text-sm rounded border border-border bg-surface-secondary text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
        >
          {POI_CATEGORIES.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary font-medium">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Optional notes..."
          rows={3}
          className="text-sm rounded border border-border bg-surface-secondary text-text-primary px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-text-secondary font-medium">Color</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
          />
          <span className="text-xs text-text-secondary">{form.color}</span>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <StyledButton
          variant="primary"
          size="sm"
          onClick={onSave}
          loading={saving}
          disabled={!form.name.trim()}
          className="flex-1"
        >
          Save
        </StyledButton>
        <StyledButton variant="secondary" size="sm" onClick={onBack} disabled={saving}>
          Cancel
        </StyledButton>
      </div>
    </div>
  )

  const renderList = () => (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold text-text-primary">
          Points of Interest ({pois.length})
        </span>
        <StyledButton variant="primary" size="sm" icon="IconPlus" onClick={handleStartAdd}>
          Add
        </StyledButton>
      </div>

      <div className="flex-1 overflow-y-auto">
        {pois.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-secondary p-6 text-center">
            <IconMapPin size={32} className="opacity-40" />
            <p className="text-sm">No POIs yet.</p>
            <p className="text-xs">Click "Add" then tap the map to place a pin.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {pois.map((poi) => (
              <li
                key={poi.id}
                className={`px-4 py-3 flex items-start gap-3 hover:bg-surface-secondary transition-colors cursor-pointer ${
                  selectedPoiId === poi.id ? 'bg-surface-secondary' : ''
                }`}
                onClick={() => onSelectPoi(selectedPoiId === poi.id ? null : poi)}
              >
                <span
                  className="mt-0.5 flex-shrink-0 w-3 h-3 rounded-full"
                  style={{ backgroundColor: poi.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{poi.name}</p>
                  <p className="text-xs text-text-secondary capitalize">{poi.category}</p>
                  {poi.description && (
                    <p className="text-xs text-text-secondary truncate mt-0.5">{poi.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {deleteConfirmId === poi.id ? (
                    <>
                      <button
                        className="p-1 rounded text-desert-red hover:bg-desert-red hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(poi.id)
                        }}
                        title="Confirm delete"
                      >
                        <IconCheck size={14} />
                      </button>
                      <button
                        className="p-1 rounded text-text-secondary hover:bg-surface-tertiary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(null)
                        }}
                        title="Cancel"
                      >
                        <IconX size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="p-1 rounded text-text-secondary hover:bg-surface-tertiary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(poi)
                        }}
                        title="Edit"
                      >
                        <IconEdit size={14} />
                      </button>
                      <button
                        className="p-1 rounded text-text-secondary hover:bg-surface-tertiary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(poi.id)
                        }}
                        title="Delete"
                      >
                        <IconTrash size={14} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Placing mode banner */}
      {placingMode && mode === 'add-placing' && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 bg-surface-primary border border-border rounded-lg shadow-lg px-4 py-2 flex items-center gap-3">
          <IconMapPin size={16} className="text-primary" />
          <span className="text-sm text-text-primary">Click on the map to place your pin</span>
          <button
            className="text-xs text-text-secondary hover:text-text-primary"
            onClick={() => {
              onCancelPlacing()
              setMode('list')
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Side panel — top-[65px] to sit below the banner bar */}
      {open && (
        <div className="absolute right-0 top-[65px] bottom-0 z-40 w-72 bg-surface-primary border-l border-border shadow-xl flex flex-col">
          <div className="flex-1 overflow-hidden">
            {(mode === 'list' || mode === 'add-placing') && renderList()}
            {mode === 'add-form' &&
              renderForm(handleSaveNew, () => {
                setMode('list')
                onCancelPlacing()
              })}
            {mode === 'edit' &&
              renderForm(handleSaveEdit, () => {
                setMode('list')
                setEditId(null)
                setForm(defaultForm())
              })}
          </div>
        </div>
      )}
    </>
  )
}
