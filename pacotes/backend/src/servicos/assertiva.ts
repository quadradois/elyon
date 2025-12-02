import axios from 'axios';

// Interface completa com TODOS os dados da Assertiva
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
  
  // Dados Cadastrais
  dataNascimento?: string;
  idade?: number;
  sexo?: 'Masculino' | 'Feminino';
  signo?: string;
  situacaoCadastral?: string;
  obitoProvavel?: boolean;
  nomeMae?: string;
  cpfMae?: string;           // NOVO
  escolaridade?: string;      // NOVO
  ppe?: boolean; // Pessoa Politicamente Exposta
  
  // Dados Profissionais (mais recente)
  rendaEstimada?: number;
  faixaSalarial?: string;
  profissao?: string;
  setor?: string;
  empresaAtual?: string;
  cnpjEmpresa?: string;
  
  // Endereço Principal
  endereco?: {
    tipoLogradouro?: string;  // NOVO
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    cidade?: string;
    uf?: string;
    cep?: string;
  };
  
  // Participações em empresas
  participacoesEmpresas?: {
    cnpj: string;
    razaoSocial: string;
    participacao: string;
  }[];
  
  // Redes Sociais
  redesSociais?: {
    rede: string;
    url: string;
  }[];
}

export class AssertivaService {
  private readonly AUTH_URL = 'https://api.assertivasolucoes.com.br/oauth2/v3/token';
  private readonly API_URL = 'https://api.assertivasolucoes.com.br/localize/v3/cpf';
  
