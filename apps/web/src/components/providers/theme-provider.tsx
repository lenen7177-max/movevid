import { ScriptOnce } from "@tanstack/react-router";
import { createIsomorphicFn } from "@tanstack/react-start";
import { createContext, type ReactNode, use, useEffect, useState } from "react";

const themeStorageKey = "ui-theme";
const themeCookieMaxAge = 60 * 60 * 24 * 365;
// Dark is the default; a visitor who picked light keeps it.
const themeScript = `(function(){try{var theme=localStorage.getItem("${themeStorageKey}")==="light"?"light":"dark";document.documentElement.classList.remove("light","dark");document.documentElement.classList.add(theme)}catch(e){document.documentElement.classList.add("dark")}})()`;

type Theme = "light" | "dark";

const getStoredTheme = createIsomorphicFn()
  .server((): Theme => "dark")
  .client((): Theme => (localStorage.getItem(themeStorageKey) === "light" ? "light" : "dark"));

type ThemeContextProps = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    document.cookie = `${themeStorageKey}=${theme}; path=/; max-age=${themeCookieMaxAge}; SameSite=Lax`;
  }, [theme]);

  const setTheme = (nextTheme: Theme) => {
    setThemeState(nextTheme);
    localStorage.setItem(themeStorageKey, nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <ScriptOnce>{themeScript}</ScriptOnce>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
