import { useState, useEffect, useCallback } from 'react'
import api from '~/lib/api'

export type Theme = 'light' | 'dark'
export type Palette = 'desert' | 'teal' | 'bootstrap' | 'pico' | 'bulma'

export const PALETTES: Palette[] = ['desert', 'teal', 'bootstrap', 'pico', 'bulma']

const THEME_STORAGE_KEY = 'nomad:theme'
const PALETTE_STORAGE_KEY = 'nomad:palette'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  return 'light'
}

function getInitialPalette(): Palette {
  try {
    const stored = localStorage.getItem(PALETTE_STORAGE_KEY)
    if (stored && (PALETTES as string[]).includes(stored)) return stored as Palette
  } catch {}
  return 'desert'
}

function applyPalette(palette: Palette) {
  if (palette === 'desert') {
    document.documentElement.removeAttribute('data-palette')
  } else {
    document.documentElement.setAttribute('data-palette', palette)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette)

  const setTheme = useCallback((newTheme: Theme) => {
    setThemeState(newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    } catch {}
    api.updateSetting('ui.theme', newTheme).catch(() => {})
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      document.documentElement.setAttribute('data-theme', next)
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {}
      api.updateSetting('ui.theme', next).catch(() => {})
      return next
    })
  }, [])

  const setPalette = useCallback((newPalette: Palette) => {
    setPaletteState(newPalette)
    applyPalette(newPalette)
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, newPalette)
    } catch {}
    api.updateSetting('ui.palette', newPalette).catch(() => {})
  }, [])

  // Apply both theme and palette on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    applyPalette(palette)
  }, [])

  return { theme, setTheme, toggleTheme, palette, setPalette }
}
