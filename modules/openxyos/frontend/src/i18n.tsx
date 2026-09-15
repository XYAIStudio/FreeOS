import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type Locale = "zh-CN" | "en";

type LocaleContextValue = {
  locale: Locale;
  isEnglish: boolean;
  setLocale: (locale: Locale) => void;
  toggleLocale: () => void;
  t: (zh: string, en: string) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);
const STORAGE_KEY = "openxyos.locale";
const URL_KEY = "lang";

function normalizeLocale(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "en" || normalized.startsWith("en-")) return "en";
  if (normalized === "zh" || normalized === "zh-cn" || normalized.startsWith("zh-hans")) return "zh-CN";
  return null;
}

function initialLocale(): Locale {
  const fromUrl = normalizeLocale(new URLSearchParams(window.location.search).get(URL_KEY));
  const saved = normalizeLocale(localStorage.getItem(STORAGE_KEY));
  const browser = normalizeLocale(navigator.languages?.[0] || navigator.language);
  return fromUrl || saved || browser || "zh-CN";
}

function persistLocale(locale: Locale) {
  localStorage.setItem(STORAGE_KEY, locale);
  const url = new URL(window.location.href);
  url.searchParams.set(URL_KEY, locale);
  window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const setLocale = (next: Locale) => setLocaleState(next);
  const toggleLocale = () => setLocaleState(current => current === "zh-CN" ? "en" : "zh-CN");

  useEffect(() => {
    persistLocale(locale);
    document.documentElement.lang = locale;
    document.documentElement.dir = "ltr";
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    isEnglish: locale === "en",
    setLocale,
    toggleLocale,
    t: (zh, en) => locale === "en" ? en : zh,
    formatDate: (input, options) => new Intl.DateTimeFormat(locale, options).format(new Date(input)),
    formatNumber: (input, options) => new Intl.NumberFormat(locale, options).format(input),
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}

export function LanguageToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return <label className={"language-select " + className}>
    <span className="sr-only">Language</span>
    <select value={locale} onChange={event => setLocale(event.target.value as Locale)} aria-label="Language">
      <option value="zh-CN">中文</option>
      <option value="en">English</option>
    </select>
  </label>;
}
