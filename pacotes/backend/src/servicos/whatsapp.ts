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

// A Evolution Go inicia a conexão antes de disponibilizar o QR. Esta janela
// limitada evita transformar esse estado transitório em erro imediato sem
// manter a requisição presa indefinidamente.
const QR_POLL_DELAYS_MS = [1000, 1000, 1500, 1500, 2000, 2000, 2500, 2500, 3000, 3000] as const;

function aguardar(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * WhatsAppService - Gerencia conexão com o Evolution GO (whatsmeow).
 *
 * Multi-tenant: cada SessaoWhatsapp tem seu próprio instanceName e, no
 * Evolution GO, um instanceId (uuid) + token próprio.
 *
 * Modelo de autenticação do Evolution GO:
 * - chave do tenant (EVOLUTION_TENANT_API_KEY + EVOLUTION_TENANT_ID): criar,
 *   listar e excluir instâncias (/instance/*) e executar reconciliação
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

  private get tenantApiKey(): string {
    return process.env.EVOLUTION_TENANT_API_KEY || '';
  }

  private get evolutionTenantId(): string {
    return process.env.EVOLUTION_TENANT_ID || '';
  }

  get instanceName(): string {
    return this._instanceName;
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
    authScope: 'base' | 'tenant' = 'base',
  ): void {
    const authConfigurada = authScope === 'base'
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

    return this.aguardarQrCode(instanceAlreadyExisted);
  }

  private async aguardarQrCode(instanceAlreadyExisted: boolean): Promise<WhatsAppConnectionResult> {
    for (let tentativa = 0; tentativa <= QR_POLL_DELAYS_MS.length; tentativa += 1) {
      try {
        const qrResp = await axios.get(
          `${this.apiUrl}/instance/qr`,
          { headers: this.headersInstancia() },
        );
        const dados = qrResp.data?.data || qrResp.data || {};
        const qrcode = dados.Qrcode || dados.qrcode;
        if (qrcode) {
          return { base64: qrcode, qrcode, code: dados.Code || dados.code, count: tentativa };
        }
      } catch (error: any) {
        const detalhe = String(error?.response?.data?.error || error?.message || '');
        if (/already logged in/i.test(detalhe)) {
          return { status: 'open', count: tentativa };
        }

        const qrAindaIndisponivel = error?.response?.status === 400
          && /no qr code available/i.test(detalhe);
        if (!qrAindaIndisponivel) {
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

      const status = await this.verificarStatus();
      if (status?.instance?.state === 'open') {
        return { status: 'open', count: tentativa };
      }

      if (tentativa < QR_POLL_DELAYS_MS.length) {
        await aguardar(QR_POLL_DELAYS_MS[tentativa]);
      }
    }

    const falha = new EvolutionIntegrationError({
      message: 'QR Code não disponibilizado pela Evolution Go no prazo esperado',
      stage: 'instance/qr',
      route: '/instance/qr',
      upstreamStatus: 400,
      reasonCode: 'WHATSAPP_QR_TIMEOUT',
      httpStatus: 502,
      instanceAlreadyExisted,
    });
    logger.error(
      {
        ...this.contextoSeguro(instanceAlreadyExisted),
        stage: falha.stage,
        route: falha.route,
        upstreamStatus: falha.upstreamStatus,
        reasonCode: falha.reasonCode,
        attempts: QR_POLL_DELAYS_MS.length + 1,
      },
      '[WhatsApp] QR Code indisponível após polling',
    );
    throw falha;
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

  /** Busca os detalhes da instância via /instance/all (escopo tenant). */
  async buscarDetalhesInstancia(
    lancarErro = false,
    failureStage: EvolutionStage = 'instance/create',
    remoteId?: string,
  ): Promise<any> {
    try {
      this.validarConfiguracao(failureStage, 'tenant');
      const response = await axios.get(
        `${this.apiUrl}/instance/all`,
        { headers: this.headersTenant },
      );
      const instancias = response.data?.data || response.data || [];
      if (!Array.isArray(instancias)) {
        if (lancarErro) {
          throw toEvolutionIntegrationError(new Error('Resposta sem lista de instâncias'), {
            stage: failureStage,
            route: '/instance/all',
            instanceAlreadyExisted: true,
            contractInvalid: true,
          });
        }
        return null;
      }
      const instancia = remoteId
        ? instancias.find((i: any) => i.id === remoteId)
        : instancias.find((i: any) => i.name === this._instanceName);
      if (!instancia) return null;
      return { ...instancia, ownerJid: instancia.jid, profileName: instancia.client_name || instancia.name };
    } catch (error: any) {
      if (lancarErro) {
        throw toEvolutionIntegrationError(error, {
          stage: failureStage,
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
   * Deleta a instância no Evolution GO (escopo tenant).
   * Retorna 'deletada' se removida no servidor, ou 'inexistente' se já não
   * existia lá. Lança erro em falhas reais (rede/5xx) para que o chamador
   * NÃO apague o registro local e evite criar instâncias órfãs no Evolution GO.
   */
  async deletarInstancia(): Promise<'deletada' | 'inexistente'> {
    this.validarConfiguracao('instance/delete', 'tenant');
    await this.carregarCredenciais();

    // Se o id não está persistido, tenta resolvê-lo pelo nome no próprio
    // servidor — cobre sessões que nunca salvaram o evolutionInstanceId e
    // instâncias criadas fora do fluxo normal.
    let instanceId = this._instanceId;
    if (!instanceId) {
      const detalhes = await this.buscarDetalhesInstancia(true, 'instance/delete');
      instanceId = detalhes?.id;
    }
    if (!instanceId) return 'inexistente';

    try {
      await axios.delete(
        `${this.apiUrl}/instance/delete/${instanceId}`,
        { headers: this.headersTenant },
      );
      return 'deletada';
    } catch (error: any) {
      // 404 = instância já não existe no Evolution GO → tratamos como sucesso.
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return 'inexistente';
      }
      if (axios.isAxiosError(error) && error.response?.status === 500) {
        const aindaExiste = await this.buscarDetalhesInstancia(
          true,
          'instance/delete',
          instanceId,
        );
        if (!aindaExiste) return 'inexistente';
      }
      const falha = toEvolutionIntegrationError(error, {
        stage: 'instance/delete',
        route: '/instance/delete/:id',
        instanceAlreadyExisted: true,
      });
      logger.error(
        {
          stage: falha.stage,
          route: falha.route,
          upstreamStatus: falha.upstreamStatus,
          reasonCode: falha.reasonCode,
          remoteIdPresent: true,
        },
        '[WhatsApp] Falha ao deletar instância no Evolution Go',
      );
      throw falha;
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

const apiUrlEvolution = () => (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
const headersTenantModulo = () => ({
  'Content-Type': 'application/json',
  apikey: process.env.EVOLUTION_TENANT_API_KEY || '',
  'X-Tenant-ID': process.env.EVOLUTION_TENANT_ID || '',
});

function validarConfiguracaoTenantModulo(): void {
  if (
    apiUrlEvolution()
    && process.env.EVOLUTION_TENANT_API_KEY
    && process.env.EVOLUTION_TENANT_ID
  ) return;
  throw new EvolutionIntegrationError({
    message: 'Configuracao tenant da Evolution Go ausente',
    stage: 'configuracao',
    reasonCode: 'EVOLUTION_CONFIG_MISSING',
    httpStatus: 503,
  });
}

/**
 * Lista as instâncias do tenant Elyon.
 */
export async function listarInstanciasEvolution(
  failureStage: EvolutionStage = 'instance/list',
): Promise<any[]> {
  validarConfiguracaoTenantModulo();
  try {
    const response = await axios.get(`${apiUrlEvolution()}/instance/all`, {
      headers: headersTenantModulo(),
    });
    const dados = response.data?.data || response.data || [];
    if (!Array.isArray(dados)) {
      throw toEvolutionIntegrationError(new Error('Resposta sem lista de instancias'), {
        stage: failureStage,
        route: '/instance/all',
        contractInvalid: true,
      });
    }
    return dados;
  } catch (error) {
    throw toEvolutionIntegrationError(error, {
      stage: failureStage,
      route: '/instance/all',
    });
  }
}

/**
 * Deleta uma instância no Evolution GO pelo id (escopo tenant).
 * Usado na reconciliação para remover órfãs que não têm sessão no Elyon.
 * Trata 404 como sucesso. Para o 500 conhecido do deployment, confirma a
 * ausência do ID por listagem tenant-scoped antes de concluir.
 */
export async function deletarInstanciaEvolutionPorId(instanceId: string): Promise<void> {
  validarConfiguracaoTenantModulo();
  try {
    await axios.delete(`${apiUrlEvolution()}/instance/delete/${instanceId}`, {
      headers: headersTenantModulo(),
    });
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return;
    if (axios.isAxiosError(error) && error.response?.status === 500) {
      const instancias = await listarInstanciasEvolution('instance/delete');
      if (!instancias.some((instancia: any) => instancia?.id === instanceId)) return;
    }
    throw toEvolutionIntegrationError(error, {
      stage: 'instance/delete',
      route: '/instance/delete/:id',
      instanceAlreadyExisted: true,
    });
  }
}
