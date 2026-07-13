import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../lib/db';

interface EvolutionInstance {
  instanceName: string;
  state: string;
  status?: string;
  profileName?: string;
  ownerJid?: string;
}

/**
 * WhatsAppService - Gerencia conexão com o Evolution GO (whatsmeow).
 *
 * Multi-tenant: cada SessaoWhatsapp tem seu próprio instanceName e, no
 * Evolution GO, um instanceId (uuid) + token próprio.
 *
 * Modelo de autenticação do Evolution GO:
 * - chave global (EVOLUTION_API_KEY): gerenciar instâncias
 *   (/instance/create, /instance/all, /instance/delete)
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

  constructor(instanceName: string) {
    this._instanceName = instanceName;
  }

  // Lê variáveis de ambiente em tempo real
  private get apiUrl(): string {
    return (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '');
  }

  private get globalKey(): string {
    return process.env.EVOLUTION_API_KEY || '';
  }

  get instanceName(): string {
    return this._instanceName;
  }

  private get headersGlobais() {
    return { 'Content-Type': 'application/json', apikey: this.globalKey };
  }

  private headersInstancia() {
    if (!this._token) {
      throw new Error(`Instância ${this._instanceName} sem token do Evolution GO. Crie/conecte a instância primeiro.`);
    }
    return { 'Content-Type': 'application/json', apikey: this._token };
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
  private async garantirInstancia(): Promise<void> {
    await this.carregarCredenciais();
    if (this._instanceId && this._token) return;
    await this.criarInstancia();
  }

  /** Persiste instanceId/token na sessão e atualiza o cache local. */
  private async salvarCredenciais(instanceId: string, token: string): Promise<void> {
    this._instanceId = instanceId;
    this._token = token;
    this._credenciaisCarregadas = true;
    await prisma.sessaoWhatsapp.update({
      where: { instanceName: this._instanceName },
      data: { evolutionInstanceId: instanceId, evolutionToken: token },
    }).catch((err) => console.error(`[WhatsApp] Erro ao salvar credenciais de ${this._instanceName}:`, err));
  }

  async criarInstancia(): Promise<any> {
    await this.carregarCredenciais();

    const token = this._token || crypto.randomBytes(32).toString('hex');

    try {
      console.log(`[WhatsApp] Criando instância ${this._instanceName} no Evolution GO (${this.apiUrl})...`);
      const response = await axios.post(
        `${this.apiUrl}/instance/create`,
        {
          name: this._instanceName,
          token,
          advancedSettings: { ignoreGroups: true },
        },
        { headers: this.headersGlobais },
      );

      const criada = response.data?.data || response.data;
      const instanceId = criada?.id;
      const instanceToken = criada?.token || token;

      if (!instanceId) {
        throw new Error(`Resposta inesperada do /instance/create: ${JSON.stringify(response.data)}`);
      }

      await this.salvarCredenciais(instanceId, instanceToken);
      console.log(`[WhatsApp] ✅ Instância ${this._instanceName} criada (id=${instanceId})`);
      return criada;
    } catch (error: any) {
      // Instância já existe no Evolution GO — adota o id/token existentes.
      const detalhe = error?.response?.data?.error || error?.message || '';
      if (axios.isAxiosError(error) && /already exists/i.test(String(detalhe))) {
        console.log(`[WhatsApp] Instância ${this._instanceName} já existe no Evolution GO, adotando...`);
        const existente = await this.buscarDetalhesInstancia();
        if (existente?.id && existente?.token) {
          await this.salvarCredenciais(existente.id, existente.token);
          return existente;
        }
      }
      console.error('[WhatsApp] Erro ao criar instância:', detalhe);
      throw error;
    }
  }

  async conectarInstancia(): Promise<{ qrcode?: string; base64?: string; code?: string; count?: number; status?: string }> {
    await this.garantirInstancia();

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
      console.error('[WhatsApp] Erro ao conectar instância:', error?.response?.data || error?.message);
      throw error;
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
      console.error('[WhatsApp] Erro ao obter QR Code:', detalhe);
      throw error;
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

  async enviarMensagemTexto(numero: string, texto: string): Promise<any> {
    await this.garantirInstancia();
    const numeroFormatado = this.formatarNumero(numero);

    console.log(`[WhatsApp] 🚀 Enviando texto para ${numeroFormatado} (instância ${this._instanceName})`);

    try {
      const response = await axios.post(
        `${this.apiUrl}/send/text`,
        { number: numeroFormatado, text: texto, delay: 1200 },
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao enviar texto:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async enviarMensagemAudio(numero: string, audioBase64: string, _ptt: boolean = true): Promise<any> {
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
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao enviar áudio:', error?.response?.data || error?.message);
      throw error;
    }
  }

  async enviarMensagemDocumento(
    numero: string,
    media: string,
    options?: { fileName?: string; mimeType?: string; caption?: string },
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
        { headers: this.headersInstancia() },
      );
      return response.data;
    } catch (error: any) {
      console.error('[WhatsApp] Erro ao enviar documento:', error?.response?.data || error?.message);
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
      console.error('[WhatsApp] Erro ao enviar contato:', error?.response?.data || error?.message);
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
      console.error('[WhatsApp] Erro ao buscar configurações:', error?.response?.data || error?.message);
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
      console.error('[WhatsApp] Erro ao atualizar configurações:', error?.response?.data || error?.message);
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
      console.error('[WhatsApp] Erro ao configurar webhook:', error?.response?.data || error?.message);
      throw error;
    }
  }

  /** Busca os detalhes da instância via /instance/all (chave global). */
  async buscarDetalhesInstancia(): Promise<any> {
    try {
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
      console.error('[WhatsApp] Erro ao buscar detalhes da instância:', error?.response?.data || error?.message);
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
      console.error(
        `[WhatsApp] Falha ao deletar instância ${this._instanceName} (id=${instanceId}) no Evolution GO:`,
        error?.response?.data || error?.message,
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
  apikey: process.env.EVOLUTION_API_KEY || '',
});

/**
 * Lista TODAS as instâncias do Evolution GO (chave global).
 * O servidor é compartilhado entre projetos — o chamador deve filtrar pelas
 * que pertencem ao Elyon (prefixo `elyon_`).
 */
export async function listarInstanciasEvolution(): Promise<any[]> {
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
  try {
    await axios.delete(`${apiUrlGlobal()}/instance/delete/${instanceId}`, {
      headers: headersGlobaisModulo(),
    });
  } catch (error: any) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return;
    throw error;
  }
}
