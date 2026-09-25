import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "@fontsource-variable/inter/wght.css"; // police Inter auto-hébergée (aucune requête vers un tiers)
import "./index.css";
import { appliquerTheme } from "./theme/appliquerTheme.js";
import { genererTheme } from "./theme/genererTheme.js";
import { lireThemeCache } from "./theme/themeStorage.js";

// Thème mis en cache lors de la dernière visite : appliqué avant le premier rendu pour éviter un flash
// de la couleur d'origine. Le serveur (`/auth/moi`) a ensuite le dernier mot (cf. ThemeContext).
const themeCache = lireThemeCache();
if (themeCache)
  appliquerTheme(document.documentElement, genererTheme(themeCache));

// Presentation Layer pur : aucun accès direct à la base ou au Business
// Layer, uniquement des appels HTTP vers l'API backend (cf. ADR-001).
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
