import axios from 'axios';

interface EvolutionInstance {
  instanceName: string;
  status: string;
  state: string;
}

export class WhatsAppService {
  private apiUrl: string;
  private apiKey: string;
  private instanceName: string;
  private instanceToken: string | undefined;

  constructor() {
    this.apiUrl = process.env.EVOLUTION_API_URL || '';
    this.apiKey = process.env.EVOLUTION_API_KEY || '';
    this.instanceName = process.env.EVOLUTION_INSTANCE_NAME || 'elyon_main';
    this.instanceToken = process.env.EVOLUTION_INSTANCE_TOKEN;
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
      // Formata número para 55DDXXXXXXXXX
      let numeroFormatado = numero.replace(/\D/g, '');
      
      // Se tiver 10 ou 11 dígitos, assume que é BR e adiciona 55
      if (numeroFormatado.length === 10 || numeroFormatado.length === 11) {
        numeroFormatado = `55${numeroFormatado}`;
      }
      
      const remoteJid = `${numeroFormatado}@s.whatsapp.net`;

      const response = await axios.post(
        `${this.apiUrl}/message/sendText/${this.instanceName}`,
        {
          number: remoteJid,
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
            webhookByEvents: false,
            enabled: enabled,
            events: ['MESSAGES_UPSERT'],
            webhookBase64: false
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
}

export const whatsappService = new WhatsAppService();
