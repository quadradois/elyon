// Serviço Asaas - Integração de Pagamentos
// Gerencia clientes, assinaturas e cobranças via API Asaas

import axios, { AxiosError } from 'axios';

// ====================================
// CONFIGURAÇÃO
// ====================================

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';
const ASAAS_WEBHOOK_TOKEN = process.env.ASAAS_WEBHOOK_TOKEN || '';

const asaasApi = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30 segundos
});

// ====================================
// TIPOS
// ====================================

interface DadosCliente {
  nome: string;
  email: string;
  cpfCnpj?: string;
  telefone?: string;
  empresa?: string;
  endereco?: string;
  cidade?: string;
  estado?: string;
  cep?: string;
}

interface ClienteAsaas {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
  company?: string;
}

interface DadosAssinatura {
  clienteId: string;
  valor: number;
  ciclo: 'MONTHLY' | 'WEEKLY' | 'YEARLY';
  descricao: string;
  dataProximaCobranca?: string;
}

interface AssinaturaAsaas {
  id: string;
  customer: string;
  value: number;
  cycle: string;
  status: string;
  nextDueDate: string;
  description?: string;
}

interface DadosCobranca {
  clienteId: string;
  valor: number;
  descricao: string;
  dataVencimento?: string;
  tipoPagamento?: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
  externalReference?: string;
}

interface CobrancaAsaas {
  id: string;
  customer: string;
  value: number;
  billingType: string;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  pixQrCodeUrl?: string;
  pixPayload?: string;
  externalReference?: string;
}

interface PixQrCodeResponse {
  encodedImage: string;
  payload: string;
  expirationDate: string;
}

// ====================================
// VALIDAÇÃO E DIAGNÓSTICO
// ====================================

/**
 * Valida se a configuração do Asaas está correta
 */
export function validarConfiguracao(): { valido: boolean; mensagem: string; ambiente: string } {
  const ambiente = ASAAS_API_URL.includes('sandbox') ? 'SANDBOX' : 'PRODUCAO';

  if (!ASAAS_API_KEY) {
    console.error('[Asaas] ⚠️ ASAAS_API_KEY não configurada!');
    return {
      valido: false,
      mensagem: 'ASAAS_API_KEY não configurada. Adicione ao arquivo .env',
      ambiente
    };
  }

  if (ASAAS_API_KEY === 'sua_api_key_aqui') {
    console.error('[Asaas] ⚠️ ASAAS_API_KEY está com valor padrão!');
    return {
      valido: false,
      mensagem: 'ASAAS_API_KEY está com valor padrão. Configure a chave real.',
      ambiente
    };
  }

  console.log(`[Asaas] ✅ Configurado para ambiente: ${ambiente}`);
  console.log(`[Asaas] 📍 URL: ${ASAAS_API_URL}`);

  return {
    valido: true,
    mensagem: `Asaas configurado corretamente (${ambiente})`,
    ambiente
  };
}

/**
 * Testa conexão com a API Asaas
 */
export async function testarConexao(): Promise<{ sucesso: boolean; mensagem: string; detalhes?: any }> {
  try {
    const config = validarConfiguracao();
    if (!config.valido) {
      return { sucesso: false, mensagem: config.mensagem };
    }

    // Tentar listar clientes (retorna array vazio se não houver)
    const response = await asaasApi.get('/customers', { params: { limit: 1 } });

    return {
      sucesso: true,
      mensagem: `Conexão OK! Ambiente: ${config.ambiente}`,
      detalhes: {
        ambiente: config.ambiente,
        totalClientes: response.data.totalCount || 0
      }
    };
  } catch (erro: any) {
    const mensagemErro = extrairMensagemErro(erro);
    return {
      sucesso: false,
      mensagem: `Falha na conexão: ${mensagemErro}`,
      detalhes: erro.response?.data
    };
  }
}

/**
 * Retorna o token de webhook para validação
 */
export function getWebhookToken(): string {
  return ASAAS_WEBHOOK_TOKEN;
}

// ====================================
// CLIENTES
// ====================================

/**
 * Criar cliente no Asaas
 */
