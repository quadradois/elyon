// Serviço Asaas - Integração de Pagamentos
// Gerencia clientes, assinaturas e cobranças via API Asaas

import axios from 'axios';

// ====================================
// CONFIGURAÇÃO
// ====================================

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://sandbox.asaas.com/api/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

const asaasApi = axios.create({
  baseURL: ASAAS_API_URL,
  headers: {
    'access_token': ASAAS_API_KEY,
    'Content-Type': 'application/json'
  }
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
}

interface ClienteAsaas {
  id: string;
  name: string;
  email: string;
  phone?: string;
  cpfCnpj?: string;
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
}

interface DadosCobranca {
  clienteId: string;
  valor: number;
  descricao: string;
  dataVencimento?: string;
  tipoPagamento?: 'PIX' | 'BOLETO' | 'CREDIT_CARD';
}

interface CobrancaAsaas {
  id: string;
  customer: string;
  value: number;
  billingType: string;
  status: string;
  invoiceUrl?: string;
  pixQrCodeUrl?: string;
  pixPayload?: string;
}

// ====================================
// CLIENTES
// ====================================

/**
 * Criar cliente no Asaas
 */
export async function criarCliente(dados: DadosCliente): Promise<ClienteAsaas> {
  try {
    const response = await asaasApi.post('/customers', {
      name: dados.nome,
      email: dados.email,
      phone: dados.telefone,
      cpfCnpj: dados.cpfCnpj,
      company: dados.empresa
    });

    return response.data as ClienteAsaas;
  } catch (erro: any) {
    console.error('Erro ao criar cliente Asaas:', erro.response?.data || erro.message);
    throw new Error('Falha ao criar cliente no Asaas');
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
    console.error('Erro ao buscar cliente Asaas:', erro.response?.data || erro.message);
    throw new Error('Cliente não encontrado no Asaas');
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
    const response = await asaasApi.post('/subscriptions', {
      customer: dados.clienteId,
      billingType: 'PIX', // Default para PIX
      value: dados.valor,
      cycle: dados.ciclo,
      description: dados.descricao,
      nextDueDate: dados.dataProximaCobranca || calcularProximaData()
    });

    return response.data as AssinaturaAsaas;
  } catch (erro: any) {
    console.error('Erro ao criar assinatura Asaas:', erro.response?.data || erro.message);
    throw new Error('Falha ao criar assinatura no Asaas');
  }
}

/**
 * Cancelar assinatura
 */
export async function cancelarAssinatura(assinaturaId: string): Promise<void> {
  try {
    await asaasApi.delete(`/subscriptions/${assinaturaId}`);
  } catch (erro: any) {
    console.error('Erro ao cancelar assinatura Asaas:', erro.response?.data || erro.message);
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
    const response = await asaasApi.post('/payments', {
      customer: dados.clienteId,
      billingType: dados.tipoPagamento || 'PIX',
      value: dados.valor,
      description: dados.descricao,
      dueDate: dados.dataVencimento || calcularProximaData()
    });

    return response.data as CobrancaAsaas;
  } catch (erro: any) {
    console.error('Erro ao criar cobrança Asaas:', erro.response?.data || erro.message);
    throw new Error('Falha ao criar cobrança no Asaas');
  }
}

/**
 * Gerar QR Code PIX para cobrança
 */
export async function gerarPixQrCode(cobrancaId: string): Promise<{ qrCodeUrl: string; payload: string }> {
  try {
    const response = await asaasApi.get(`/payments/${cobrancaId}/pixQrCode`);
    return {
      qrCodeUrl: response.data.encodedImage,
      payload: response.data.payload
    };
  } catch (erro: any) {
    console.error('Erro ao gerar QR Code PIX:', erro.response?.data || erro.message);
    throw new Error('Falha ao gerar QR Code PIX');
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

// ====================================
// EXPORTS
// ====================================

export const servicoAsaas = {
  criarCliente,
  buscarCliente,
  criarAssinatura,
  cancelarAssinatura,
  criarCobranca,
  gerarPixQrCode
};
