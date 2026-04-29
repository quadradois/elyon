/**
 * Tipos para a página de Detalhes do Lead
 */

export interface Lead {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    cpf: string | null;
    enderecoPrincipal?: string | null;
    complementoPrincipal?: string | null;
    status: string;
    temperatura: string;
    origem: string | null;
    primeiroContato: string | null;
    ultimaInteracao: string | null;
    criadoEm: string;
    atualizadoEm: string;

    // ── Scores unificados (calculados pelo backend) ──
    scoreQualificacao?: number | null;  // completude do lead (0-100)
    scoreUrgencia?: number | null;      // urgência operacional (0-100)
    scoreComposto?: number | null;      // métrica única = qualif×0.4 + urgência×0.6
    motivosUrgencia?: string[] | null;  // razões detalhadas da urgência (top-3)
    orientacaoAcao?: string | null;     // instrução contextual gerada pela IA

    // Campanha de origem
    campanhaOrigem: {
        id: string;
        nome: string;
    } | null;

    // Dados do Imóvel
    imovel: {
        endereco: string | null;
        tipo: string | null;
        area: number | null;
        quartos: number | null;
        vagas: number | null;
        valorPretendido: number | null;
        ocupacao: string | null;
        interesseEm: string | null;
    };

    // Dados de Empresa (CNPJ)
    empresaAtual?: string | null;
    cnpjEmpresa?: string | null;
    profissao?: string | null;
    setor?: string | null;
    participacoesEmpresas?: {
        cnpj: string;
        razaoSocial: string;
        participacao: string;
    }[];

    // Qualificação SPIN
    spin: {
        situacao: {
            situacaoAtual: string | null;
            tempoDecisao: string | null;
            tentativasAnteriores: string | null;
            comCorretorAtualmente: boolean | null;
        };
        problema: {
            motivacaoVenda: string | null;
            doresIdentificadas: string[];
        };
        implicacao: {
            prazoDesejado: string | null;
            urgencia: string | null;
            consequencias: string | null;
            custosAtuais: string | null;
            pressaoTempo: string | null;
        };
        necessidade: {
            expectativaServico: string | null;
            objecoes: string[];
            interesseAvaliacao: boolean | null;
        };
        observacoes: string | null;
    };

    // ====================================
    // NOVOS CAMPOS - PLAYBOOK CAPTAÇÃO
    // ====================================

    // Qualificação Adicional (Fase 2)
    situacaoFinanceira?: string | null;   // "quitado", "financiado"
    temDividas?: boolean | null;          // Tem dívidas IPTU/Cond?
    estadoConservacao?: string | null;    // "reforma", "bom", "excelente"

    // Negociação Comercial (Fase 3)
    comissaoAcordada?: string | null;     // "6%", "5% com exclusividade"
    tipoAutorizacao?: string | null;      // "exclusiva", "simples"
    prazoTrabalho?: number | null;        // Dias (ex: 90)
    autorizouAnuncio?: boolean | null;    // Confirmou anúncio?

    // Contrato (Fase 4)
    contratoUrl?: string | null;          // URL do PDF assinado
    dataAssinatura?: string | null;       // ISO Date
    vigenciaInicio?: string | null;       // ISO Date
    vigenciaFim?: string | null;          // ISO Date

    // Tracking IA
    ultimaAcaoIA?: string | null;         // "Enviou follow-up"
    ultimaAcaoIAEm?: string | null;       // ISO Date

    // Perda
    motivoPerda?: string | null;          // "Expectativa Irreal", etc.

    // Dados Pessoais (Assertiva — migrados do Contato)
    idade?: number | null;
    sexo?: string | null;
    rendaEstimada?: string | null;
    faixaSalarial?: string | null;
    scoreAssertiva?: number | null;

    // Múltiplos Contatos
    telefone2?: string | null;
    telefone3?: string | null;
    email2?: string | null;

    // Imóvel Assertiva
    bairroImovel?: string | null;
    nomeEdificio?: string | null;
    inscricaoIptu?: string | null;
    valorVenal?: string | null;

    // Briefing IA (Dossiê do Closer)
    briefingCloser?: string | null;

    // Dados avançados do imóvel (onboarding/admin)
    imovelDetalhes?: {
        suites?: number | null;
        banheiros?: number | null;
        areaTotal?: number | null;
        andar?: number | null;
        caracteristicas?: string[];
        descricao?: string | null;
        fotos?: string[];
        valorLocacao?: number | null;
        valorCondominio?: number | null;
        valorIPTU?: number | null;
        coletadosEm?: string | null;
    };

    // Status de integração CRM para o lead
    crm?: {
        proprietarioId?: number | null;
        propertyId?: number | null;
        propertyCode?: string | null;
        syncStatus?: string | null;
        syncError?: string | null;
        enviadoEm?: string | null;
    };

    // Imóveis relacionados da mineração
    imoveisMineracao?: Array<{
        id: string;
        endereco: string;
        tipo: string | null;
        area: number | null;
        edificio: string | null;
        apartamento: string | null;
        statusCaptacao: string | null;
    }>;

    // Relacionamentos
    atividades: Atividade[];
    conversas: Conversa[];
    proximaAtividade: Atividade | null;
}

export interface Atividade {
    id: string;
    tipo: string;
    titulo: string;
    descricao: string | null;
    agendadoPara: string | null;
    completadoEm: string | null;
    statusAgendamento: string | null;
    criadoEm: string;
}

export interface Conversa {
    id: string;
    canal: string;
    estado: string;
    faseSPIN?: string | null;
    iniciadaEm: string;
    ultimaMensagemEm: string | null;
    mensagens: any[];
}

// Formulários
export interface FormEditar {
    nome?: string;
    telefone?: string;
    email?: string;
    cpf?: string;
    enderecoPrincipal?: string;
    complementoPrincipal?: string;
    temperatura?: string;
    enderecoImovel?: string;
    tipoImovel?: string;
    valorPretendido?: number;
    inscricaoIptu?: string;
    // Novos campos
    situacaoFinanceira?: string;
    temDividas?: boolean;
    estadoConservacao?: string;
    comissaoAcordada?: string;
    tipoAutorizacao?: string;
    prazoTrabalho?: number;
    autorizouAnuncio?: boolean;
}

export interface FormPerdido {
    motivo: string;
    observacoes: string;
}

export interface FormCaptado {
    tipoContrato: string;
    valorContrato: string;
    observacoes: string;
}

export interface FormAtividade {
    tipo: string;
    titulo: string;
    descricao: string;
    agendadoPara: string;
}