export async function criarCliente(dados: DadosCliente): Promise<ClienteAsaas> {
  try {
    console.log(`[Asaas] Criando cliente: ${dados.email}`);

    const response = await asaasApi.post('/customers', {
      name: dados.nome,
      email: dados.email,
      phone: dados.telefone,
      cpfCnpj: dados.cpfCnpj,
      company: dados.empresa,
      address: dados.endereco,
      city: dados.cidade,
      state: dados.estado,
      postalCode: dados.cep
    });

    console.log(`[Asaas] ✅ Cliente criado: ${response.data.id}`);
    return response.data as ClienteAsaas;
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao criar cliente:', mensagem);
    throw new Error(`Falha ao criar cliente no Asaas: ${mensagem}`);
  }
}

/**
 * Buscar cliente por ID
 */
export async function buscarCliente(clienteId: string): Promise<ClienteAsaas> {
  try {
    const response = await asaasApi.get(`/customers/${clienteId}`);
    return response.data as ClienteAsaas;
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao buscar cliente:', mensagem);
    throw new Error('Cliente não encontrado no Asaas');
  }
}

/**
 * Buscar cliente por email
 */
export async function buscarClientePorEmail(email: string): Promise<ClienteAsaas | null> {
  try {
    const response = await asaasApi.get('/customers', {
      params: { email }
    });

    const clientes = response.data.data || [];
    return clientes.length > 0 ? clientes[0] : null;
  } catch (erro: any) {
    console.error('[Asaas] Erro ao buscar cliente por email:', extrairMensagemErro(erro));
    return null;
  }
}

/**
 * Buscar cliente por CPF/CNPJ
 */
export async function buscarClientePorCpfCnpj(cpfCnpj: string): Promise<ClienteAsaas | null> {
  try {
    const response = await asaasApi.get('/customers', {
      params: { cpfCnpj: cpfCnpj.replace(/\D/g, '') }
    });

    const clientes = response.data.data || [];
    return clientes.length > 0 ? clientes[0] : null;
  } catch (erro: any) {
    console.error('[Asaas] Erro ao buscar cliente por CPF/CNPJ:', extrairMensagemErro(erro));
    return null;
  }
}

/**
 * Atualizar dados do cliente
 */
export async function atualizarCliente(clienteId: string, dados: Partial<DadosCliente>): Promise<ClienteAsaas> {
  try {
    const response = await asaasApi.put(`/customers/${clienteId}`, {
      name: dados.nome,
      email: dados.email,
      phone: dados.telefone,
      cpfCnpj: dados.cpfCnpj,
      company: dados.empresa
    });

    console.log(`[Asaas] ✅ Cliente atualizado: ${clienteId}`);
    return response.data as ClienteAsaas;
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao atualizar cliente:', mensagem);
    throw new Error(`Falha ao atualizar cliente: ${mensagem}`);
  }
}

// ====================================
// ASSINATURAS
// ====================================

/**
 * Criar assinatura recorrente
 */
export async function criarAssinatura(dados: DadosAssinatura): Promise<AssinaturaAsaas> {
  try {
    console.log(`[Asaas] Criando assinatura para cliente: ${dados.clienteId}`);

    const response = await asaasApi.post('/subscriptions', {
      customer: dados.clienteId,
      billingType: 'PIX', // Default para PIX
      value: dados.valor,
      cycle: dados.ciclo,
      description: dados.descricao,
      nextDueDate: dados.dataProximaCobranca || calcularProximaData()
    });

    console.log(`[Asaas] ✅ Assinatura criada: ${response.data.id}`);
    return response.data as AssinaturaAsaas;
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao criar assinatura:', mensagem);
    throw new Error(`Falha ao criar assinatura no Asaas: ${mensagem}`);
  }
}

/**
 * Buscar assinatura por ID
 */
export async function buscarAssinatura(assinaturaId: string): Promise<AssinaturaAsaas> {
  try {
    const response = await asaasApi.get(`/subscriptions/${assinaturaId}`);
    return response.data as AssinaturaAsaas;
  } catch (erro: any) {
    throw new Error('Assinatura não encontrada');
  }
}

/**
 * Listar cobranças de uma assinatura
 */
export async function listarCobrancasAssinatura(assinaturaId: string): Promise<CobrancaAsaas[]> {
  try {
    const response = await asaasApi.get(`/subscriptions/${assinaturaId}/payments`);
    return response.data.data || [];
  } catch (erro: any) {
    console.error('[Asaas] Erro ao listar cobranças da assinatura:', extrairMensagemErro(erro));
    return [];
  }
}

/**
 * Cancelar assinatura
 */
