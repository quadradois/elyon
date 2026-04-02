// Serviço de API para funcionalidades de administração (SUPER_ADMIN)
import { api } from './api';

// ====================================
// TIPOS
// ====================================

export interface Tenant {
    id: string;
    nome: string;
    slug: string;
    email?: string;
    telefone?: string;
    cnpj?: string;
    cidade?: string;
    plano?: string;
    planoTipo?: string;
    status: 'ATIVO' | 'SUSPENSO' | 'CANCELADO';
    creditosMensais: number;
    creditosPrepagos: number;
    creditosBonus: number;
    valorPlano?: number;
    dataRenovacao?: string;
    criadoEm: string;
}

export interface Transacao {
    id: string;
    tenantId: string;
    tenantNome?: string;
    tipo: string;
    descricao?: string;
    valor: number;
    creditos: number;
    tipoCredito?: string;
    status: string;
    criadoEm: string;
}

export interface LeadVip {
    id: number;
    nome: string;
    empresa?: string;
    email: string;
    whatsapp: string;
    plano?: string;
    tipo?: string;
    creci?: string;
    atendido: boolean;
    status?: string;
    notas?: string;
    created_at: string;
}

export interface Pacote {
    id: string;
    nome: string;
    creditos: number;
    creditosBonus?: number;
    valor: number;
    ativo: boolean;
}

export interface DadosNovoCliente {
    nomeEmpresa: string;
    slug?: string;
    email: string;
    telefone?: string;
    cnpj?: string;
    cidade?: string;
    planoTipo: 'STARTER' | 'GROWTH' | 'PRO';
    nomeAdmin: string;
    emailAdmin: string;
    senhaAdmin?: string;
    integrarAsaas?: boolean;
}

// ====================================
// FUNÇÕES DE API
// ====================================

/**
 * Lista todos os tenants/clientes
 */
export async function listarTenants(): Promise<Tenant[]> {
    const response = await api.get('/tenant/todos');
    return response.data;
}

/**
 * Cria um novo cliente (tenant + usuário admin)
 */
export async function criarCliente(dados: DadosNovoCliente) {
    const response = await api.post('/billing/admin/clientes', dados);
    return response.data;
}

/**
 * Edita dados de um cliente
 */
export async function editarCliente(id: string, dados: Partial<Tenant>) {
    const response = await api.put(`/billing/admin/clientes/${id}`, dados);
    return response.data;
}

/**
 * Adiciona créditos manualmente a um tenant
 */
export async function adicionarCreditos(
    tenantId: string,
    quantidade: number,
    tipo: 'MENSAIS' | 'PREPAGOS' | 'BONUS',
    descricao?: string
) {
    const response = await api.post('/billing/admin/adicionar-creditos', {
        tenantId,
        quantidade,
        tipo,
        descricao
    });
    return response.data;
}

/**
 * Suspende um cliente
 */
export async function suspenderCliente(id: string, motivo?: string) {
    const response = await api.post(`/billing/admin/clientes/${id}/suspender`, { motivo });
    return response.data;
}

/**
 * Reativa um cliente suspenso
 */
export async function reativarCliente(id: string) {
    const response = await api.post(`/billing/admin/clientes/${id}/reativar`);
    return response.data;
}

/**
 * Reseta a senha do admin de um cliente
 */
export async function resetarSenha(id: string, novaSenha?: string) {
    const response = await api.post(`/billing/admin/clientes/${id}/senha`, { novaSenha });
    return response.data;
}

/**
 * Renova o plano de um cliente manualmente
 */
export async function renovarPlano(tenantId: string) {
    const response = await api.post('/billing/admin/renovar', { tenantId });
    return response.data;
}

/**
 * Lista transações de todos os tenants
 */
export async function listarTransacoes(limite = 50, pagina = 1) {
    const response = await api.get('/billing/admin/transacoes', {
        params: { limite, pagina }
    });
    return response.data;
}

/**
 * Lista configurações de planos
 */
export async function listarPlanos() {
    const response = await api.get('/billing/admin/planos');
    return response.data;
}

/**
 * Lista pacotes de recarga
 */
export async function listarPacotes() {
    const response = await api.get('/billing/pacotes');
    return response.data;
}

/**
 * Lista leads VIP do site
 */
export async function listarLeadsVip(): Promise<{ leads: LeadVip[]; contagem: { total: number; naoAtendidos: number } }> {
    const response = await api.get('/leads-vip');
    return response.data;
}

/**
 * Marca um lead VIP como atendido
 */
export async function marcarLeadAtendido(id: number) {
    const response = await api.post(`/leads-vip/${id}/atender`);
    return response.data;
}

/**
 * Atualiza status de um lead VIP
 */
export async function atualizarStatusLead(id: number, status: string, notas?: string) {
    const response = await api.patch(`/leads-vip/${id}/status`, { status, notas });
    return response.data;
}

/**
 * Busca consumo detalhado de um cliente
 */
export async function buscarConsumo(tenantId: string) {
    const response = await api.get(`/billing/admin/clientes/${tenantId}/consumo`);
    return response.data;
}

/**
 * Testa conexão com Asaas
 */
export async function testarAsaas() {
    const response = await api.get('/billing/admin/testar-asaas');
    return response.data;
}
