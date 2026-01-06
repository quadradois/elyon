import axios from 'axios';

interface DadosProprietario {
  nrinscr: string;
  nome?: string;
  cpf?: string;
  endereco_correspondencia?: string;
  // Campos parseados do endereço
  logradouro?: string;
  numero?: string;
  apartamento?: string;
  bloco?: string;
  unidade?: string;        // Unidade completa (ex: APTO806BL.B)
  quadra?: string;
  lote?: string;
  nomeEdificio?: string;
  box?: string;
  tipoImovel?: string;     // PREDIAL, TERRITORIAL, etc
  origem: 'CACHE' | 'SCRAPER_LOCAL' | 'SCRAPER_WEB' | 'MOCK';
}

// Função para parsear o endereço da Prefeitura (exportada para uso em outros módulos)
export function parsearEnderecoPrefeitura(endereco: string): Partial<DadosProprietario> {
  const resultado: Partial<DadosProprietario> = {};

  if (!endereco) return resultado;

  // Exemplo: "AV VITORIA S/N APTO806BL.B QD: 04 LT: 01E ED RES RESERVA BURITI BOX: 108"

  // Extrair BOX
  const boxMatch = endereco.match(/BOX[:\s]*(\d+[A-Z]?)/i);
  if (boxMatch) resultado.box = boxMatch[1].trim();

  // Extrair Quadra
  const quadraMatch = endereco.match(/QD[:\s]*([^\s]+)/i);
  if (quadraMatch) resultado.quadra = quadraMatch[1].trim();

  // Extrair Lote
  const loteMatch = endereco.match(/LT[:\s]*([^\s]+)/i);
  if (loteMatch) resultado.lote = loteMatch[1].trim();

  // Extrair Edifício
  const edificioMatch = endereco.match(/ED\s+(.+?)(?:\s+BOX|\s*$)/i);
  if (edificioMatch) resultado.nomeEdificio = edificioMatch[1].trim();

  // Extrair Apartamento e Bloco (formato: APTO806BL.B ou APT 806 BL B)
  const aptoMatch = endereco.match(/APT[O]?\s*(\d+)\s*(?:BL[.\s]*([A-Z0-9]+))?/i);
  if (aptoMatch) {
    resultado.apartamento = aptoMatch[1];
    if (aptoMatch[2]) resultado.bloco = aptoMatch[2];
    resultado.unidade = `APTO ${aptoMatch[1]}${aptoMatch[2] ? ' BL.' + aptoMatch[2] : ''}`;
  }

  // Extrair Logradouro (antes de APTO ou QD)
  const logradouroMatch = endereco.match(/^([A-Z\s]+(?:S\/N)?)\s*(?:APTO|APT|QD)/i);
  if (logradouroMatch) resultado.logradouro = logradouroMatch[1].trim();

  // Extrair Número do logradouro (se não for S/N)
  const numeroMatch = endereco.match(/([A-Z\s]+)\s+(\d+)\s+(?:APTO|APT|QD)/i);
  if (numeroMatch) {
    resultado.logradouro = numeroMatch[1].trim();
    resultado.numero = numeroMatch[2];
  }

  return resultado;
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
        responseType: 'arraybuffer', // Importante para decodificar corretamente se for ISO-8859-1
        timeout: 15000 // Timeout de 15 segundos para evitar hang
      });

      // Decodificar resposta (assumindo UTF-8 ou Latin1, vamos tentar converter para string)
      const html = response.data.toString('latin1'); // Sites antigos de governo costumam ser latin1

      // Parsers Regex para extrair dados da tabela HTML
      const nomeMatch = html.match(/NOME<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const cpfMatch = html.match(/CPF\/CNPJ<\/td>\s*<td[^>]*>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
      const enderecoMatch = html.match(/ENDEREÇO<\/td>\s*<td>:<\/td>\s*<td>([\s\S]*?)<\/td>/i);

      if (nomeMatch && nomeMatch[1]) {
        const nome = nomeMatch[1].trim();
        let cpf = cpfMatch ? cpfMatch[1].trim() : undefined;

        // Limpar mensagens de erro comuns no campo CPF
        if (cpf && (
          cpf.includes('DESATUALIZADO') ||
          cpf.includes('ENCAMINHAR') ||
          cpf.includes('SECRETARIA MUNICIPAL') ||
          cpf.length > 20 // CPFs/CNPJs reais não são tão longos
        )) {
          console.log(`[Scraper] CPF/CNPJ inválido/mensagem detectada: "${cpf}". Ignorando documento.`);
          cpf = undefined;
        }
        // Limpar HTML do endereço (br tags)
        const enderecoRaw = enderecoMatch ? enderecoMatch[1] : '';
        const endereco = enderecoRaw.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim();

        // Extrair tipo de imóvel (PREDIAL, TERRITORIAL)
        const tipoMatch = html.match(/TIPO<\/td>\s*<td>:<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
        const tipoImovel = tipoMatch ? tipoMatch[1].trim() : undefined;

        // Parsear endereço para extrair campos separados
        const dadosParsed = parsearEnderecoPrefeitura(endereco);

        console.log(`[Scraper] ✅ Dados extraídos para IPTU ${nrinscr}:`);
        console.log(`  → Nome: ${nome}`);
        console.log(`  → CPF: ${cpf}`);
        console.log(`  → Apto: ${dadosParsed.apartamento || 'N/A'} | Bloco: ${dadosParsed.bloco || 'N/A'} | Box: ${dadosParsed.box || 'N/A'}`);

        return {
          nrinscr,
          nome,
          cpf,
          endereco_correspondencia: endereco,
          tipoImovel,
          ...dadosParsed,
          origem: 'SCRAPER_WEB'
        };
      }

      throw new Error("Dados não encontrados no HTML retornado");

    } catch (error) {
      console.error(`[Scraper] Erro na busca direta IPTU ${nrinscr}:`, error);
      // Fallback para Mock DESATIVADO a pedido do usuário
      // return this.gerarDadosRealistas(nrinscr);
      throw error;
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
    const cpf = `${cpfNum.slice(0, 3)}.${cpfNum.slice(3, 6)}.${cpfNum.slice(6, 9)}-${cpfNum.slice(9, 11)}`;

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