export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  try {
    await asaasApi.delete(`/subscriptions/${assinaturaId}`);
    console.log(`[Asaas] ✅ Assinatura cancelada: ${assinaturaId}`);
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao cancelar assinatura:', mensagem);
    throw new Error('Falha ao cancelar assinatura');
  }
}

// ====================================
// COBRANÇAS (RECARGAS AVULSAS)
// ====================================

/**
 * Criar cobrança avulsa (para recarga de créditos)
 */
export async function criarCobranca(dados: DadosCobranca): Promise<CobrancaAsaas> {
  try {
    console.log(`[Asaas] Criando cobrança: R$ ${dados.valor} para ${dados.clienteId}`);

    const response = await asaasApi.post('/payments', {
      customer: dados.clienteId,
      billingType: dados.tipoPagamento || 'PIX',
      value: dados.valor,
      description: dados.descricao,
      dueDate: dados.dataVencimento || calcularProximaData(),
      externalReference: dados.externalReference
    });

    console.log(`[Asaas] ✅ Cobrança criada: ${response.data.id}`);
    return response.data as CobrancaAsaas;
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao criar cobrança:', mensagem);
    throw new Error(`Falha ao criar cobrança no Asaas: ${mensagem}`);
  }
}

/**
 * Consultar status de uma cobrança
 */
export async function consultarCobranca(cobrancaId: string): Promise<CobrancaAsaas> {
  try {
    const response = await asaasApi.get(`/payments/${cobrancaId}`);
    return response.data as CobrancaAsaas;
  } catch (erro: any) {
    throw new Error('Cobrança não encontrada');
  }
}

/**
 * Cancelar cobrança pendente
 */
export async function cancelarCobranca(cobrancaId: string): Promise<void> {
  try {
    await asaasApi.delete(`/payments/${cobrancaId}`);
    console.log(`[Asaas] ✅ Cobrança cancelada: ${cobrancaId}`);
  } catch (erro: any) {
    throw new Error('Falha ao cancelar cobrança');
  }
}

/**
 * Gerar QR Code PIX para cobrança
 */
export async function gerarPixQrCode(cobrancaId: string): Promise<{ qrCodeUrl: string; payload: string }> {
  try {
    const response = await asaasApi.get(`/payments/${cobrancaId}/pixQrCode`);
    const data = response.data as PixQrCodeResponse;

    return {
      qrCodeUrl: data.encodedImage,
      payload: data.payload
    };
  } catch (erro: any) {
    const mensagem = extrairMensagemErro(erro);
    console.error('[Asaas] ❌ Erro ao gerar QR Code PIX:', mensagem);
    throw new Error('Falha ao gerar QR Code PIX');
  }
}

/**
 * Listar cobranças de um cliente
 */
export async function listarCobrancasCliente(clienteId: string, status?: string): Promise<CobrancaAsaas[]> {
  try {
    const params: any = { customer: clienteId };
    if (status) params.status = status;

    const response = await asaasApi.get('/payments', { params });
    return response.data.data || [];
  } catch (erro: any) {
    console.error('[Asaas] Erro ao listar cobranças:', extrairMensagemErro(erro));
    return [];
  }
}

// ====================================
// HELPERS
// ====================================

function calcularProximaData(): string {
  const hoje = new Date();
  const amanha = new Date(hoje);
  amanha.setDate(amanha.getDate() + 1);
  return amanha.toISOString().split('T')[0];
}

function extrairMensagemErro(erro: AxiosError | any): string {
  if (erro.response?.data?.errors) {
    return erro.response.data.errors.map((e: any) => e.description).join(', ');
  }
  if (erro.response?.data?.message) {
    return erro.response.data.message;
  }
  return erro.message || 'Erro desconhecido';
}

// ====================================
// EXPORTS
// ====================================

export const servicoAsaas = {
  // Diagnóstico
  validarConfiguracao,
  testarConexao,
  getWebhookToken,

  // Clientes
  criarCliente,
  buscarCliente,
  buscarClientePorEmail,
  buscarClientePorCpfCnpj,
  atualizarCliente,

  // Assinaturas
  criarAssinatura,
  buscarAssinatura,
  listarCobrancasAssinatura,
  cancelarAssinatura,

  // Cobranças
  criarCobranca,
  consultarCobranca,
  cancelarCobranca,
  gerarPixQrCode,
  listarCobrancasCliente
};

