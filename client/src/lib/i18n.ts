import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "../locales/en.json";
import zhCN from "../locales/zh-CN.json";
import zhTW from "../locales/zh-TW.json";
import es from "../locales/es.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en:      { translation: en },
      "zh-CN": { translation: zhCN },
      "zh-TW": { translation: zhTW },
      es:      { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "zh-CN", "zh-TW", "es"],
    detection: {
      // Check localStorage first (manual preference), then browser language
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "favie_lang",
      // Map browser language codes (e.g. "zh", "zh-Hans") to our supported codes
      convertDetectedLanguage: (lng: string) => {
        if (lng === "zh" || lng === "zh-Hans" || lng === "zh-CN") return "zh-CN";
        if (lng === "zh-Hant" || lng === "zh-TW" || lng === "zh-HK") return "zh-TW";
        if (lng.startsWith("zh")) return "zh-CN";
        if (lng.startsWith("es")) return "es";
        return "en";
      },
    },
    interpolation: { escapeValue: false },
  });

export default i18n;
