// Tipos compartilhados do Wizard

// Tipo único de SDR: Captação (foca em adquirir imóveis para venda OU locação)
export type TipoAgente = 'SDR_CAPTACAO' | 'PERSONALIZADO';
export type ModoCreacao = 'PRE_TREINADO' | 'PERSONALIZADO';
export type StatusAgente = 'RASCUNHO' | 'ATIVO' | 'PAUSADO';

// Etapas do wizard - Modo Rápido e Avançado
export type EtapaRapida = 'modo' | 'identidade' | 'personalidade' | 'perfil' | 'termos' | 'revisar';
export type EtapaAvancada = 'modo' | 'identidade' | 'objetivo' | 'prompt' | 'ferramentas' | 'personalidade' | 'termos' | 'revisar';
export type Etapa = 'modo' | 'identidade' | 'objetivo' | 'prompt' | 'ferramentas' | 'personalidade' | 'perfil' | 'termos' | 'revisar';

// ====================================
// QUIZ: PERFIL DA IMOBILIÁRIA
// ====================================

// Tipos de garantia aceitos para locação
export type TipoGarantia = 'FIADOR' | 'SEGURO_FIANCA' | 'TITULO_CAPITALIZACAO' | 'CAUCAO' | 'CARTAO_CREDITO';

// Perfil de Locação - dados coletados no quiz
export interface PerfilLocacao {
  garantiasAceitas: TipoGarantia[];
  taxaAdministracao: number; // Percentual (ex: 10 = 10%)
  taxaPrimeiroAluguel: boolean;
  prazoMinimoContrato: number; // Meses
  aceitaPet: boolean;
  fazVistoriaEntrada: boolean;
  fazVistoriaSaida: boolean;
  tempoMedioContrato: number; // Meses típicos de contrato
  observacoesLocacao?: string;
}

// Perfil de Venda - dados coletados no quiz
export interface PerfilVenda {
  comissaoPadrao: number; // Percentual (ex: 6 = 6%)
  aceitaExclusividade: boolean;
  tempoExclusividade?: number; // Dias de exclusividade
  fazAvaliacaoGratuita: boolean;
  fazFotoProfissional: boolean;
  fazTourVirtual: boolean;
  anunciaPortais: string[]; // Lista de portais (ZAP, Viva Real, OLX, etc)
  temParcerias: boolean;
  percentualParceria?: number; // % para parceria com outras imobiliárias
  observacoesVenda?: string;
}

// Dados gerais da imobiliária
export interface DadosImobiliaria {
  nomeImobiliaria: string;
  diferenciais: string[]; // Diferenciais competitivos
  tempoMercado?: number; // Anos no mercado
  atendeFinalDeSemana: boolean;
  horarioAtendimento?: string;
  // Serviços oferecidos
  trabalhaComLocacao: boolean;
  trabalhaComVenda: boolean;
  // Informações de contato
  endereco?: string;
  cidade?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  instagram?: string;
  facebook?: string;
}

// Perfil completo da imobiliária
export interface PerfilImobiliaria {
  dadosGerais: DadosImobiliaria;
  locacao: PerfilLocacao;
  venda: PerfilVenda;
  // RAG sintetizado (gerado automaticamente)
  ragSintetizado?: string;
  sintetizadoEm?: string;
}

// Tool customizada para modo avançado
export interface ToolCustomizada {
  nome: string;
  descricao: string;
  acao: 'consultar_api' | 'buscar_imovel' | 'agendar_visita' | 'calcular_financiamento' | 'custom';
  parametros?: Record<string, unknown>;
}

export interface DadosAgente {
  nome: string;
  avatar: string | null;
  tipoAgente: TipoAgente;
  modoCreacao: ModoCreacao;
  personalidade: {
    tom: 'formal' | 'amigavel' | 'entusiasta';
    usarEmojis: boolean;
    nivelFormalidade: number;
  };
  expertise: {
    bairros: string[];
    tiposImovel: string[];
  };
  scripts: {
    saudacao: string;
    despedida: string;
  };
  // Perfil da Imobiliária (Quiz)
  perfilImobiliaria?: PerfilImobiliaria;
  // Documentos para RAG (arquivos pendentes de envio)
  documentosPendentes?: File[];
  // Campos do Modo Avançado
  objetivo?: string;
  contexto?: string;
  promptCustomizado?: string;
  toolsCustomizadas?: ToolCustomizada[];
  restricoes?: string[];
  // Status e termos
  termosAceitos?: boolean;
  status?: StatusAgente;
}

