import { Head } from '@inertiajs/react'
import SettingsLayout from '~/layouts/SettingsLayout'
import { useThemeContext } from '~/providers/ThemeProvider'
import type { Palette, CustomColors } from '~/hooks/useTheme'
import { IconCheck, IconMoon, IconSun, IconPalette } from '@tabler/icons-react'
import classNames from '~/lib/classNames'

type PaletteOption = {
  id: Palette
  name: string
  description: string
  accent: string
  bg: string
  darkAccent: string
  darkBg: string
  swatches: string[]
}

const PALETTE_OPTIONS: PaletteOption[] = [

  {
    id: 'desert',
    name: 'Desert Ops',
    description: 'Original olive and sand — the default field-ready palette',
    accent: '#424420',
    bg: '#f7eedc',
    darkAccent: '#525530',
    darkBg: '#1c1b16',
    swatches: ['#424420', '#6d7042', '#f7eedc', '#babaaa'],
  },

  {
    id: 'teal',
    name: 'Teal',
    description: 'Clean teal and cyan — calm, modern, and easy on the eyes',
    accent: '#0d9488',
    bg: '#f0fdfa',
    darkAccent: '#2dd4bf',
    darkBg: '#0d1f1f',
    swatches: ['#0d9488', '#14b8a6', '#f0fdfa', '#5eead4'],
  },

  {
    id: 'bootstrap',
    name: 'Bootstrap',
    description: 'Classic Bootstrap blue — familiar, professional, and clean',
    accent: '#0d6efd',
    bg: '#f8f9fa',
    darkAccent: '#6ea8fe',
    darkBg: '#212529',
    swatches: ['#0d6efd', '#0b5ed7', '#f8f9fa', '#6ea8fe'],
  },

  {
    id: 'pico',
    name: 'Pico',
    description: 'Elegant indigo and violet — minimal and refined (Pico.css)',
    accent: '#6366f1',
    bg: '#fafafa',
    darkAccent: '#818cf8',
    darkBg: '#1a1a2e',
    swatches: ['#6366f1', '#4f46e5', '#fafafa', '#a5b4fc'],
  },

  {
    id: 'bulma',
    name: 'Bulma',
    description: 'Vibrant turquoise — bold and energetic (Bulma CSS)',
    accent: '#00d1b2',
    bg: '#ffffff',
    darkAccent: '#00d1b2',
    darkBg: '#141a20',
    swatches: ['#00d1b2', '#00b09a', '#ffffff', '#4de8d0'],
  },

]

type ColorField = {
  key: keyof CustomColors
  label: string
  hint: string
}

const CUSTOM_COLOR_FIELDS: ColorField[] = [
  { key: 'accent',      label: 'Accent',           hint: 'Buttons, links, selected states' },
  { key: 'accentHover', label: 'Accent Hover',      hint: 'Hover / active shade of accent' },
  { key: 'border',      label: 'Border',            hint: 'Default border color' },
  { key: 'bg',          label: 'Background (Day)',  hint: 'Page background in light mode' },
  { key: 'bgDark',      label: 'Background (Night)',hint: 'Page background in dark mode' },
]

