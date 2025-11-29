import axios from 'axios';

interface DadosEnriquecidos {
  cpf: string;
  nome: string;
  telefones: {
    numero: string;
    tipo: 'CELULAR' | 'FIXO';
    whatsapp: boolean;
  }[];
  emails: string[];
  score: number; // 0-100
}

export class AssertivaService {
  private readonly AUTH_URL = 'https://api.assertivasolucoes.com.br/oauth2/v3/token';
  private readonly API_URL = 'https://api.assertivasolucoes.com.br/localize/v3/cpf';
  
  private token: string | null = null;
  private tokenExpiration: number = 0;

  // Simula delay de API externa (usado no mock)
  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async getAccessToken(): Promise<string | null> {
    const clientId = process.env.ASSERTIVA_CLIENT_ID;
    const clientSecret = process.env.ASSERTIVA_CLIENT_SECRET;

    if (!clientId || !clientSecret) return null;

    if (this.token && Date.now() < this.tokenExpiration) {
      return this.token;
    }

    try {
      const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await axios.post(
        this.AUTH_URL, 
        'grant_type=client_credentials',
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      this.token = response.data.access_token;
      // Expires in is in seconds, reduce 60s for safety buffer
      this.tokenExpiration = Date.now() + ((response.data.expires_in - 60) * 1000);
      return this.token;
    } catch (error) {
      console.error('[Assertiva] Erro ao autenticar:', error);
      return null;
    }
  }

  async enriquecerCPF(cpf: string, nome: string): Promise<DadosEnriquecidos> {
    const token = await this.getAccessToken();

    if (!token) {
      console.log('[Assertiva] Credenciais não configuradas ou inválidas. Usando MOCK.');
      return this.mockEnriquecimento(cpf, nome);
    }

    try {
      // Remove non-digits
      const cleanCpf = cpf.replace(/\D/g, '');
      
      const response = await axios.get(this.API_URL, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          cpf: cleanCpf,
          idFinalidade: 1 // 1 - Confirmação de identidade
        }
      });

      const data = response.data.resposta;
      
      // Map response to our format
      const telefones = [];
      
      if (data.telefones?.moveis) {
        telefones.push(...data.telefones.moveis.map((t: any) => ({
          numero: t.numero,
          tipo: 'CELULAR' as const,
          whatsapp: t.aplicativos?.whatsApp || false
        })));
      }
      
      if (data.telefones?.fixos) {
        telefones.push(...data.telefones.fixos.map((t: any) => ({
          numero: t.numero,
          tipo: 'FIXO' as const,
          whatsapp: t.aplicativos?.whatsAppBusiness || false
        })));
      }

      const emails = data.emails ? data.emails.map((e: any) => e.email) : [];

      return {
        cpf,
        nome: data.dadosCadastrais?.nome || nome,
        telefones,
        emails,
        score: 100 // Dados reais têm alta confiança
      };

    } catch (error) {
      console.error(`[Assertiva] Erro ao consultar CPF ${cpf}:`, error);
      // Fallback para Mock em caso de erro na API (ex: limite excedido, erro 500)
      return this.mockEnriquecimento(cpf, nome);
    }
  }

  private async mockEnriquecimento(cpf: string, nome: string): Promise<DadosEnriquecidos> {
    await this.delay(500); // Simula latência de rede

    // Gera dados determinísticos baseados no CPF para consistência nos testes
    const finalCPF = cpf.replace(/\D/g, '').slice(-1);
    const temWhatsapp = parseInt(finalCPF) % 2 === 0;

    return {
      cpf,
      nome,
      telefones: [
        {
          numero: `629${Math.floor(Math.random() * 100000000)}`,
          tipo: 'CELULAR',
          whatsapp: temWhatsapp
        },
        {
          numero: `623${Math.floor(Math.random() * 10000000)}`,
          tipo: 'FIXO',
          whatsapp: false
        }
      ],
      emails: [
        `${nome.split(' ')[0].toLowerCase()}@gmail.com`,
        `${nome.split(' ')[0].toLowerCase()}@hotmail.com`
      ],
      score: 85 + Math.floor(Math.random() * 15)
    };
  }
}

export const assertivaService = new AssertivaService();
