/**
 * Página Pública de Confirmação de Agendamento
 * 
 * Acesso: Público (sem autenticação)
 * Rota: /confirmar/:atividadeId/:token
 * 
 * Permite que o proprietário confirme ou cancele um agendamento
 * através de um link recebido por WhatsApp.
 */

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Home,
  Phone,
  Building2
} from "lucide-react";
import { Button } from "../componentes/ui/button";
import { Card, CardContent } from "../componentes/ui/card";
import { Textarea } from "../componentes/ui/textarea";
import { api } from "../servicos/api";

// ============================================
// TIPOS
// ============================================

interface DadosAgendamento {
  valido: boolean;
  atividade: {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string | null;
    dataAgendada: string;
    statusAgendamento: string;
  };
  lead: {
    nome: string;
    telefone: string;
  };
  imovel: {
    endereco: string | null;
    tipo: string | null;
  };
  imobiliaria: {
    nome: string;
    telefone: string | null;
  };
}

type EstadoPagina = 'carregando' | 'aguardando' | 'confirmado' | 'cancelado' | 'erro' | 'expirado' | 'ja_processado';

// ============================================
// HELPERS
// ============================================

const formatarDataHora = (data: string) => {
  return new Date(data).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatarHora = (data: string) => {
  return new Date(data).toLocaleString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatarData = (data: string) => {
  return new Date(data).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long'
  });
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function ConfirmarAgendamento() {
  const { atividadeId, token } = useParams();
  
  const [estado, setEstado] = useState<EstadoPagina>('carregando');
  const [dados, setDados] = useState<DadosAgendamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [processando, setProcessando] = useState(false);
  const [mostrarCancelamento, setMostrarCancelamento] = useState(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (atividadeId && token) {
      validarToken();
    }
  }, [atividadeId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  const validarToken = async () => {
    try {
      setEstado('carregando');
      
      const response = await api.get(`/leads/confirmar/${atividadeId}/${token}`);
      
      if (response.data.valido) {
        setDados(response.data);
        
        // Se já foi processado, mostrar o estado atual
        if (response.data.atividade.statusAgendamento === 'CONFIRMADO') {
          setEstado('ja_processado');
        } else if (response.data.atividade.statusAgendamento === 'CANCELADO') {
          setEstado('ja_processado');
        } else {
          setEstado('aguardando');
        }
      } else {
        setEstado('expirado');
        setErro(response.data.mensagem || 'Link inválido ou expirado');
      }
    } catch (error: any) {
      console.error('Erro ao validar token:', error);
      setEstado('erro');
      setErro(error.response?.data?.erro || 'Erro ao validar agendamento');
    }
  };

  const confirmarAgendamento = async () => {
    try {
      setProcessando(true);
      
      await api.post(`/leads/confirmar/${atividadeId}/${token}`, {
        acao: 'confirmar'
      });
      
      setEstado('confirmado');
    } catch (error: any) {
      console.error('Erro ao confirmar:', error);
      setEstado('erro');
      setErro(error.response?.data?.erro || 'Erro ao confirmar agendamento');
    } finally {
      setProcessando(false);
    }
  };

  const cancelarAgendamento = async () => {
    try {
      setProcessando(true);
      
      await api.post(`/leads/confirmar/${atividadeId}/${token}`, {
        acao: 'cancelar',
        motivo: motivoCancelamento || 'Cancelado pelo proprietário'
      });
      
      setEstado('cancelado');
    } catch (error: any) {
      console.error('Erro ao cancelar:', error);
      setEstado('erro');
      setErro(error.response?.data?.erro || 'Erro ao cancelar agendamento');
    } finally {
      setProcessando(false);
    }
  };

  // ============================================
  // RENDERIZAÇÃO POR ESTADO
  // ============================================

  // Loading
  if (estado === 'carregando') {
    return (
      <PageContainer>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-12 h-12 animate-spin text-brand mb-4" />
          <p className="text-slate-600">Verificando agendamento...</p>
        </div>
      </PageContainer>
    );
  }

  // Erro / Expirado
  if (estado === 'erro' || estado === 'expirado') {
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                {estado === 'expirado' ? 'Link Expirado' : 'Erro'}
              </h2>
              <p className="text-slate-600 mb-6">
                {erro || 'Este link não é mais válido. Entre em contato com a imobiliária para mais informações.'}
              </p>
              {dados?.imobiliaria?.telefone && (
                <a 
                  href={`tel:${dados.imobiliaria.telefone}`}
                  className="inline-flex items-center gap-2 text-brand hover:underline"
                >
                  <Phone className="w-4 h-4" />
                  {dados.imobiliaria.telefone}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Já processado
  if (estado === 'ja_processado' && dados) {
    const isConfirmado = dados.atividade.statusAgendamento === 'CONFIRMADO';
    
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${
                isConfirmado ? 'bg-emerald-100' : 'bg-slate-100'
              }`}>
                {isConfirmado 
                  ? <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  : <XCircle className="w-8 h-8 text-slate-500" />
                }
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Agendamento {isConfirmado ? 'Confirmado' : 'Cancelado'}
              </h2>
              <p className="text-slate-600 mb-4">
                Este agendamento já foi {isConfirmado ? 'confirmado' : 'cancelado'} anteriormente.
              </p>
              
              {isConfirmado && (
                <div className="bg-slate-50 rounded-lg p-4 text-left mt-4">
                  <p className="text-sm text-slate-500 mb-1">Data marcada:</p>
                  <p className="font-medium text-slate-900">
                    {formatarDataHora(dados.atividade.dataAgendada)}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Confirmado com sucesso
  if (estado === 'confirmado') {
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <h2 className="text-xl font-bold text-emerald-700 mb-2">
                Agendamento Confirmado!
              </h2>
              <p className="text-slate-600 mb-6">
                Obrigado pela confirmação! Nossa equipe estará presente no horário combinado.
              </p>
              
              {dados && (
                <div className="bg-slate-50 rounded-lg p-4 text-left space-y-3">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Data</p>
                      <p className="font-medium text-slate-900">
                        {formatarData(dados.atividade.dataAgendada)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-slate-500">Horário</p>
                      <p className="font-medium text-slate-900">
                        {formatarHora(dados.atividade.dataAgendada)}
                      </p>
                    </div>
                  </div>
                  {dados.imovel?.endereco && (
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-slate-500">Local</p>
                        <p className="font-medium text-slate-900">
                          {dados.imovel?.endereco}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-slate-500 mt-6">
                Em caso de imprevistos, entre em contato conosco.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Cancelado com sucesso
  if (estado === 'cancelado') {
    return (
      <PageContainer>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-slate-500" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Agendamento Cancelado
              </h2>
              <p className="text-slate-600 mb-4">
                Seu agendamento foi cancelado com sucesso.
              </p>
              <p className="text-sm text-slate-500">
                Quando quiser remarcar, é só entrar em contato conosco!
              </p>
              
              {dados?.imobiliaria?.telefone && (
                <a 
                  href={`tel:${dados.imobiliaria.telefone}`}
                  className="inline-flex items-center gap-2 text-brand hover:underline mt-4"
                >
                  <Phone className="w-4 h-4" />
                  {dados.imobiliaria.telefone}
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  // Tela principal - Aguardando ação
  if (estado === 'aguardando' && dados) {
    return (
      <PageContainer>
        {/* Header da Imobiliária */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand rounded-xl flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {dados.imobiliaria.nome}
          </h1>
          <p className="text-slate-500 mt-1">
            Confirmação de Agendamento
          </p>
        </div>

        {/* Card Principal */}
        <Card className="max-w-md mx-auto">
          <CardContent className="pt-6">
            {/* Saudação */}
            <div className="mb-6">
              <p className="text-slate-600">
                Olá <span className="font-semibold text-slate-900">{dados.lead.nome}</span>,
              </p>
              <p className="text-slate-600 mt-1">
                Confirme sua presença para a {dados.atividade.titulo.toLowerCase()}:
              </p>
            </div>

            {/* Detalhes do Agendamento */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3 mb-6">
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Data</p>
                  <p className="font-medium text-slate-900">
                    {formatarData(dados.atividade.dataAgendada)}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-indigo-500 mt-0.5" />
                <div>
                  <p className="text-sm text-slate-500">Horário</p>
                  <p className="font-medium text-slate-900">
                    {formatarHora(dados.atividade.dataAgendada)}
                  </p>
                </div>
              </div>
              
              {dados.imovel?.endereco && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Local</p>
                    <p className="font-medium text-slate-900">
                      {dados.imovel?.endereco}
                    </p>
                  </div>
                </div>
              )}

              {dados.imovel?.tipo && (
                <div className="flex items-start gap-3">
                  <Home className="w-5 h-5 text-indigo-500 mt-0.5" />
                  <div>
                    <p className="text-sm text-slate-500">Tipo de Imóvel</p>
                    <p className="font-medium text-slate-900">
                      {dados.imovel?.tipo}
                    </p>
                  </div>
                </div>
              )}

              {dados.atividade.descricao && (
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    {dados.atividade.descricao}
                  </p>
                </div>
              )}
            </div>

            {/* Área de Cancelamento */}
            {mostrarCancelamento ? (
              <div className="space-y-4 mb-6">
                <div>
                  <label htmlFor="motivo-cancelamento" className="block text-sm font-medium text-slate-700 mb-2">
                    Motivo do cancelamento (opcional)
                  </label>
                  <Textarea
                    id="motivo-cancelamento"
                    placeholder="Ex: Surgiu um compromisso, prefiro remarcar para outro dia..."
                    value={motivoCancelamento}
                    onChange={(e) => setMotivoCancelamento(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setMostrarCancelamento(false)}
                    disabled={processando}
                  >
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={cancelarAgendamento}
                    disabled={processando}
                  >
                    {processando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Cancelando...
                      </>
                    ) : (
                      'Confirmar Cancelamento'
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              /* Botões de Ação */
              <div className="space-y-3">
                <Button
                  className="w-full bg-success hover:bg-success-dark"
                  size="lg"
                  onClick={confirmarAgendamento}
                  disabled={processando}
                >
                  {processando ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Confirmando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5 mr-2" />
                      Confirmar Presença
                    </>
                  )}
                </Button>
                
                <Button
                  variant="outline"
                  className="w-full text-red-600 border-red-200 hover:bg-red-50"
                  size="lg"
                  onClick={() => setMostrarCancelamento(true)}
                  disabled={processando}
                >
                  <XCircle className="w-5 h-5 mr-2" />
                  Não Posso Comparecer
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-slate-400 mt-8">
          Dúvidas? Entre em contato conosco
          {dados.imobiliaria.telefone && (
            <span className="block mt-1">
              <a 
                href={`tel:${dados.imobiliaria.telefone}`}
                className="text-brand hover:underline"
              >
                {dados.imobiliaria.telefone}
              </a>
            </span>
          )}
        </p>
      </PageContainer>
    );
  }

  // Fallback
  return null;
}

// ============================================
// COMPONENTE CONTAINER
// ============================================

function PageContainer({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <div className="container max-w-lg mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
