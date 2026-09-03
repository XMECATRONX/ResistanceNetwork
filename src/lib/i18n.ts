import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import es from "./locales/es";
import { transparencyEn, transparencyEs } from "./locales/transparency";
import { overviewEn, overviewEs } from "./locales/overview";
import { stablecoinEn, stablecoinEs } from "./locales/stablecoin";

// Detect language from localStorage or browser
const savedLang =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("resist-lang")
    : null;
const browserLang =
  typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";
const defaultLang = savedLang || (browserLang === "es" ? "es" : "en");

// Merge transparency keys into the views.transparency namespace
const enMerged = {
  ...en,
  sidebar: {
    ...en.sidebar,
    nav: {
      ...en.sidebar.nav,
      stablecoin: stablecoinEn.nav,
    },
  },
  views: {
    ...en.views,
    overview: {
      ...en.views.overview,
      ...overviewEn,
    },
    transparency: {
      ...en.views.transparency,
      ...transparencyEn,
    },
    stablecoin: {
      ...stablecoinEn,
    },
  },
};
const esMerged = {
  ...es,
  sidebar: {
    ...es.sidebar,
    nav: {
      ...es.sidebar.nav,
      stablecoin: stablecoinEs.nav,
    },
  },
  views: {
    ...es.views,
    overview: {
      ...es.views.overview,
      ...overviewEs,
    },
    transparency: {
      ...es.views.transparency,
      ...transparencyEs,
    },
    stablecoin: {
      ...stablecoinEs,
    },
  },
};

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enMerged },
    es: { translation: esMerged },
  },
  lng: defaultLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
