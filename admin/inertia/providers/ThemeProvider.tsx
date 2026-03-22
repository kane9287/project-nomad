import { createContext, useContext } from 'react'
import { useTheme, Theme, Palette } from '~/hooks/useTheme'

interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
  palette: Palette
  setPalette: (palette: Palette) => void
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
  palette: 'desert',
  setPalette: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const themeState = useTheme()
  return (
    <ThemeContext.Provider value={themeState}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useThemeContext() {
  return useContext(ThemeContext)
}
