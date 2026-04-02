/**
 * SUÍTE DE REGRESSÃO CONVERSACIONAL — SPRINT 4
 *
 * Objetivo:
 * - Validar o comportamento alvo da arquitetura sem Closer ativo.
 * - Conferir sinais mínimos de qualidade por fase do atendimento.
 *
 * Uso sugerido:
 * - Este arquivo define cenários padronizados para testes manuais/automatizados.
 * - Pode ser usado por scripts futuros de replay ou validação de logs.
 */

export type FaseFluxo =
  | 'FASE1_QUALIFICACAO'
  | 'FASE2_DIAGNOSTICO_SPIN'
  | 'FASE3_DOCUMENTACAO_HUMANA'
  | 'FASE4_ONBOARDING';

export interface CenarioRegressaoConversa {
  id: string;
  titulo: string;
  faseEsperada: FaseFluxo;
  entradaUsuario: string;
  deveConter?: string[];
  naoDeveConter?: string[];
  exigeToolExec?: Array<'qualificar_lead' | 'mover_para_fase' | 'salvar_dados_imovel' | 'agendar_avaliacao' | 'enviar_para_crm'>;
  observacao: string;
}

export const cenariosRegressaoConversa: CenarioRegressaoConversa[] = [
  {
    id: 'R1',
    titulo: 'Opener coleta intenção e dados básicos',
    faseEsperada: 'FASE1_QUALIFICACAO',
    entradaUsuario: 'Tenho interesse em vender meu apartamento',
    deveConter: ['vender', 'alugar', 'metragem', 'ocupado', 'valor'],
    naoDeveConter: ['contrato', 'documentação', 'vou te transferir'],
    observacao: 'A resposta deve manter foco em descoberta e não pular para formalização.'
  },
  {
    id: 'R2',
    titulo: 'Presenter aprofunda SPIN sem travar',
    faseEsperada: 'FASE2_DIAGNOSTICO_SPIN',
    entradaUsuario: 'Está anunciado há meses e quase não tem visita',
    deveConter: ['visitas', 'retorno', 'despesas', 'faz sentido'],
    naoDeveConter: ['desculpe, deu um pequeno erro', 'aguarde um instante'],
    exigeToolExec: ['qualificar_lead'],
    observacao: 'Deve haver progresso no diagnóstico e registro de qualificação.'
  },
  {
    id: 'R3',
    titulo: 'Presenter finaliza diagnóstico e move para fase humana',
    faseEsperada: 'FASE2_DIAGNOSTICO_SPIN',
    entradaUsuario: 'Faz sentido, podemos avançar',
    deveConter: ['documentação', 'time comercial humano', 'continua daqui'],
    naoDeveConter: ['closer', 'especialista vai assumir', 'transferindo'],
    exigeToolExec: ['qualificar_lead', 'mover_para_fase'],
    observacao: 'Sem metalinguagem de handoff técnico; transição operacional clara.'
  },
  {
    id: 'R4',
    titulo: 'Fase humana bloqueia negociação por IA',
    faseEsperada: 'FASE3_DOCUMENTACAO_HUMANA',
    entradaUsuario: 'Tenho dúvida da cláusula do contrato',
    deveConter: ['formalização', 'time humano'],
    naoDeveConter: ['comissão de', 'roteiro de fechamento', 'objeção de exclusividade'],
    observacao: 'IA não deve voltar ao papel de fechamento em DOCUMENTACAO/EM_NEGOCIACAO.'
  },
  {
    id: 'R5',
    titulo: 'Admin no pós-assinatura coleta dados do imóvel',
    faseEsperada: 'FASE4_ONBOARDING',
    entradaUsuario: 'Contrato assinado, posso enviar os dados do imóvel?',
    deveConter: ['quartos', 'metragem', 'características', 'fotos'],
    naoDeveConter: ['vamos fechar contrato', 'negociar comissão'],
    exigeToolExec: ['salvar_dados_imovel'],
    observacao: 'Admin deve operar coleta técnica para anúncio, sem voltar ao fechamento.'
  },
  {
    id: 'R6',
    titulo: 'Admin agenda fotos e conclui CRM',
    faseEsperada: 'FASE4_ONBOARDING',
    entradaUsuario: 'Pode agendar as fotos para amanhã às 10h',
    deveConter: ['agendar', 'fotos', 'crm'],
    naoDeveConter: ['vou transferir', 'aguarde especialista'],
    exigeToolExec: ['agendar_avaliacao', 'enviar_para_crm'],
    observacao: 'Fluxo pós-assinatura deve terminar em operação e publicação.'
  },
  {
    id: 'R7',
    titulo: 'Sem fallback genérico em cenário nominal',
    faseEsperada: 'FASE2_DIAGNOSTICO_SPIN',
    entradaUsuario: 'Correto, como podemos corrigir isso?',
    naoDeveConter: ['Desculpe, deu um pequeno erro aqui. Pode repetir por favor?'],
    observacao: 'Falha genérica só é aceitável em exceção real, não em conversa normal.'
  }
];

export function imprimirResumoCenarios(): void {
  console.log(`Cenários de regressão carregados: ${cenariosRegressaoConversa.length}`);
  for (const cenario of cenariosRegressaoConversa) {
    console.log(`- [${cenario.id}] ${cenario.titulo} (${cenario.faseEsperada})`);
  }
}
