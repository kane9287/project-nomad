import { useState, useEffect, useCallback } from 'react'
import api from '~/lib/api'

export type Theme = 'light' | 'dark'
export type Palette = 'desert' | 'teal' | 'bootstrap' | 'pico' | 'bulma' | 'custom'

export const PALETTES: Palette[] = ['desert', 'teal', 'bootstrap', 'pico', 'bulma', 'custom']

export interface CustomColors {
  accent: string        // primary action color (buttons, links, selected states)
  accentHover: string   // hover shade of accent
  bg: string            // page background (light mode)
  bgDark: string        // page background (dark mode)
  border: string        // border color
}

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  accent: '#7c3aed',
  accentHover: '#6d28d9',
  bg: '#fafafa',
  bgDark: '#1a1025',
  border: '#7c3aed',
}

const THEME_STORAGE_KEY = 'nomad:theme'
const PALETTE_STORAGE_KEY = 'nomad:palette'
const CUSTOM_COLORS_STORAGE_KEY = 'nomad:custom-colors'

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

function getInitialCustomColors(): CustomColors {
  try {
    const stored = localStorage.getItem(CUSTOM_COLORS_STORAGE_KEY)
    if (stored) return { ...DEFAULT_CUSTOM_COLORS, ...JSON.parse(stored) }
  } catch {}
  return DEFAULT_CUSTOM_COLORS
}

function applyCustomColors(colors: CustomColors, theme: Theme) {
  const root = document.documentElement
  const isDark = theme === 'dark'
  root.style.setProperty('--color-desert-green', colors.accent)
  root.style.setProperty('--color-desert-green-dark', colors.accentHover)
  root.style.setProperty('--color-btn-green-hover', colors.accentHover)
  root.style.setProperty('--color-border-default', colors.border)
  root.style.setProperty('--color-desert-sand', isDark ? colors.bgDark : colors.bg)
}

function clearCustomColors() {
  const root = document.documentElement
  root.style.removeProperty('--color-desert-green')
  root.style.removeProperty('--color-desert-green-dark')
  root.style.removeProperty('--color-btn-green-hover')
  root.style.removeProperty('--color-border-default')
  root.style.removeProperty('--color-desert-sand')
}

function applyPalette(palette: Palette, customColors?: CustomColors, theme: Theme = 'light') {
  if (palette === 'desert') {
    document.documentElement.removeAttribute('data-palette')
    clearCustomColors()
  } else if (palette === 'custom') {
    document.documentElement.removeAttribute('data-palette')
    if (customColors) applyCustomColors(customColors, theme)
  } else {
    clearCustomColors()
    document.documentElement.setAttribute('data-palette', palette)
  }
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)
  const [palette, setPaletteState] = useState<Palette>(getInitialPalette)
  const [customColors, setCustomColorsState] = useState<CustomColors>(getInitialCustomColors)

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
    setCustomColorsState((currentColors) => {
      const currentTheme = (document.documentElement.getAttribute('data-theme') as Theme) ?? 'light'
      applyPalette(newPalette, currentColors, currentTheme)
      return currentColors
    })
    try {
      localStorage.setItem(PALETTE_STORAGE_KEY, newPalette)
    } catch {}
    api.updateSetting('ui.palette', newPalette).catch(() => {})
  }, [])

  const setCustomColors = useCallback((newColors: CustomColors) => {
    setCustomColorsState(newColors)
    setPaletteState((currentPalette) => {
      if (currentPalette === 'custom') {
        const currentTheme = (document.documentElement.getAttribute('data-theme') as Theme) ?? 'light'
        applyCustomColors(newColors, currentTheme)
      }
      return currentPalette
    })
    try {
      localStorage.setItem(CUSTOM_COLORS_STORAGE_KEY, JSON.stringify(newColors))
    } catch {}
  }, [])

  // Apply both theme and palette on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    applyPalette(palette, customColors, theme)
  }, [])

  // Re-apply custom colors when theme changes (bg color differs between light/dark)
  useEffect(() => {
    if (palette === 'custom') {
      applyCustomColors(customColors, theme)
    }
  }, [theme, palette, customColors])

  return { theme, setTheme, toggleTheme, palette, setPalette, customColors, setCustomColors }
}
