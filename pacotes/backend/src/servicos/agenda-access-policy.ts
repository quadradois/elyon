import type { AgendaPolicyAction } from './agenda-policy';

export type PapelAgenda = 'ADMIN' | 'SUPER_ADMIN' | 'CORRETOR' | 'VISUALIZADOR' | string;

export type AgendaAccessContext = {
  papel: PapelAgenda;
  usuarioId: string;
  responsavelId?: string | null;
};

export type AgendaReadScope =
  | { tipo: 'TENANT' }
  | { tipo: 'PROPRIA'; responsavelId: string };

const ACOES_ESPECIALISTA = new Set<AgendaPolicyAction>([
  'PROPOR',
  'CONFIRMAR_ATRIBUICAO',
  'RECUSAR',
  'REALIZAR',
  'NAO_COMPARECEU',
]);

function papelGestor(papel: PapelAgenda): boolean {
  return papel === 'ADMIN' || papel === 'SUPER_ADMIN';
}

export function obterEscopoLeituraAgenda(context: Pick<AgendaAccessContext, 'papel' | 'usuarioId'>): AgendaReadScope {
  if (context.papel === 'CORRETOR') return { tipo: 'PROPRIA', responsavelId: context.usuarioId };
  return { tipo: 'TENANT' };
}

export function filtrarAcoesAgendaPorAcesso(
  actions: AgendaPolicyAction[],
  context: AgendaAccessContext,
): AgendaPolicyAction[] {
  if (papelGestor(context.papel)) return actions;
  if (context.papel !== 'CORRETOR' || context.responsavelId !== context.usuarioId) return [];
  return actions.filter((action) => ACOES_ESPECIALISTA.has(action));
}

export function podeExecutarComandoAgenda(
  context: AgendaAccessContext & { command: AgendaPolicyAction },
): boolean {
  return filtrarAcoesAgendaPorAcesso([context.command], context).length === 1;
}

export function atorPolicyAgenda(papel: PapelAgenda): 'ADMIN' | 'OPERADOR' {
  return papelGestor(papel) ? 'ADMIN' : 'OPERADOR';
}
