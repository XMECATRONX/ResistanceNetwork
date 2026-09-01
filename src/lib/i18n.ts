import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import es from "./locales/es";

// Detect language from localStorage or browser
const savedLang =
  typeof localStorage !== "undefined"
    ? localStorage.getItem("resist-lang")
    : null;
const browserLang =
  typeof navigator !== "undefined" ? navigator.language.split("-")[0] : "en";
const defaultLang = savedLang || (browserLang === "es" ? "es" : "en");

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: defaultLang,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
