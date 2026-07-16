import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { logger } from '../lib/logger';
import {
  EvolutionIntegrationError,
  EvolutionStage,
  toEvolutionIntegrationError,
} from './evolution-error';

interface EvolutionInstance {
  instanceName: string;
  state: string;
  status?: string;
  profileName?: string;
  ownerJid?: string;
}

export interface WhatsAppConnectionResult {
  qrcode?: string;
  base64?: string;
  code?: string;
  count?: number;
  status?: string;
}

/**
 * WhatsAppService - Gerencia conexão com o Evolution GO (whatsmeow).
 *
 * Multi-tenant: cada SessaoWhatsapp tem seu próprio instanceName e, no
 * Evolution GO, um instanceId (uuid) + token próprio.
 *
 * Modelo de autenticação do Evolution GO:
 * - chave global (EVOLUTION_GLOBAL_API_KEY): listar e excluir instâncias
 *   (/instance/all, /instance/delete e reconciliação administrativa)
 * - chave do tenant (EVOLUTION_TENANT_API_KEY + EVOLUTION_TENANT_ID): criar
 *   instâncias (/instance/create)
 * - token da instância (header apikey): operações da instância
 *   (/instance/connect, /status, /qr, /send/*, /message/*)
 *
 * O instanceId/token ficam persistidos em sessoes_whatsapp e são
 * carregados sob demanda a partir do instanceName.
 */
export class WhatsAppService {
  private _instanceName: string;
  private _instanceId?: string;
  private _token?: string;
  private _credenciaisCarregadas = false;
  private _connectionInFlight?: Promise<WhatsAppConnectionResult>;

  constructor(instanceName: string) {
    this._instanceName = instanceName;
  }