  private token: string | null = null;
  private tokenExpiration: number = 0;

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
      console.log('[Assertiva] Credenciais não configuradas. Usando MOCK.');
      return this.mockEnriquecimento(cpf, nome);
    }

    try {
      const cleanCpf = cpf.replace(/\D/g, '');
      
      const response = await axios.get(this.API_URL, {
        headers: { 'Authorization': `Bearer ${token}` },
        params: {
          cpf: cleanCpf,
          idFinalidade: 1
        }
      });

      const data = response.data.resposta;
      const cadastro = data.dadosCadastrais || {};
      
      // Mapear telefones
      const telefones: DadosEnriquecidos['telefones'] = [];
      
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

      // Mapear emails
      const emails = data.emails ? data.emails.map((e: any) => e.email) : [];

      // Pegar histórico profissional mais recente
      const historicoProf = data.possivelHistoricoProfissional || [];
      const profissaoRecente = historicoProf.length > 0 ? historicoProf[0] : null;

      // Pegar endereço principal
      const enderecos = data.enderecos || [];
      const enderecoP = enderecos.length > 0 ? enderecos[0] : null;

      // Participações em empresas
      const participacoes = (data.participacoesEmpresas || []).map((p: any) => ({
        cnpj: p.cnpj,
        razaoSocial: p.razaoSocial,
        participacao: p.participacao || p.qualificacao
      }));

      // Redes sociais
      const redes = (data.redesSociais || []).map((r: any) => ({
        rede: r.rede || r.tipo,
        url: r.url || r.link
      }));

      const resultado: DadosEnriquecidos = {
        cpf,
        nome: cadastro.nome || nome,
        telefones,
        emails,
        score: 100,
        
        // Dados Cadastrais
        dataNascimento: cadastro.dataNascimento,
        idade: cadastro.idade,
        sexo: cadastro.sexo,
        signo: cadastro.signo,
        situacaoCadastral: cadastro.situacaoCadastral,
        obitoProvavel: cadastro.obitoProvavel || false,
        nomeMae: cadastro.maeNome,
        cpfMae: cadastro.maeCpf,           // NOVO
        escolaridade: cadastro.escolaridade, // NOVO
        ppe: cadastro.ppe || false,
        
        // Dados Profissionais
        rendaEstimada: profissaoRecente ? parseFloat(profissaoRecente.rendaEstimada) : undefined,
        faixaSalarial: profissaoRecente?.faixaSalarial,
        profissao: profissaoRecente?.cboDescricao,
        setor: profissaoRecente?.setor,
        empresaAtual: profissaoRecente?.razaoSocial,
        cnpjEmpresa: profissaoRecente?.cnpj,
        
        // Endereço
        endereco: enderecoP ? {
          tipoLogradouro: enderecoP.tipoLogradouro, // NOVO
          logradouro: enderecoP.logradouro,
          numero: enderecoP.numero,
          complemento: enderecoP.complemento,
          bairro: enderecoP.bairro,
          cidade: enderecoP.cidade || enderecoP.municipio,
          uf: enderecoP.uf,
          cep: enderecoP.cep
        } : undefined,
        
        // Participações
        participacoesEmpresas: participacoes.length > 0 ? participacoes : undefined,
        
        // Redes Sociais
        redesSociais: redes.length > 0 ? redes : undefined
      };

      console.log(`[Assertiva] ✅ CPF ${cpf} enriquecido!`);
      console.log(`  → Nome: ${resultado.nome} | Idade: ${resultado.idade || 'N/A'} | Sexo: ${resultado.sexo || 'N/A'}`);
      console.log(`  → Renda: R$ ${resultado.rendaEstimada?.toFixed(2) || 'N/A'} (${resultado.faixaSalarial || 'N/A'})`);
      console.log(`  → Telefones: ${telefones.length} | Emails: ${emails.length}`);
      
      return resultado;

    } catch (error: any) {
      console.error(`[Assertiva] Erro ao consultar CPF ${cpf}:`, error.message);
      return this.mockEnriquecimento(cpf, nome);
    }
  }

  private async mockEnriquecimento(cpf: string, nome: string): Promise<DadosEnriquecidos> {
    await this.delay(500);

    const finalCPF = cpf.replace(/\D/g, '').slice(-1);
    const temWhatsapp = parseInt(finalCPF) % 2 === 0;
    const idade = 25 + Math.floor(Math.random() * 35);
    const sexos: ('Masculino' | 'Feminino')[] = ['Masculino', 'Feminino'];
    const faixas = ['Até 2 Salários Mínimos', 'De 2 a 3 Salários Mínimos', 'De 3 a 5 Salários Mínimos', 'De 5 a 10 Salários Mínimos', 'Acima de 10 Salários Mínimos'];
    const setores = ['Comércio', 'Serviços', 'Indústria', 'Tecnologia', 'Saúde', 'Educação'];
    const bairros = ['Centro', 'Jardim América', 'Setor Bueno', 'Setor Marista', 'Setor Oeste'];
    const escolaridades = ['Ensino Fundamental', 'Ensino Médio', 'Superior Incompleto', 'Superior Completo', 'Pós-Graduação'];
    const tiposLogradouro = ['Rua', 'Avenida', 'Alameda', 'Travessa', 'Praça'];

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
      score: 85 + Math.floor(Math.random() * 15),
      
      // Dados Cadastrais (mock)
      dataNascimento: `${Math.floor(Math.random() * 28 + 1).toString().padStart(2, '0')}/${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}/${2024 - idade}`,
      idade,
      sexo: sexos[Math.floor(Math.random() * 2)],
      signo: ['Áries', 'Touro', 'Gêmeos', 'Câncer', 'Leão', 'Virgem', 'Libra', 'Escorpião', 'Sagitário', 'Capricórnio', 'Aquário', 'Peixes'][Math.floor(Math.random() * 12)],
      situacaoCadastral: 'REGULAR',
      obitoProvavel: false,
      nomeMae: `MARIA ${nome.split(' ').pop()?.toUpperCase()}`,
      cpfMae: `${Math.floor(Math.random() * 99999999999).toString().padStart(11, '0')}`, // NOVO
      escolaridade: escolaridades[Math.floor(Math.random() * escolaridades.length)],      // NOVO
      ppe: false,
      
      // Dados Profissionais (mock)
      rendaEstimada: 2000 + Math.floor(Math.random() * 8000),
      faixaSalarial: faixas[Math.floor(Math.random() * faixas.length)],
      profissao: ['Analista', 'Gerente', 'Vendedor', 'Técnico', 'Assistente'][Math.floor(Math.random() * 5)],
      setor: setores[Math.floor(Math.random() * setores.length)],
      empresaAtual: ['EMPRESA ABC LTDA', 'COMERCIO XYZ SA', 'SERVICOS 123 ME'][Math.floor(Math.random() * 3)],
      
      // Endereço (mock - Goiânia)
      endereco: {
        tipoLogradouro: tiposLogradouro[Math.floor(Math.random() * tiposLogradouro.length)], // NOVO
        logradouro: `${Math.floor(Math.random() * 100)}`,
        numero: `${Math.floor(Math.random() * 1000)}`,
        bairro: bairros[Math.floor(Math.random() * bairros.length)],
        cidade: 'Goiânia',
        uf: 'GO',
        cep: `74${Math.floor(Math.random() * 900 + 100).toString()}-${Math.floor(Math.random() * 900 + 100).toString()}`
      }
    };
  }
}

export const assertivaService = new AssertivaService();
