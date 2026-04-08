import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { Login } from "./paginas/Login";
import { LayoutDashboard } from "./layouts/LayoutDashboard";
import { ConfiguracaoAgente } from "./paginas/ConfiguracaoAgente";
import { DashboardAgentes } from "./paginas/DashboardAgentes";
import { Leads } from "./paginas/Leads";
import LeadDetalhes from "./paginas/LeadDetalhes";
import ConfirmarAgendamento from "./paginas/ConfirmarAgendamento";
import { Mineracao } from "./paginas/Mineracao";
import { Captacao } from "./paginas/Captacao";
import { Campanhas } from "./paginas/Campanhas";
import { CampanhaDetalhes } from "./paginas/detalhes-campanha";
import ContatoDetalhes from "./paginas/ContatoDetalhes";
import Listas from "./paginas/Listas";
import ListaDetalhes from "./paginas/ListaDetalhes";
import { Relatorios } from "./paginas/Relatorios";
import { Configuracao } from "./paginas/Configuracao";
import { PerfilImobiliaria } from "./paginas/PerfilImobiliaria";
import DashboardProspeccao from "./paginas/DashboardProspeccao";
import { Blacklist } from "./paginas/Blacklist";
import { Creditos } from "./paginas/Creditos";
import { WhatsAppProvider } from "./contextos/WhatsAppContext";
import { SessoesWhatsapp } from "./paginas/SessoesWhatsapp";
import { MeusAgentes } from "./paginas/MeusAgentes";
import { Upgrade } from "./paginas/Upgrade";
import AceitarContrato from "./paginas/AceitarContrato";
import { CarteiraClientes } from "./paginas/CarteiraClientes";
import { Agenda } from "./paginas/Agenda";
import { Integracoes } from "./paginas/Integracoes";
import { ConfiguracaoLLM } from "./paginas/ConfiguracaoLLM";
import GestaoUsuarios from "./paginas/GestaoUsuarios";

// Páginas Admin
import { AdminClientes, AdminTransacoes, AdminLeadsVip, AdminPacotes, AdminPlanos } from "./paginas/admin";

// Rota Protegida
function RotaPrivada({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("elyon_token");
  return token ? (
    <WhatsAppProvider>{children}</WhatsAppProvider>
  ) : (
    <Navigate to="/login" />
  );
}

// Rota Protegida para Admin (verifica papel SUPER_ADMIN)
function RotaAdmin({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("elyon_token");
  const usuario = JSON.parse(localStorage.getItem("elyon_usuario") || "{}");

  if (!token) {
    return <Navigate to="/login" />;
  }

  if (usuario.papel !== "SUPER_ADMIN") {
    return <Navigate to="/dashboard" />;
  }

  return <WhatsAppProvider>{children}</WhatsAppProvider>;
}

function App() {
  return (
    <BrowserRouter>
      {/* Sistema de Notificações Toast */}
      <Toaster
        position="top-right"
        richColors
        closeButton
        duration={5000}
        toastOptions={{
          style: {
            background: "white",
            border: "1px solid #e2e8f0",
          },
        }}
      />

      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Rota Pública - Confirmação de Agendamento */}
        <Route
          path="/confirmar/:atividadeId/:token"
          element={<ConfirmarAgendamento />}
        />

        {/* Rota Pública - Aceite de Contrato Digital */}
        <Route
          path="/aceitar-contrato/:token"
          element={<AceitarContrato />}
        />

        {/* Redireciona /dashboard para /dashboard/prospeccao */}
        <Route
          path="/dashboard"
          element={<Navigate to="/dashboard/prospeccao" replace />}
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
          path="/dashboard/agente/:id"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <ConfiguracaoAgente />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/agentes"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <MeusAgentes />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/agenda"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Agenda />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/whatsapp"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <SessoesWhatsapp />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/sessoes-whatsapp"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <SessoesWhatsapp />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/agente/performance"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <DashboardAgentes />
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
          path="/dashboard/leads/:id"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <LeadDetalhes />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/clientes"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <CarteiraClientes />
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
          path="/dashboard/campanhas/:campanhaId/contatos/:contatoId"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <ContatoDetalhes />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/prospeccao"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <DashboardProspeccao />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/listas"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Listas />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/listas/:id"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <ListaDetalhes />
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
          path="/dashboard/captacao"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Captacao />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/relatorios"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Relatorios />
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

        <Route
          path="/dashboard/blacklist"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Blacklist />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/perfil"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <PerfilImobiliaria />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/creditos"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Creditos />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/upgrade"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Upgrade />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/integracoes"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <Integracoes />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/configuracao-llm"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <ConfiguracaoLLM />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        <Route
          path="/dashboard/equipe"
          element={
            <RotaPrivada>
              <LayoutDashboard>
                <GestaoUsuarios />
              </LayoutDashboard>
            </RotaPrivada>
          }
        />

        {/* Placeholder para outras rotas dashboard */}
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

        {/* ============================================ */}
        {/* ROTAS ADMIN (APENAS SUPER_ADMIN)            */}
        {/* ============================================ */}

        <Route
          path="/admin/clientes"
          element={
            <RotaAdmin>
              <LayoutDashboard>
                <AdminClientes />
              </LayoutDashboard>
            </RotaAdmin>
          }
        />

        <Route
          path="/admin/transacoes"
          element={
            <RotaAdmin>
              <LayoutDashboard>
                <AdminTransacoes />
              </LayoutDashboard>
            </RotaAdmin>
          }
        />

        <Route
          path="/admin/leads-vip"
          element={
            <RotaAdmin>
              <LayoutDashboard>
                <AdminLeadsVip />
              </LayoutDashboard>
            </RotaAdmin>
          }
        />

        <Route
          path="/admin/pacotes"
          element={
            <RotaAdmin>
              <LayoutDashboard>
                <AdminPacotes />
              </LayoutDashboard>
            </RotaAdmin>
          }
        />

        <Route
          path="/admin/planos"
          element={
            <RotaAdmin>
              <LayoutDashboard>
                <AdminPlanos />
              </LayoutDashboard>
            </RotaAdmin>
          }
        />

        <Route path="/" element={<Navigate to="/dashboard/prospeccao" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
