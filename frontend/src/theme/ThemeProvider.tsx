import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { readStorage, writeStorage } from '../lib/storage'
import { ThemeContext, type Theme } from './context'

const STORAGE_KEY = 'headwind-theme'

function storedTheme(): Theme {
  return readStorage(localStorage, STORAGE_KEY) === 'light' ? 'light' : 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.className = theme
}

applyTheme(storedTheme())

export default function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(storedTheme)

  // The class changes before React re-renders, so children that read computed
  // colours (the map) see the new theme's values.
  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    setThemeState(next)
    writeStorage(localStorage, STORAGE_KEY, next)
  }, [])

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
