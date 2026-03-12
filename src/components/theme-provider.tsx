"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { useTheme, type ThemeProviderProps } from "next-themes"

function LegacyThemeNormalizer() {
  const { theme, setTheme } = useTheme()

  React.useEffect(() => {
    if (!theme || theme === "system") {
      setTheme("light")
    }
  }, [setTheme, theme])

  React.useEffect(() => {
    const resolvedTheme = theme === "dark" ? "dark" : "light"
    document.documentElement.classList.remove("light", "dark")
    document.documentElement.classList.add(resolvedTheme)
    document.documentElement.style.colorScheme =
      resolvedTheme === "dark" ? "only dark" : "only light"
  }, [theme])

  return null
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <LegacyThemeNormalizer />
      {children}
    </NextThemesProvider>
  )
}
