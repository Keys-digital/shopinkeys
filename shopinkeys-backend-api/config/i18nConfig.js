const i18n = require("i18next");
const Backend = require("i18next-fs-backend");
const { join } = require("path");

i18n.use(Backend).init({
  initImmediate: false,
  fallbackLng: "en",
  preload: [
    "ar",
    "de",
    "en",
    "es",
    "fr",
    "it",
    "ja",
    "ko",
    "ru",
    "zh-CN",
    "zh-TW",
  ],
  backend: {
    loadPath: join(__dirname, "../locales/{{lng}}/{{ns}}.json"),
  },
  ns: ["common", "errors", "auth"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

module.exports = i18n;
