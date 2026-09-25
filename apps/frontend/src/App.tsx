import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext.js";
import { ThemeProvider } from "./context/ThemeContext.js";
import { RouteProtegee } from "./components/RouteProtegee.js";
import Shell from "./components/Shell.js";
import Connexion from "./screens/Connexion.js";
import DashboardSyndic from "./screens/DashboardSyndic.js";
import Assemblees from "./screens/Assemblees.js";
import AssembleeDetail from "./screens/AssembleeDetail.js";
import ListeIncidents from "./screens/ListeIncidents.js";
import ListeCharges from "./screens/ListeCharges.js";
import Coproprietaires from "./screens/Coproprietaires.js";
import Compte from "./screens/Compte.js";
import MotDePasseOublie from "./screens/MotDePasseOublie.js";
import Reinitialisation from "./screens/Reinitialisation.js";

function Accueil() {
  const { utilisateur } = useAuth();
  if (utilisateur?.typeCompte === "SYNDIC") {
    return <DashboardSyndic />;
  }
  return <Navigate to="/charges" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Shell>
            <Routes>
              <Route path="/connexion" element={<Connexion />} />
              <Route
                path="/mot-de-passe-oublie"
                element={<MotDePasseOublie />}
              />
              <Route path="/reinitialisation" element={<Reinitialisation />} />
              <Route
                path="/"
                element={
                  <RouteProtegee>
                    <Accueil />
                  </RouteProtegee>
                }
              />
              <Route
                path="/assemblees"
                element={
                  <RouteProtegee>
                    <Assemblees />
                  </RouteProtegee>
                }
              />
              <Route
                path="/assemblees/:idAg"
                element={
                  <RouteProtegee>
                    <AssembleeDetail />
                  </RouteProtegee>
                }
              />
              <Route
                path="/incidents"
                element={
                  <RouteProtegee>
                    <ListeIncidents />
                  </RouteProtegee>
                }
              />
              <Route
                path="/charges"
                element={
                  <RouteProtegee>
                    <ListeCharges />
                  </RouteProtegee>
                }
              />
              <Route
                path="/coproprietaires"
                element={
                  <RouteProtegee roles={["SYNDIC"]}>
                    <Coproprietaires />
                  </RouteProtegee>
                }
              />
              <Route
                path="/compte"
                element={
                  <RouteProtegee>
                    <Compte />
                  </RouteProtegee>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Shell>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
