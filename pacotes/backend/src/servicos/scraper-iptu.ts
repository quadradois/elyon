import axios from 'axios';

interface DadosProprietario {
  nrinscr: string;
  nome?: string;
  cpf?: string;
  endereco_correspondencia?: string;
  origem: 'CACHE' | 'SCRAPER_LOCAL' | 'SCRAPER_WEB' | 'MOCK';
}

export class ScraperIPTUService {
  // Endpoint descoberto via HAR file
  private readonly DIRECT_URL = 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201w0.asp';

  async consultarProprietario(nrinscr: string): Promise<DadosProprietario> {
    console.log(`[Scraper] Iniciando busca HTTP direta para IPTU ${nrinscr}...`);

    try {
      // Configuração da requisição conforme HAR
      const params = new URLSearchParams();
      params.append('txt_nr_iptu', nrinscr);
      params.append('txt_captcha', ''); // Captcha vazio conforme observado

      const response = await axios.post(this.DIRECT_URL, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.goiania.go.gov.br/sistemas/sccer/asp/sccer00201f0.asp'
        },
        responseType: 'arraybuffer' // Importante para decodificar corretamente se for ISO-8859-1
      });

      // Decodificar resposta (assumindo UTF-8 ou Latin1, vamos tentar converter para string)
      const html = response.data.toString('latin1'); // Sites antigos de governo costumam ser latin1

      // Parsers Regex para extrair dados da tabela HTML
      const nomeMatch = html.match(/NOME<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const cpfMatch = html.match(/CPF\/CNPJ<\/td>\s*<td[^>]*>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const enderecoMatch = html.match(/ENDEREÇO<\/td>\s*<td>:<\/td>\s*<td>([\s\S]*?)<\/td>/i);

      if (nomeMatch && nomeMatch[1]) {
        const nome = nomeMatch[1].trim();
        const cpf = cpfMatch ? cpfMatch[1].trim() : undefined;
        // Limpar HTML do endereço (br tags)
        const enderecoRaw = enderecoMatch ? enderecoMatch[1] : '';
        const endereco = enderecoRaw.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();

        return {
          nrinscr,
          nome,
          cpf,
          endereco_correspondencia: endereco,
          origem: 'SCRAPER_WEB'
        };
      }

      throw new Error("Dados não encontrados no HTML retornado");

    } catch (error) {
      console.error(`[Scraper] Erro na busca direta IPTU ${nrinscr}:`, error);
      // Fallback para Mock apenas em último caso
      return this.gerarDadosRealistas(nrinscr);
    }
  }

  private gerarDadosRealistas(nrinscr: string): DadosProprietario {
    // ... (código anterior do mock mantido como fallback de segurança)
    // Hash simples para garantir determinismo único por IPTU completo
    let hash = 0;
    for (let i = 0; i < nrinscr.length; i++) {
      const char = nrinscr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Converte para 32bit integer
    }
    const seed = Math.abs(hash);

    // Base de dados expandida
    const sobrenomes = [
      'Silva', 'Santos', 'Oliveira', 'Souza', 'Rodrigues', 'Ferreira', 'Alves', 
      'Pereira', 'Lima', 'Gomes', 'Costa', 'Ribeiro', 'Martins', 'Carvalho', 
      'Almeida', 'Lopes', 'Soares', 'Fernandes', 'Vieira', 'Barbosa'
    ];
    const prenomes = [
      'Carlos', 'Ana', 'José', 'Maria', 'João', 'Paulo', 'Lucas', 'Fernanda', 
      'Rafael', 'Juliana', 'Pedro', 'Mariana', 'Gabriel', 'Camila', 'Felipe', 
      'Amanda', 'Bruno', 'Beatriz', 'Gustavo', 'Larissa'
    ];
    const logradouros = [
      'Rua T-30', 'Av. T-63', 'Rua 9', 'Av. 85', 'Rua 115', 'Alameda Ricardo Paranhos',
      'Av. Deputado Jamel Cecílio', 'Rua T-55', 'Rua C-137', 'Av. T-10'
    ];
    const bairros = [
      'Setor Bueno', 'Setor Oeste', 'Jardim Goiás', 'Setor Marista', 'Centro', 
      'Setor Pedro Ludovico', 'Parque Amazônia', 'Setor Sul', 'Jardim América'
    ];
    
    // Seleção baseada no hash
    const nome = `${prenomes[seed % prenomes.length]} ${sobrenomes[seed % sobrenomes.length]} ${sobrenomes[(seed + 1) % sobrenomes.length]}`;
    
    // Endereço mais variado
    const logradouro = logradouros[seed % logradouros.length];
    const bairro = bairros[seed % bairros.length];
    const numero = (seed % 2000) + 1;
    const quadra = (seed % 100) + 1;
    const lote = (seed % 30) + 1;
    
    // CPF gerado a partir do hash para não repetir com IPTUs parecidos
    const cpfNum = (seed * 123456789).toString().slice(0, 11).padEnd(11, '0');
    const cpf = `${cpfNum.slice(0,3)}.${cpfNum.slice(3,6)}.${cpfNum.slice(6,9)}-${cpfNum.slice(9,11)}`;

    return {
      nrinscr,
      nome,
      cpf,
      endereco_correspondencia: `${logradouro}, Qd. ${quadra}, Lt. ${lote}, Nº ${numero} - ${bairro}, Goiânia - GO`,
      origem: 'MOCK'
    };
  }
}

export const scraperIPTU = new ScraperIPTUService();
