import { useParams } from "react-router-dom";
import { Button } from "../../componentes/ui/button";
import { UploadCSV } from "../../componentes/UploadCSV";
import { EditorBriefing } from "../../componentes/EditorBriefing";
import { PainelDisparo } from "../../componentes/PainelDisparo";
import { BotaoPesquisaManus } from "../../componentes/campanhas/PesquisaManus";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../componentes/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../componentes/ui/dialog";
import {
  ArrowLeft,
  Building2,
  Users,
  Target,
  Loader2,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Pause,
  PauseCircle,
  Play,
  Archive,
  Upload,
  X,
  Trash2,
  List,
  Zap,
  Brain,
} from "lucide-react";

// Hooks e componentes internos
import { useCampanhaDetalhes, getStatusColor, StatusCampanha } from "./hooks/useCampanhaDetalhes";
import { AbaVisaoGeral } from "./abas/AbaVisaoGeral";
import { AbaContatos } from "./abas/AbaContatos";
import { ModalImportarLista } from "./modais/ModalImportarLista";

export function CampanhaDetalhes() {
  const { id } = useParams<{ id: string }>();
  const hook = useCampanhaDetalhes(id);

  const {
    campanha,
    loading,
    erro,
    contatos,
    loadingContatos,
    paginaAtual,
    totalContatos,
    totalPaginas,
    filtroStatus,
    estatisticasContatos,
    listas,
    listaSelecionada,
    carregandoListas,
    importandoDeLista,
    notificacao,
    processando,
    novoStatusPendente,
    abaAtiva,
    setAbaAtiva,
    modalImportacaoOpen,
    setModalImportacaoOpen,
    modalListaOpen,
    setModalListaOpen,
    modalExcluirOpen,
    setModalExcluirOpen,
    modalStatusOpen,
    setModalStatusOpen,
    abaImportacao,
    setAbaImportacao,
    textoImportacao,
    setTextoImportacao,
    importando,
    setPaginaAtual,
    setFiltroStatus,
    setListaSelecionada,
    carregarCampanha,
    carregarContatos,
    exportarContatos,
    excluirCampanha,
    confirmarAtualizarStatus,
    executarAtualizarStatus,
    setNovoStatusPendente,
    importarContatos,
    abrirModalLista,
    importarDeLista,
    salvarBriefing,
    mostrarNotificacao,
    fecharNotificacao,
    navigate,
  } = hook;

  const getStatusModalConfig = () => {
    const configs: Record<StatusCampanha, {
      titulo: string;
      mensagem: string;
      icone: typeof PauseCircle;
      corIcone: string;
      corBotao: string;
    }> = {
      PAUSADA: {
        titulo: 'Pausar Campanha',
        mensagem: `Deseja pausar a campanha "${campanha?.nome}"? Os contatos não serão processados enquanto pausada.`,
        icone: PauseCircle,
        corIcone: 'text-amber-500',
        corBotao: 'bg-amber-600 hover:bg-amber-700'
      },
      FINALIZADA: {
        titulo: 'Finalizar Campanha',
        mensagem: `Deseja finalizar a campanha "${campanha?.nome}"? Esta ação encerrará definitivamente a campanha.`,
        icone: CheckCircle2,
        corIcone: 'text-emerald-500',
        corBotao: 'bg-success hover:bg-success-dark'
      },
      ATIVA: {
        titulo: 'Reativar Campanha',
        mensagem: `Deseja reativar a campanha "${campanha?.nome}"? O processamento dos contatos será retomado.`,
        icone: Play,
        corIcone: 'text-indigo-500',
        corBotao: 'bg-brand hover:bg-brand-dark'
      }
    };
    return novoStatusPendente ? configs[novoStatusPendente] : null;
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-2 md:px-4 flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }

  if (erro || !campanha) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-2 md:px-4 space-y-4">
        <Button
          variant="ghost"
          onClick={() => navigate("/dashboard/campanhas")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
        <div className="bg-red-50 text-red-600 p-4 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {erro || "Campanha não encontrada"}
        </div>
      </div>
    );
  }

  const briefing = campanha.briefingEstruturado;
  const confiabilidade = parseFloat(campanha.briefingConfiabilidade || "0");

  return (
    <div className="mx-auto w-full max-w-[1440px] px-2 md:px-4 space-y-5 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-indigo-50/70 p-4 md:p-6 card-premium">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard/campanhas")}
            className="gap-2 -ml-3 mb-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Campanhas
          </Button>
          <h1 className="text-2xl font-bold text-slate-900">{campanha.nome}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium border badge-pulse ${getStatusColor(campanha.status)}`}
            >
              {campanha.status}
            </span>
            {campanha.nomeEmpreendimento && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Building2 className="w-4 h-4" />
                {campanha.nomeEmpreendimento}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 xl:justify-end">
          {/* Botão Importar de Lista */}
          <Button 
            variant="outline" 
            className="gap-2 bg-violet-50 border-violet-200 text-violet-700 hover:bg-violet-100"
            onClick={abrirModalLista}
          >
            <List className="w-4 h-4" />
            Importar de Lista
          </Button>

          {/* Botão Importar Contatos */}
          <Dialog
            open={modalImportacaoOpen}
            onOpenChange={setModalImportacaoOpen}
          >
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 bg-white">
                <Upload className="w-4 h-4" />
                Importar Contatos
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px]">
              <DialogHeader>
                <DialogTitle>Importar contatos</DialogTitle>
                <DialogDescription>
                  Envie sua base por CSV ou cole os contatos manualmente.
                </DialogDescription>
              </DialogHeader>
              
              {/* Abas */}
              <div className="flex border-b border-slate-200">
                <button
                  onClick={() => setAbaImportacao('csv')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    abaImportacao === 'csv' 
                      ? 'border-brand text-brand' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  📄 Arquivo CSV
                </button>
                <button
                  onClick={() => setAbaImportacao('texto')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    abaImportacao === 'texto' 
                      ? 'border-brand text-brand' 
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  ✏️ Colar Texto
                </button>
              </div>

              {/* Conteúdo das Abas */}
              <div className="py-4">
                {abaImportacao === 'csv' ? (
                  <UploadCSV
                    campanhaId={id || ''}
                    onSuccess={(resultado) => {
                      mostrarNotificacao('sucesso', `${resultado.importados} contatos importados!`);
                      carregarCampanha();
                      if (abaAtiva === 'contatos') {
                        carregarContatos();
                      }
                    }}
                    onClose={() => setModalImportacaoOpen(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <p className="text-sm text-slate-600">
                      Cole no formato <strong>Nome, Telefone</strong> (um contato por linha).
                    </p>
                    <textarea
                      className="w-full h-48 p-3 border rounded-md font-mono text-sm focus:ring-2 focus:ring-brand focus:outline-none"
                      placeholder={`João Silva, 62999998888\nMaria Santos, 62988887777`}
                      value={textoImportacao}
                      onChange={(e) => setTextoImportacao(e.target.value)}
                    />
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setModalImportacaoOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={importarContatos} disabled={importando}>
                        {importando ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Importando...
                          </>
                        ) : (
                          "Importar contatos"
                        )}
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>

          {campanha.status === "ATIVA" && (
            <>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => confirmarAtualizarStatus("PAUSADA")}
              >
                <Pause className="w-4 h-4" />
                Pausar
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => confirmarAtualizarStatus("FINALIZADA")}
              >
                <Archive className="w-4 h-4" />
                Finalizar
              </Button>
            </>
          )}
          {campanha.status === "PAUSADA" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => confirmarAtualizarStatus("ATIVA")}
            >
              <Play className="w-4 h-4" />
              Reativar
            </Button>
          )}
          
          {/* Botão Excluir - sempre visível */}
          <Button
            variant="outline"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            onClick={() => setModalExcluirOpen(true)}
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </Button>
        </div>
      </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <Card className="card-premium border-slate-200/90">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
              Total de Contatos
              <Users className="w-4 h-4 text-brand" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalContatos}
              </span>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">Base ativa</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-emerald-200/80 bg-gradient-to-br from-white to-emerald-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
              Leads Qualificados
              <Target className="w-4 h-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900">
                {campanha.totalLeads}
              </span>
              <span className="text-xs text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">Qualificação</span>
            </div>
          </CardContent>
        </Card>

        <Card className="card-premium border-violet-200/80 bg-gradient-to-br from-white to-violet-50/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-600 flex items-center justify-between">
              Taxa de Conversão
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-slate-900 gradient-text">
                {campanha.totalContatos > 0
                  ? Math.round(
                      (campanha.totalLeads / campanha.totalContatos) * 100
                    )
                  : 0}
                %
              </span>
              <span className="text-xs text-violet-700 bg-violet-100 px-2 py-1 rounded-full">Eficiência</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Abas */}
      <div className="rounded-xl border border-slate-200 bg-white p-1.5 card-premium">
        <nav className="flex gap-1 overflow-x-auto" aria-label="Tabs">
          <button
            onClick={() => setAbaAtiva('visao-geral')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              abaAtiva === 'visao-geral' 
                ? 'bg-indigo-50 text-brand shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Visão Geral
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva('contatos')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              abaAtiva === 'contatos' 
                ? 'bg-indigo-50 text-brand shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Contatos
              {campanha.totalContatos > 0 && (
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">
                  {campanha.totalContatos}
                </span>
              )}
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva('empreendimento')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              abaAtiva === 'empreendimento' 
                ? 'bg-indigo-50 text-brand shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Empreendimento
            </span>
          </button>
          <button
            onClick={() => setAbaAtiva('disparos')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
              abaAtiva === 'disparos' 
                ? 'bg-indigo-50 text-brand shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Disparos
            </span>
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      
      {/* ABA: Visão Geral */}
      {abaAtiva === 'visao-geral' && (
        <div className="animate-fade-in">
          <AbaVisaoGeral 
            campanha={campanha} 
            estatisticasContatos={estatisticasContatos} 
          />
        </div>
      )}

      {/* ABA: Contatos */}
      {abaAtiva === 'contatos' && (
        <div className="animate-fade-in">
          <AbaContatos
            contatos={contatos}
            loadingContatos={loadingContatos}
            paginaAtual={paginaAtual}
            totalContatos={totalContatos}
            totalPaginas={totalPaginas}
            filtroStatus={filtroStatus}
            campanhaId={id || ''}
            onFiltroChange={(status) => { setFiltroStatus(status); setPaginaAtual(1); }}
            onPaginaChange={setPaginaAtual}
            onExportar={exportarContatos}
            onVerContato={(contatoId) => navigate(`/dashboard/proprietarios/${contatoId}`)}
            onRecarregar={carregarContatos}
          />
        </div>
      )}

      {/* ABA: Empreendimento - Editor Completo */}
      {abaAtiva === 'empreendimento' && (
        <div className="space-y-6">
          {/* Botão de Pesquisa com IA - aparece se não tem briefing ou para atualizar */}
          {(!campanha?.briefingCompleto || !campanha?.briefingValidado) && (
            <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-violet-200">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-violet-100 rounded-lg">
                    <Brain className="w-6 h-6 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-violet-900 mb-1">
                      {campanha?.briefingCompleto ? 'Atualizar Briefing com IA' : 'Criar Briefing com IA'}
                    </h3>
                    <p className="text-sm text-violet-700 mb-4">
                      {campanha?.briefingCompleto 
                        ? 'Quer pesquisar novamente para atualizar as informações do empreendimento?'
                        : 'Deixe a IA pesquisar informações detalhadas sobre o empreendimento. Isso preencherá o briefing automaticamente.'
                      }
                    </p>
                    <BotaoPesquisaManus
                      dadosIniciais={{
                        nomeEmpreendimento: campanha?.nomeEmpreendimento || "",
                        endereco: campanha?.logradouro || "",
                        bairro: campanha?.bairro || "",
                        cidade: campanha?.cidade || "Goiânia",
                        estado: campanha?.estado || "GO",
                        campanhaId: id,
                      }}
                      onAplicado={() => {
                        // Recarregar campanha para mostrar novo briefing
                        carregarCampanha();
                      }}
                      variant="default"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Editor de Briefing Manual */}
          <EditorBriefing
            briefingAtual={briefing}
            resumoAtual={campanha?.briefingCompleto || ''}
            confiabilidade={confiabilidade}
            onSalvar={salvarBriefing}
          />
        </div>
      )}

      {/* ABA: Disparos - Controle de Prospecção Ativa */}
      {abaAtiva === 'disparos' && (
        <div className="animate-fade-in">
          <PainelDisparo
            campanhaId={id || ''}
            campanhaStatus={campanha.status}
            onStatusChange={carregarCampanha}
          />
        </div>
      )}

      {/* Modal de Importar de Lista */}
      <ModalImportarLista
        open={modalListaOpen}
        onOpenChange={setModalListaOpen}
        listas={listas}
        listaSelecionada={listaSelecionada}
        carregandoListas={carregandoListas}
        importandoDeLista={importandoDeLista}
        onListaSelect={setListaSelecionada}
        onImportar={importarDeLista}
      />

      {/* Modal de Confirmação de Status */}
      <Dialog open={modalStatusOpen} onOpenChange={setModalStatusOpen}>
        <DialogContent className="sm:max-w-md">
          {(() => {
            const config = getStatusModalConfig();
            if (!config) return null;
            
            const IconeStatus = config.icone;
            
            return (
              <>
                <DialogHeader className="text-center sm:text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                    <IconeStatus className={`h-8 w-8 ${config.corIcone}`} />
                  </div>
                  <DialogTitle className="text-xl">{config.titulo}</DialogTitle>
                  <DialogDescription className="text-slate-600 text-base pt-2">
                    {config.mensagem}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex gap-3 sm:justify-center pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModalStatusOpen(false);
                      setNovoStatusPendente(null);
                    }}
                    disabled={processando}
                    className="flex-1 sm:flex-none"
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={executarAtualizarStatus}
                    disabled={processando}
                    className={`flex-1 sm:flex-none text-white ${config.corBotao}`}
                  >
                    {processando ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      'Confirmar'
                    )}
                  </Button>
                </DialogFooter>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={modalExcluirOpen} onOpenChange={setModalExcluirOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <Trash2 className="h-8 w-8 text-red-600" />
            </div>
            <DialogTitle className="text-xl">Excluir Campanha</DialogTitle>
            <DialogDescription className="text-slate-600 text-base pt-2">
              Tem certeza que deseja excluir a campanha <strong>"{campanha?.nome}"</strong>? 
              <span className="block mt-2 text-red-600 font-medium">
                Todos os contatos associados serão removidos permanentemente.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 sm:justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setModalExcluirOpen(false)}
              disabled={processando}
              className="flex-1 sm:flex-none"
            >
              Cancelar
            </Button>
            <Button
              onClick={excluirCampanha}
              disabled={processando}
              className="flex-1 sm:flex-none bg-red-600 hover:bg-red-700 text-white"
            >
              {processando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Sim, Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast de Notificação */}
      {notificacao && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-4 rounded-xl shadow-2xl border animate-in slide-in-from-right-5 duration-300 ${
          notificacao.tipo === 'sucesso' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            notificacao.tipo === 'sucesso' ? 'bg-emerald-100' : 'bg-red-100'
          }`}>
            {notificacao.tipo === 'sucesso' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <p className="font-medium">{notificacao.mensagem}</p>
          <button 
            onClick={fecharNotificacao}
            title="Fechar notificação"
            className={`ml-2 p-1 rounded-lg hover:bg-white/50 transition-colors ${
              notificacao.tipo === 'sucesso' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
