import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Login } from "./paginas/Login";
import { LayoutDashboard } from "./layouts/LayoutDashboard";
import { DashboardHome } from "./paginas/DashboardHome";
import { ConfiguracaoAgente } from "./paginas/ConfiguracaoAgente";
import { Leads } from "./paginas/Leads";
import { Mineracao } from "./paginas/Mineracao";
import { Campanhas } from "./paginas/Campanhas";
import { CampanhaDetalhes } from "./paginas/CampanhaDetalhes";
import { Configuracao } from "./paginas/Configuracao";
import { WhatsAppProvider } from "./contextos/WhatsAppContext";

// Rota Protegida
function RotaPrivada({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("elyon_token");
  return token ? (
    <WhatsAppProvider>{children}</WhatsAppProvider>
  ) : (
    <Navigate to="/login" />
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Rotas do Dashboard */}
        <Route
          path="/dashboard"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <DashboardHome />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/agente"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <ConfiguracaoAgente />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/leads"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Leads />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/campanhas"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Campanhas />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/campanhas/:id"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <CampanhaDetalhes />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/mineracao"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Mineracao />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/configuracoes"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Configuracao />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        {/* Placeholder para outras rotas */}
        <Route
          path="/dashboard/*"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <div className="flex items-center justify-center h-full text-slate-400">
                  Página em construção
                </div>
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