export default function AppearancePage() {
  const { theme, toggleTheme, palette, setPalette, customColors, setCustomColors } = useThemeContext()
  const isDark = theme === 'dark'

  function handleColorChange(key: keyof CustomColors, value: string) {
    setCustomColors({ ...customColors, [key]: value })
  }

  return (
    <SettingsLayout>
      <Head title="Appearance" />
      <div className="xl:pl-72 w-full">
        <main className="px-12 py-6 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-4xl font-semibold">Appearance</h1>
            <p className="text-text-muted mt-1">Customize the look and feel of your NOMAD instance.</p>
          </div>


          {/* Mode toggle */}

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-1">Mode</h2>
            <p className="text-sm text-text-muted mb-4">Switch between light and dark mode.</p>
            <div className="flex gap-3">
              <button
                onClick={() => { if (isDark) toggleTheme() }}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-sm transition-all',
                  !isDark
                    ? 'border-desert-green bg-desert-green text-white'
                    : 'border-border-default bg-surface-primary text-text-secondary hover:border-desert-green'
                )}
              >
                <IconSun className="size-4" />
                Day Ops

                {!isDark && <IconCheck className="size-4 ml-1" />}

              </button>
              <button
                onClick={() => { if (!isDark) toggleTheme() }}
                className={classNames(
                  'flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 font-medium text-sm transition-all',
                  isDark
                    ? 'border-desert-green bg-desert-green text-white'
                    : 'border-border-default bg-surface-primary text-text-secondary hover:border-desert-green'
                )}
              >
                <IconMoon className="size-4" />
                Night Ops

                {isDark && <IconCheck className="size-4 ml-1" />}

              </button>
            </div>
          </section>


          {/* Palette picker */}

          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-1">Color Palette</h2>
            <p className="text-sm text-text-muted mb-4">
              Choose an accent color palette. Combines with both Day and Night Ops modes.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

              {PALETTE_OPTIONS.map((option) => {
                const isSelected = palette === option.id
                const previewAccent = isDark ? option.darkAccent : option.accent
                const previewBg = isDark ? option.darkBg : option.bg

                return (
                  <button
                    key={option.id}
                    onClick={() => setPalette(option.id)}
                    className={classNames(
                      'relative text-left rounded-xl border-2 p-4 transition-all hover:shadow-md',
                      isSelected
                        ? 'border-desert-green shadow-md'
                        : 'border-border-subtle hover:border-border-default'
                    )}
                  >
                    {isSelected && (
                      <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-desert-green text-white">
                        <IconCheck className="size-3" />
                      </span>
                    )}

                    {/* Mini preview */}
                    <div
                      className="rounded-lg mb-3 p-3 flex items-center gap-2 border border-black/10"
                      style={{ backgroundColor: previewBg }}
                    >
                      <div
                        className="w-8 h-8 rounded-md flex-shrink-0"
                        style={{ backgroundColor: previewAccent }}
                      />
                      <div className="flex gap-1.5 flex-wrap">
                        {option.swatches.map((color) => (
                          <div
                            key={color}
                            className="w-5 h-5 rounded-full border border-black/10"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <p className="font-semibold text-text-primary text-sm">{option.name}</p>
                    <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{option.description}</p>
                  </button>
                )
              })}

              {/* Custom palette card */}
              <button
                onClick={() => setPalette('custom')}
                className={classNames(
                  'relative text-left rounded-xl border-2 p-4 transition-all hover:shadow-md',
                  palette === 'custom'
                    ? 'border-desert-green shadow-md'
                    : 'border-border-subtle hover:border-border-default'
                )}
              >
                {palette === 'custom' && (
                  <span className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full bg-desert-green text-white">
                    <IconCheck className="size-3" />
                  </span>
                )}

                {/* Mini preview */}
                <div
                  className="rounded-lg mb-3 p-3 flex items-center gap-2 border border-black/10"
                  style={{ backgroundColor: isDark ? customColors.bgDark : customColors.bg }}
                >
                  <div
                    className="w-8 h-8 rounded-md flex-shrink-0"
                    style={{ backgroundColor: customColors.accent }}
                  />
                  <div className="flex gap-1.5 flex-wrap">
                    {[customColors.accent, customColors.accentHover, customColors.border].map((color) => (
                      <div
                        key={color}
                        className="w-5 h-5 rounded-full border border-black/10"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <IconPalette className="size-3.5 text-text-muted" />
                  <p className="font-semibold text-text-primary text-sm">Custom</p>
                </div>
                <p className="text-xs text-text-muted mt-0.5 leading-relaxed">Define your own accent and background colors</p>
              </button>

            </div>
          </section>


          {/* Custom color editor — only shown when custom palette is active */}

          {palette === 'custom' && (
            <section>
              <h2 className="text-lg font-semibold mb-1">Custom Colors</h2>
              <p className="text-sm text-text-muted mb-4">
                Pick your own colors. Changes apply instantly.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CUSTOM_COLOR_FIELDS.map(({ key, label, hint }) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-primary p-3"
                  >
                    <label
                      htmlFor={`color-${key}`}
                      className="relative flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden border-2 border-black/10 cursor-pointer"
                      style={{ backgroundColor: customColors[key] }}
                    >
                      <input
                        id={`color-${key}`}
                        type="color"
                        value={customColors[key]}
                        onChange={(e) => handleColorChange(key, e.target.value)}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      />
                    </label>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">{label}</p>
                      <p className="text-xs text-text-muted truncate">{hint}</p>
                      <p className="text-xs font-mono text-text-muted mt-0.5">{customColors[key]}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </main>
      </div>
    </SettingsLayout>
  )
}