export interface WizardEtapaProps {
  dados: DadosAgente;
  setDados: React.Dispatch<React.SetStateAction<DadosAgente>>;
}

// Informações do template único de Captação
export const TEMPLATE_CAPTACAO = {
  id: 'SDR_CAPTACAO' as TipoAgente,
  nome: 'SDR de Captação',
  emoji: '🎯',
  cor: 'purple',
  descricao: 'Especializado em captar imóveis para venda ou locação',
  habilidades: [
    'Identificar proprietários interessados',
    'Coletar dados completos do imóvel',
    'Perguntar: venda ou locação?',
    'Qualificar conforme perfil da imobiliária',
    'Agendar avaliação ou visita',
    'Suporte documental automático',
  ],
  badge: 'Recomendado',
};

// Nota: O suporte documental é automático - Elyon Core roteia quando necessário

// Avatares disponíveis
export const AVATARES = [
  { id: 'sofia', emoji: '👩', nome: 'Sofia' },
  { id: 'pedro', emoji: '👨', nome: 'Pedro' },
  { id: 'ana', emoji: '👩‍💼', nome: 'Ana' },
  { id: 'carlos', emoji: '👨‍💼', nome: 'Carlos' },
  { id: 'bot', emoji: '🤖', nome: 'Bot' },
  { id: 'empresa', emoji: '🏢', nome: 'Corporativo' },
];

// Tipos de imóvel sugeridos
export const TIPOS_IMOVEL = [
  'Apartamentos', 'Casas', 'Casas de Condomínio', 'Lotes', 
  'Comerciais', 'Rurais', 'Studios', 'Cobertura'
];

// ====================================
// OPÇÕES DO QUIZ
// ====================================

// Tipos de garantia com labels amigáveis
export const GARANTIAS_OPCOES: { value: TipoGarantia; label: string; descricao: string }[] = [
  { value: 'FIADOR', label: 'Fiador', descricao: 'Pessoa física com imóvel quitado como garantia' },
  { value: 'SEGURO_FIANCA', label: 'Seguro Fiança', descricao: 'Seguro contratado em seguradora parceira' },
  { value: 'TITULO_CAPITALIZACAO', label: 'Título de Capitalização', descricao: 'Valor depositado que rende juros' },
  { value: 'CAUCAO', label: 'Caução', descricao: 'Depósito de 1-3 aluguéis antecipados' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito', descricao: 'Garantia via limite do cartão' },
];

// Portais imobiliários populares
export const PORTAIS_OPCOES = [
  'ZAP Imóveis',
  'Viva Real',
  'OLX',
  'Imovelweb',
  'Chaves na Mão',
  'QuintoAndar',
  'Loft',
  '62imóveis', // Portal regional de Goiânia
  'Facebook Marketplace',
  'Instagram',
  'Site Próprio',
];

// Diferenciais comuns
export const DIFERENCIAIS_OPCOES = [
  'Atendimento 24h',
  'Suporte jurídico incluso',
  'Fotos profissionais grátis',
  'Tour virtual 360°',
  'Avaliação gratuita',
  'Parceria com cartórios',
  'Time de corretores especializados',
  'Sistema de gestão moderno',
  'Rapidez na documentação',
  'Acompanhamento pós-venda',
];

// Valores padrão para o perfil
export const PERFIL_PADRAO: PerfilImobiliaria = {
  dadosGerais: {
    nomeImobiliaria: '',
    diferenciais: [],
    atendeFinalDeSemana: false,
    horarioAtendimento: '08:00 às 18:00',
    trabalhaComLocacao: true,
    trabalhaComVenda: true,
    // Informações de contato
    endereco: '',
    cidade: 'Goiânia - GO',
    telefone: '',
    whatsapp: '',
    email: '',
    site: '',
    instagram: '',
    facebook: '',
  },
  locacao: {
    garantiasAceitas: ['FIADOR', 'SEGURO_FIANCA'],
    taxaAdministracao: 10,
    taxaPrimeiroAluguel: true,
    prazoMinimoContrato: 12,
    aceitaPet: true,
    fazVistoriaEntrada: true,
    fazVistoriaSaida: true,
    tempoMedioContrato: 30,
  },
  venda: {
    comissaoPadrao: 6,
    aceitaExclusividade: true,
    tempoExclusividade: 90,
    fazAvaliacaoGratuita: true,
    fazFotoProfissional: true,
    fazTourVirtual: false,
    anunciaPortais: ['ZAP Imóveis', 'Viva Real'],
    temParcerias: true,
    percentualParceria: 50,
  },
};