  // Lê variáveis de ambiente em tempo real
  private get apiUrl(): string {
    return (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  }

  private get globalApiKey(): string {
    return process.env.EVOLUTION_GLOBAL_API_KEY || '';
  }

  private get tenantApiKey(): string {
    return process.env.EVOLUTION_TENANT_API_KEY || '';
  }

  private get evolutionTenantId(): string {
    return process.env.EVOLUTION_TENANT_ID || '';
  }

  get instanceName(): string {
    return this._instanceName;
  }

  private get headersGlobais() {
    return { 'Content-Type': 'application/json', apikey: this.globalApiKey };
  }

  private get headersTenant() {
    return {
      'Content-Type': 'application/json',
      apikey: this.tenantApiKey,
      'X-Tenant-ID': this.evolutionTenantId,
    };
  }

  private headersInstancia() {
    if (!this._token) {
      throw new EvolutionIntegrationError({
        message: 'Token individual da Evolution Go ausente',
        stage: 'configuracao',
        reasonCode: 'EVOLUTION_CONFIG_MISSING',
        httpStatus: 503,
      });
    }
    return { 'Content-Type': 'application/json', apikey: this._token };
  }

  private validarConfiguracao(
    stage: EvolutionStage,
    authScope: 'base' | 'global' | 'tenant' = 'base',
  ): void {
    const authConfigurada = authScope === 'base'
      || (authScope === 'global' && !!this.globalApiKey)
      || (authScope === 'tenant' && !!this.tenantApiKey && !!this.evolutionTenantId);
    if (this.apiUrl && authConfigurada) return;
    throw new EvolutionIntegrationError({
      message: 'Configuracao da Evolution Go ausente',
      stage: 'configuracao',
      route: stage,
      reasonCode: 'EVOLUTION_CONFIG_MISSING',
      httpStatus: 503,
    });
  }

  private contextoSeguro(instanceAlreadyExisted?: boolean) {
    return {
      instanceAlreadyExisted,
      remoteIdPresent: !!this._instanceId,
      instanceAuthPresent: !!this._token,
    };
  }

  private get webhookUrl(): string {
    const backendUrl = (process.env.BACKEND_URL || 'https://api.elyon.ia.br').replace(/\/$/, '');
    return `${backendUrl}/webhooks`;
  }

  /** Carrega instanceId/token da sessão a partir do instanceName. */
  private async carregarCredenciais(forcar = false): Promise<void> {
    if (this._credenciaisCarregadas && !forcar) return;

    const sessao = await prisma.sessaoWhatsapp.findUnique({
      where: { instanceName: this._instanceName },
      select: { evolutionInstanceId: true, evolutionToken: true },
    });

    this._instanceId = sessao?.evolutionInstanceId || undefined;
    this._token = sessao?.evolutionToken || undefined;
    this._credenciaisCarregadas = true;
  }

  /** Garante que a instância existe no Evolution GO (cria se necessário). */
  private async garantirInstancia(verificarExistenciaRemota = false): Promise<boolean> {
    await this.carregarCredenciais();
    if (this._instanceId && this._token) {
      if (!verificarExistenciaRemota) return true;
      const existente = await this.buscarDetalhesInstancia(true);
      if (existente?.id) {
        if (existente.token && (existente.id !== this._instanceId || existente.token !== this._token)) {
          await this.salvarCredenciais(existente.id, existente.token);
        }
        return true;
      }
    }
    await this.criarInstancia();
    return false;
  }

  /** Persiste instanceId/token na sessão e atualiza o cache local. */
  private async salvarCredenciais(instanceId: string, token: string): Promise<void> {
    try {
      await prisma.sessaoWhatsapp.update({
        where: { instanceName: this._instanceName },
        data: { evolutionInstanceId: instanceId, evolutionToken: token },
      });
    } catch (error) {
      const failure = new EvolutionIntegrationError({
        message: 'Falha ao persistir credenciais da Evolution Go',
        stage: 'banco',
        reasonCode: 'WHATSAPP_DATABASE_FAILURE',
        httpStatus: 500,
        cause: error,
      });
      logger.error(
        {
          stage: failure.stage,
          reasonCode: failure.reasonCode,
          recoveryRequired: true,
          remoteIdReceived: !!instanceId,
          instanceAuthReceived: !!token,
        },
        '[WhatsApp] Erro ao persistir credenciais da instância',
      );
      throw failure;
    }

    this._instanceId = instanceId;
    this._token = token;
    this._credenciaisCarregadas = true;
  }

  async criarInstancia(): Promise<any> {
    await this.carregarCredenciais();
    this.validarConfiguracao('instance/create', 'tenant');

    const token = this._token || crypto.randomBytes(32).toString('hex');

    try {
      logger.info({ stage: 'instance/create' }, '[WhatsApp] Criando instância no Evolution Go');
      const response = await axios.post(
        `${this.apiUrl}/instance/create`,
        {
          name: this._instanceName,
          token,
          advancedSettings: { ignoreGroups: true },
        },
        { headers: this.headersTenant },
      );

      const criada = response.data?.data || response.data;
      const instanceId = criada?.id;
      const instanceToken = criada?.token || token;

      if (!instanceId) {
        throw toEvolutionIntegrationError(new Error('Resposta sem instance id'), {
          stage: 'instance/create',
          route: '/instance/create',
          instanceAlreadyExisted: false,
          contractInvalid: true,
        });
      }

      await this.salvarCredenciais(instanceId, instanceToken);
      logger.info(
        { stage: 'instance/create', remoteIdPresent: true, instanceAuthPresent: true },
        '[WhatsApp] Instância criada',
      );
      return criada;
    } catch (error: any) {
      // Instância já existe no Evolution GO — adota o id/token existentes.
      const detalhe = error?.response?.data?.error || error?.message || '';
      if (axios.isAxiosError(error) && /already exists/i.test(String(detalhe))) {
        logger.info(
          { stage: 'instance/create', instanceAlreadyExisted: true },
          '[WhatsApp] Instância remota existente será reconciliada',
        );
        const existente = await this.buscarDetalhesInstancia();
        if (existente?.id && existente?.token) {
          await this.salvarCredenciais(existente.id, existente.token);
          return existente;
        }
      }
      const falha = toEvolutionIntegrationError(error, {
        stage: 'instance/create',
        route: '/instance/create',
        instanceAlreadyExisted: false,
      });
      logger.error(
        {
          ...this.contextoSeguro(false),
          stage: falha.stage,
          route: falha.route,
          upstreamStatus: falha.upstreamStatus,
          reasonCode: falha.reasonCode,
        },
        '[WhatsApp] Erro ao criar instância',
      );
      throw falha;
    }
  }

  async conectarInstancia(): Promise<WhatsAppConnectionResult> {
    if (this._connectionInFlight) return this._connectionInFlight;

    const operation = this.executarConexao();
    this._connectionInFlight = operation;
    try {
      return await operation;
    } finally {
      if (this._connectionInFlight === operation) this._connectionInFlight = undefined;
    }
  }

  private async executarConexao(): Promise<WhatsAppConnectionResult> {
    this.validarConfiguracao('instance/connect');
    const instanceAlreadyExisted = await this.garantirInstancia(true);

    // Conecta a instância e (re)configura webhook + eventos assinados.
    try {
      await axios.post(
        `${this.apiUrl}/instance/connect`,
        {
          webhookUrl: this.webhookUrl,
          subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'],
        },
        { headers: this.headersInstancia() },
      );
    } catch (error: any) {
      const falha = toEvolutionIntegrationError(error, {
        stage: 'instance/connect',
        route: '/instance/connect',
        instanceAlreadyExisted,
      });
      logger.error(
        {
          ...this.contextoSeguro(instanceAlreadyExisted),
          stage: falha.stage,
          route: falha.route,
          upstreamStatus: falha.upstreamStatus,
          reasonCode: falha.reasonCode,
        },
        '[WhatsApp] Erro ao conectar instância',
      );
      throw falha;
    }

    // Busca o QR Code (data:image/png;base64,...). Se já logado, retorna status open.
    try {
      const qrResp = await axios.get(
        `${this.apiUrl}/instance/qr`,
        { headers: this.headersInstancia() },
      );
      const dados = qrResp.data?.data || qrResp.data || {};
      const qrcode = dados.Qrcode || dados.qrcode;
      return { base64: qrcode, qrcode, code: dados.Code || dados.code, count: 0 };
    } catch (error: any) {
      const detalhe = error?.response?.data?.error || error?.message || '';
      if (/already logged in/i.test(String(detalhe))) {
        return { status: 'open', count: 0 };
      }
      const falha = toEvolutionIntegrationError(error, {
        stage: 'instance/qr',
        route: '/instance/qr',
        instanceAlreadyExisted,
      });
      logger.error(
        {
          ...this.contextoSeguro(instanceAlreadyExisted),
          stage: falha.stage,
          route: falha.route,
          upstreamStatus: falha.upstreamStatus,
          reasonCode: falha.reasonCode,
        },
        '[WhatsApp] Erro ao obter QR Code',
      );
      throw falha;
    }
  }

  async verificarStatus(): Promise<{ instance: EvolutionInstance } | null> {
    await this.carregarCredenciais();
    if (!this._token) return null;

    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/status`,
        { headers: this.headersInstancia() },
      );
      const dados = response.data?.data || {};
      const conectado = !!dados.Connected;
      const logado = !!dados.LoggedIn;
      const state = logado && conectado ? 'open' : conectado ? 'connecting' : 'close';

      return {
        instance: {
          instanceName: this._instanceName,
          state,
          status: state,
          profileName: dados.Name || undefined,
        },
      };
    } catch (error) {
      // Instância pode não existir / não estar rodando
      return null;
    }
  }

  // Envia presença "digitando..." — fire-and-forget, nunca lança exceção
  async enviarIndicadorDigitando(numero: string, _duracaoMs: number = 25000): Promise<void> {
    try {
      await this.carregarCredenciais();
      if (!this._token) return;
      await axios.post(
        `${this.apiUrl}/message/presence`,
        { number: this.formatarNumero(numero), state: 'composing', isAudio: false },
        { headers: this.headersInstancia(), timeout: 3000 },
      );
    } catch {
      // silencioso — presença não é crítica
    }
  }

  async enviarMensagemTexto(numero: string, texto: string, idempotencyKey?: string): Promise<any> {
    await this.garantirInstancia();
    const numeroFormatado = this.formatarNumero(numero);

    console.log('[WhatsApp] Enviando texto por instancia configurada');

    try {
      const response = await axios.post(
        `${this.apiUrl}/send/text`,
        { number: numeroFormatado, text: texto, delay: 1200 },
        { headers: { ...this.headersInstancia(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } },
      );
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp] Falha no envio de texto');
      throw error;
    }
  }

  async enviarMensagemAudio(numero: string, audioBase64: string, _ptt: boolean = true, idempotencyKey?: string): Promise<any> {
    await this.garantirInstancia();

    try {
      const response = await axios.post(
        `${this.apiUrl}/send/media`,
        {
          number: this.formatarNumero(numero),
          type: 'audio',
          url: this.normalizarMidia(audioBase64),
          delay: 1200,
        },
        { headers: { ...this.headersInstancia(), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) } },
      );
      return response.data;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao enviar áudio');
      throw error;
    }
  }

  async enviarMensagemDocumento(
    numero: string,
    media: string,
    options?: { fileName?: string; mimeType?: string; caption?: string; idempotencyKey?: string },
  ): Promise<any> {
    await this.garantirInstancia();

    const payload: any = {
      number: this.formatarNumero(numero),
      type: 'document',
      url: this.normalizarMidia(media),
      filename: options?.fileName || `autorizacao_venda_${Date.now()}.pdf`,
      delay: 1200,
    };
    if (options?.caption) payload.caption = options.caption;

    try {
      const response = await axios.post(
        `${this.apiUrl}/send/media`,
        payload,
        { headers: { ...this.headersInstancia(), ...(options?.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}) } },
      );
      return response.data;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao enviar documento');
      throw error;
    }
  }

  async enviarContatoPadrao(
    numeroDestino: string,
    contato: { fullName: string; phoneNumber: string; organization?: string; email?: string },
  ): Promise<any> {
    await this.garantirInstancia();

    const phoneDigits = (contato.phoneNumber || '').replace(/\D/g, '');
    const phoneIntl = phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`;

    try {
      const response = await axios.post(
        `${this.apiUrl}/send/contact`,
        {
          number: this.formatarNumero(numeroDestino),
          vcard: {
            fullName: contato.fullName,
            organization: contato.organization || '',
            phone: phoneIntl,
          },
          delay: 1200,
        },
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao enviar contato');
      throw error;
    }
  }

  async buscarConfiguracao(): Promise<any> {
    await this.carregarCredenciais();
    if (!this._instanceId || !this._token) return { groupsIgnore: true };

    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/${this._instanceId}/advanced-settings`,
        { headers: this.headersInstancia() },
      );
      const dados = response.data?.data || response.data || {};
      // Mantém a chave groupsIgnore esperada pelo restante do código.
      return { ...dados, groupsIgnore: dados.ignoreGroups ?? dados.groupsIgnore ?? false };
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao buscar configurações');
      throw error;
    }
  }

  async atualizarConfiguracao(ignorarGrupos: boolean): Promise<any> {
    await this.garantirInstancia();

    try {
      const response = await axios.put(
        `${this.apiUrl}/instance/${this._instanceId}/advanced-settings`,
        { ignoreGroups: ignorarGrupos },
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao atualizar configurações');
      throw error;
    }
  }

  /**
   * Configura o webhook da instância. No Evolution GO o webhook é definido
   * pelo /instance/connect (webhookUrl + subscribe).
   */
  async configurarWebhook(url?: string, _enabled: boolean = true): Promise<any> {
    await this.garantirInstancia();

    try {
      const response = await axios.post(
        `${this.apiUrl}/instance/connect`,
        {
          webhookUrl: url || this.webhookUrl,
          subscribe: ['MESSAGE', 'CONNECTION', 'QRCODE'],
        },
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      logger.error('[WhatsApp] Erro ao configurar webhook');
      throw error;
    }
  }

  /** Busca os detalhes da instância via /instance/all (chave global). */
  async buscarDetalhesInstancia(lancarErro = false): Promise<any> {
    try {
      this.validarConfiguracao('instance/create', 'global');
      const response = await axios.get(
        `${this.apiUrl}/instance/all`,
        { headers: this.headersGlobais },
      );
      const instancias = response.data?.data || response.data || [];
      const instancia = Array.isArray(instancias)
        ? instancias.find((i: any) => i.name === this._instanceName)
        : null;
      if (!instancia) return null;
      return { ...instancia, ownerJid: instancia.jid, profileName: instancia.client_name || instancia.name };
    } catch (error: any) {
      if (lancarErro) {
        throw toEvolutionIntegrationError(error, {
          stage: 'instance/create',
          route: '/instance/all',
          instanceAlreadyExisted: true,
        });
      }
      logger.error('[WhatsApp] Erro ao buscar detalhes da instância');
      return null;
    }
  }

  /** Faz logout da instância (instance token). */
  async desconectarInstancia(): Promise<void> {
    await this.carregarCredenciais();
    if (!this._token) return;
    await axios.delete(`${this.apiUrl}/instance/logout`, { headers: this.headersInstancia() });
  }

  /**
   * Deleta a instância no Evolution GO (chave global).
   * Retorna 'deletada' se removida no servidor, ou 'inexistente' se já não
   * existia lá. Lança erro em falhas reais (rede/5xx) para que o chamador
   * NÃO apague o registro local e evite criar instâncias órfãs no Evolution GO.
   */
  async deletarInstancia(): Promise<'deletada' | 'inexistente'> {
    await this.carregarCredenciais();

    // Se o id não está persistido, tenta resolvê-lo pelo nome no próprio
    // servidor — cobre sessões que nunca salvaram o evolutionInstanceId e
    // instâncias criadas fora do fluxo normal.
    let instanceId = this._instanceId;
    if (!instanceId) {
      const detalhes = await this.buscarDetalhesInstancia();
      instanceId = detalhes?.id;
    }
    if (!instanceId) return 'inexistente';

    try {
      await axios.delete(
        `${this.apiUrl}/instance/delete/${instanceId}`,
        { headers: this.headersGlobais },
      );
      return 'deletada';
    } catch (error: any) {
      // 404 = instância já não existe no Evolution GO → tratamos como sucesso.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return 'inexistente';
      }
      logger.error(
        { stage: 'instance/delete', remoteIdPresent: true },
        '[WhatsApp] Falha ao deletar instância no Evolution Go',
      );
      throw error;
    }
  }

  /** Formata número para 55DDXXXXXXXXX (apenas dígitos). */
  private formatarNumero(numero: string): string {
    let n = (numero || '').replace(/\D/g, '');
    if (n.length === 10 || n.length === 11) n = `55${n}`;
    return n;
  }

  /**
   * Normaliza mídia para o campo `url` do /send/media: o Evolution GO aceita
   * uma URL http(s) OU uma string base64 pura (sem prefixo data:).
   */
  private normalizarMidia(media: string): string {
    const valor = (media || '').trim();
    if (/^https?:\/\//i.test(valor)) return valor;
    const virgula = valor.indexOf(',');
    return valor.startsWith('data:') && virgula >= 0 ? valor.slice(virgula + 1) : valor;
  }
}

// ============================================
// FACTORY E CACHE DE INSTÂNCIAS
// ============================================

const instanceCache = new Map<string, WhatsAppService>();

/**
 * Obtém ou cria instância do WhatsAppService para um instanceName específico.
 */
export function getWhatsAppService(instanceName: string): WhatsAppService {
  if (!instanceCache.has(instanceName)) {
    instanceCache.set(instanceName, new WhatsAppService(instanceName));
  }
  return instanceCache.get(instanceName)!;
}

/**
 * Limpa uma instância do cache (útil após desconexão / recriação).
 */
export function limparCacheWhatsApp(instanceName: string): void {
  instanceCache.delete(instanceName);
}

// ============================================
// HELPERS ADMINISTRATIVOS (reconciliação)
// ============================================

const apiUrlGlobal = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const headersGlobaisModulo = () => ({
  'Content-Type': 'application/json',
  apikey: process.env.EVOLUTION_GLOBAL_API_KEY || '',
});

function validarConfiguracaoGlobalModulo(): void {
  if (apiUrlGlobal() && process.env.EVOLUTION_GLOBAL_API_KEY) return;
  throw new EvolutionIntegrationError({
    message: 'Configuracao global da Evolution Go ausente',
    stage: 'configuracao',
    reasonCode: 'EVOLUTION_CONFIG_MISSING',
    httpStatus: 503,
  });
}

/**
 * Lista TODAS as instâncias do Evolution GO (chave global).
 * O servidor é compartilhado entre projetos — o chamador deve filtrar pelas
 * que pertencem ao Elyon (prefixo `elyon_`).
 */
export async function listarInstanciasEvolution(): Promise<any[]> {
  validarConfiguracaoGlobalModulo();
  const response = await axios.get(`${apiUrlGlobal()}/instance/all`, {
    headers: headersGlobaisModulo(),
  });
  const dados = response.data?.data || response.data || [];
  return Array.isArray(dados) ? dados : [];
}

/**
 * Deleta uma instância no Evolution GO pelo id (chave global).
 * Usado na reconciliação para remover órfãs que não têm sessão no Elyon.
 * Trata 404 como sucesso (já removida).
 */
export async function deletarInstanciaEvolutionPorId(instanceId: string): Promise<void> {
  validarConfiguracaoGlobalModulo();
  try {
    await axios.delete(`${apiUrlGlobal()}/instance/delete/${instanceId}`, {
      headers: headersGlobaisModulo(),
    });
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return;
    throw error;
  }
}
