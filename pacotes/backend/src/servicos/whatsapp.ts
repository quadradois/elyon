import axios from 'axios';

interface EvolutionInstance {
  instanceName: string;
  status: string;
  state: string;
}

/**
 * WhatsAppService - Gerencia conexão com Evolution API
 * 
 * Suporta múltiplas instâncias (multi-tenant):
 * - Cada SessaoWhatsapp tem seu próprio instanceName
 * - Use getWhatsAppService(instanceName) para obter instância do serviço
 */
export class WhatsAppService {
  private _instanceName: string;

  constructor(instanceName: string) {
    this._instanceName = instanceName;
  }

  // Usar getters para ler variáveis de ambiente em tempo real
  private get apiUrl(): string {
    return process.env.EVOLUTION_API_URL || '';
  }

  private get apiKey(): string {
    return process.env.EVOLUTION_API_KEY || '';
  }

  get instanceName(): string {
    return this._instanceName;
  }

  private get instanceToken(): string | undefined {
    return process.env.EVOLUTION_INSTANCE_TOKEN;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.apiKey
    };
  }

  async criarInstancia(): Promise<any> {
    try {
      console.log(`Criando instância ${this.instanceName} na URL ${this.apiUrl}...`);
      const response = await axios.post(
        `${this.apiUrl}/instance/create`,
        {
          instanceName: this.instanceName,
          token: this.instanceToken,
          qrcode: true,
          integration: "WHATSAPP-BAILEYS"
        },
        { headers: this.getHeaders() }
      );
      console.log('Instância criada com sucesso:', response.data);

      // Auto-configurar webhook após criação
      const backendUrl = process.env.BACKEND_URL || 'https://api.elyon.quadradois.com.br';
      const webhookUrl = `${backendUrl}/api/webhooks/whatsapp`;

      try {
        await this.configurarWebhook(webhookUrl, true);
        console.log(`Webhook auto-configurado para ${this.instanceName}`);

        // Auto-configurar ignorar grupos
        await this.atualizarConfiguracao(true);
        console.log(`Configuração 'Ignorar Grupos' ativada para ${this.instanceName}`);
      } catch (err) {
        console.error(`Erro ao auto-configurar instância ${this.instanceName}:`, err);
      }

      return response.data;
    } catch (error: any) {
      console.error('Erro ao criar instância WhatsApp:', error.message);
      if (error.response) {
        console.error('Detalhes do erro Evolution:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async conectarInstancia(): Promise<{ qrcode?: string; base64?: string; count?: number; status?: string }> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/connect/${this.instanceName}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao conectar instância WhatsApp:', error);
      // Se der erro 404, tenta criar
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('Instância não encontrada, criando...');
        await this.criarInstancia();
        return this.conectarInstancia();
      }
      throw error;
    }
  }

  async verificarStatus(): Promise<{ instance: EvolutionInstance } | null> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/connectionState/${this.instanceName}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      // Instância pode não existir
      return null;
    }
  }

  async enviarMensagemTexto(numero: string, texto: string): Promise<any> {
    try {
      // Formata número para 55DDXXXXXXXXX (apenas dígitos)
      let numeroFormatado = numero.replace(/\D/g, '');

      // Se tiver 10 ou 11 dígitos, assume que é BR e adiciona 55
      if (numeroFormatado.length === 10 || numeroFormatado.length === 11) {
        numeroFormatado = `55${numeroFormatado}`;
      }

      // Evolution API v2.x espera apenas o número, sem @s.whatsapp.net
      const response = await axios.post(
        `${this.apiUrl}/message/sendText/${this.instanceName}`,
        {
          number: numeroFormatado,
          text: texto,
          delay: 1200,
          linkPreview: false
        },
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Erro ao enviar mensagem WhatsApp:', error);
      throw error;
    }
  }

  async buscarConfiguracao(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/settings/find/${this.instanceName}`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Erro ao buscar configurações:', error.message);
      throw error;
    }
  }

  async atualizarConfiguracao(ignorarGrupos: boolean): Promise<any> {
    try {
      console.log(`Buscando configurações atuais da instância ${this.instanceName}...`);

      // 1. Busca configurações atuais
      const currentSettings = await this.buscarConfiguracao();

      // 2. Mescla com a nova configuração
      const newSettings = {
        ...currentSettings,
        groupsIgnore: ignorarGrupos
      };

      console.log(`Atualizando configurações da instância ${this.instanceName}...`);

      // 3. Envia o objeto completo
      const response = await axios.post(
        `${this.apiUrl}/settings/set/${this.instanceName}`,
        newSettings,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error: any) {
      console.error('Erro ao atualizar configurações:', error.message);
      throw error;
    }
  }

  async configurarWebhook(url: string, enabled: boolean = true): Promise<any> {
    try {
      console.log(`Configurando webhook para ${this.instanceName} na URL ${url}...`);
      const response = await axios.post(
        `${this.apiUrl}/webhook/set/${this.instanceName}`,
        {
          webhook: {
            url: url,
            byEvents: false,
            enabled: enabled,
            events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE'],
            base64: true
          }
        },
        { headers: this.getHeaders() }
      );
      console.log('Webhook configurado com sucesso:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Erro ao configurar webhook:', error.message);
      if (error.response) {
        console.error('Detalhes do erro Evolution:', JSON.stringify(error.response.data, null, 2));
      }
      throw error;
    }
  }

  async buscarDetalhesInstancia(): Promise<any> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/instance/fetchInstances`,
        { headers: this.getHeaders() }
      );
      // Evolution v2 returns an array of instances
      const instances = Array.isArray(response.data) ? response.data : [];
      // A resposta da API v2 retorna o objeto direto, não aninhado em 'instance'
      return instances.find((i: any) => i.name === this.instanceName);
    } catch (error: any) {
      console.error('Erro ao buscar detalhes da instância:', error.message);
      return null;
    }
  }
}

// ============================================
// FACTORY E CACHE DE INSTÂNCIAS
// ============================================

/**
 * Cache de instâncias do WhatsAppService
 * Evita criar múltiplas instâncias para o mesmo instanceName
 */
const instanceCache = new Map<string, WhatsAppService>();

/**
 * Obtém ou cria instância do WhatsAppService para um instanceName específico
 * @param instanceName Nome da instância na Evolution API (ex: "elyon_tenant123_vendas")
 */
export function getWhatsAppService(instanceName: string): WhatsAppService {
  if (!instanceCache.has(instanceName)) {
    instanceCache.set(instanceName, new WhatsAppService(instanceName));
  }
  return instanceCache.get(instanceName)!;
}

/**
 * Limpa uma instância do cache (útil após desconexão)
 */
export function limparCacheWhatsApp(instanceName: string): void {
  instanceCache.delete(instanceName);
}

/**
 * @deprecated Use getWhatsAppService(instanceName) para multi-tenant
 * Mantido para compatibilidade - usa instância padrão do .env
 */
export const whatsappService = new WhatsAppService(
  process.env.EVOLUTION_INSTANCE_NAME || 'elyon_main'
);
