/**
 * Serviço de Geração de Contratos
 * Gera PDFs de contratos usando HTML templates
 */

import { prisma } from '../lib/db';
import { templateContratoCaptacao } from './templates/contrato-captacao';
import crypto from 'crypto';

// Tipos
interface DadosContrato {
    leadId: string;
    tenantId: string;
    tipoContrato: 'CAPTACAO' | 'LOCACAO' | 'VENDA';
}

interface ContratoGerado {
    id: string;
    html: string;
    hash: string;
    linkAceite: string;
}

interface DadosAceite {
    contratoId: string;
    ip: string;
    userAgent: string;
}

interface CampoObrigatorioContrato {
    campo: string;
    label: string;
}

export class DadosContratoIncompletosError extends Error {
    faltantes: CampoObrigatorioContrato[];

    constructor(faltantes: CampoObrigatorioContrato[]) {
        super('Dados obrigatórios da autorização estão incompletos');
        this.name = 'DadosContratoIncompletosError';
        this.faltantes = faltantes;
    }
}

// Workaround para tipos do Prisma
const db: any = prisma;

/**
 * Gera um hash único para o contrato
 */
function gerarHashContrato(dados: string): string {
    return crypto.createHash('sha256').update(dados).digest('hex').substring(0, 16);
}

/**
 * Gera um token único para aceite
 */
function gerarTokenAceite(): string {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Formata CPF para exibição
 */
function formatarCPF(cpf: string | null): string {
    if (!cpf) return 'Não informado';
    const numeros = cpf.replace(/\D/g, '');
    if (numeros.length !== 11) return cpf;
    return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata CPF ou CNPJ para exibição
 */
function formatarCpfCnpj(valor: string | null | undefined): string {
    if (!valor) return 'Não informado';
    const numeros = valor.replace(/\D/g, '');

    if (numeros.length === 11) {
        return numeros.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }

    if (numeros.length === 14) {
        return numeros.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }

    return valor;
}

/**
 * Formata telefone para exibição
 */
function formatarTelefone(telefone: string | null): string {
    if (!telefone) return 'Não informado';
    const numeros = telefone.replace(/\D/g, '');
    if (numeros.length === 11) {
        return numeros.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
}

function formatarComissao(valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return '6%';

    if (typeof valor === 'number') {
        return `${valor}%`;
    }

    const texto = String(valor).trim();
    if (!texto) return '6%';
    return texto.includes('%') ? texto : `${texto}%`;
}

function formatarValorImovel(valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return 'A definir';

    if (typeof valor === 'number') {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    const texto = String(valor).trim();
    if (!texto) return 'A definir';
    if (/R\$/i.test(texto)) return texto;

    const normalizado = texto
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '');
    const numero = Number(normalizado);

    if (Number.isFinite(numero) && numero > 0) {
        return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    return texto;
}

function resolverPrazoAutorizacao(lead: any, perfilVenda: any): number {
    const prazoLead = Number(lead?.prazoTrabalho);
    if (Number.isFinite(prazoLead) && prazoLead > 0) return prazoLead;

    const prazoModalidade = Number(perfilVenda?.politicaModalidades?.EXCLUSIVA?.prazoDias);
    if (Number.isFinite(prazoModalidade) && prazoModalidade > 0) return prazoModalidade;

    const tempoExclusividade = Number(perfilVenda?.tempoExclusividade);
    if (Number.isFinite(tempoExclusividade) && tempoExclusividade > 0) return tempoExclusividade;

    const prazoContrato = Number(perfilVenda?.prazoContrato);
    if (Number.isFinite(prazoContrato) && prazoContrato > 0) return prazoContrato;

    return 180;
}

function resolverCreciAutorizado(tenant: any, perfilVenda: any): string {
    return perfilVenda?.creci
        || perfilVenda?.creciResponsavel
        || perfilVenda?.registroCreci
        || tenant?.creci
        || tenant?.creciResponsavel
        || 'Não informado';
}

function montarEnderecoTenant(tenant: any): string {
    const partes = [tenant?.endereco, tenant?.cidade, tenant?.estado].filter(Boolean);
    return partes.length ? partes.join(' - ') : 'Não informado';
}

function montarComplementoImovel(lead: any): string {
    const partes = [
        lead?.complementoImovel,
        lead?.nomeEdificio,
        lead?.bairroImovel
    ].filter(Boolean);

    return partes.length ? partes.join(' - ') : 'Não informado';
}

function extrairPrazoSnapshot(dadosSnapshot: unknown): number | null {
    if (!dadosSnapshot) return null;

    try {
        const snapshot = typeof dadosSnapshot === 'string'
            ? JSON.parse(dadosSnapshot)
            : dadosSnapshot as any;
        const prazo = Number(snapshot?.prazoAutorizacao || snapshot?.prazoTrabalho);
        return Number.isFinite(prazo) && prazo > 0 ? prazo : null;
    } catch {
        return null;
    }
}

function validarCamposObrigatoriosContrato(lead: any): CampoObrigatorioContrato[] {
    const faltantes: CampoObrigatorioContrato[] = [];
    const texto = (valor: unknown) => String(valor ?? '').trim();

    if (!texto(lead?.nome)) faltantes.push({ campo: 'nome', label: 'Nome do proprietário' });
    if (!texto(lead?.cpf)) faltantes.push({ campo: 'cpf', label: 'CPF do proprietário' });
    if (!texto(lead?.email)) faltantes.push({ campo: 'email', label: 'E-mail do proprietário' });
    if (!texto(lead?.enderecoPrincipal)) faltantes.push({ campo: 'enderecoPrincipal', label: 'Endereço do proprietário' });

    if (!texto(lead?.enderecoImovel)) faltantes.push({ campo: 'enderecoImovel', label: 'Endereço do imóvel' });
    if (!texto(lead?.inscricaoIptu)) faltantes.push({ campo: 'inscricaoIptu', label: 'Inscrição IPTU' });

    const valorPretendido = lead?.valorPretendido;
    if (valorPretendido === null || valorPretendido === undefined || texto(valorPretendido) === '') {
        faltantes.push({ campo: 'valorPretendido', label: 'Valor pretendido' });
    }

    if (!texto(lead?.comissaoAcordada)) faltantes.push({ campo: 'comissaoAcordada', label: 'Comissão acordada' });
    const prazo = Number(lead?.prazoTrabalho);
    if (!Number.isFinite(prazo) || prazo <= 0) {
        faltantes.push({ campo: 'prazoTrabalho', label: 'Prazo de trabalho (dias)' });
    }

    return faltantes;
}

/**
 * Substitui variáveis no template
 */
function processarTemplate(template: string, variaveis: Record<string, any>): string {
    let resultado = template;

    // Processar condicionais simples {{#if var}}...{{/if}}
    resultado = resultado.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, content) => {
        return variaveis[varName] ? content : '';
    });

    // Processar {{else}} dentro de {{#if}}
    resultado = resultado.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, varName, ifContent, elseContent) => {
        return variaveis[varName] ? ifContent : elseContent;
    });

    // Substituir variáveis simples {{var}}
    for (const [key, value] of Object.entries(variaveis)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        resultado = resultado.replace(regex, String(value ?? ''));
    }

    return resultado;
}

/**
 * Gera autorização exclusiva de gestão de venda para um lead
 */
export async function gerarContratoCaptacao(dados: DadosContrato): Promise<ContratoGerado> {
    // 1. Buscar dados do lead
    const lead = await db.lead.findUnique({
        where: { id: dados.leadId },
        include: {
            tenant: true
        }
    });

    if (!lead) {
        throw new Error('Lead não encontrado');
    }

    // 2. Verificar se já existe contrato pendente
    const contratoExistente = await db.contrato.findFirst({
        where: {
            leadId: dados.leadId,
            status: { in: ['PENDENTE', 'ENVIADO'] }
        }
    });

    if (contratoExistente) {
        // Idempotência: Se já existe, retorna o link do existente
        const baseUrl = process.env.FRONTEND_URL || 'https://crm.elyon.ia.br';
        const linkAceite = `${baseUrl}/aceitar-contrato/${contratoExistente.tokenAceite}`;

        return {
            id: contratoExistente.id,
            html: contratoExistente.htmlConteudo,
            hash: contratoExistente.hashDocumento,
            linkAceite: linkAceite
        };
    }

    const camposObrigatoriosFaltando = validarCamposObrigatoriosContrato(lead);
    if (camposObrigatoriosFaltando.length > 0) {
        throw new DadosContratoIncompletosError(camposObrigatoriosFaltando);
    }

    // 3. Gerar token e hash
    const tokenAceite = gerarTokenAceite();
    const dataGeracao = new Date();
    const dadosParaHash = JSON.stringify({
        leadId: lead.id,
        nome: lead.nome,
        cpf: lead.cpf,
        endereco: lead.enderecoImovel,
        data: dataGeracao.toISOString()
    });
    const hashContrato = gerarHashContrato(dadosParaHash);

    // 4. Montar URL de aceite
    const baseUrl = process.env.FRONTEND_URL || 'https://crm.elyon.ia.br';
    const linkAceite = `${baseUrl}/aceitar-contrato/${tokenAceite}`;

    // Extrair perfil de venda do tenant para defaults
    const perfilVenda = lead.tenant?.perfilVenda as any || {};
    const comissao = formatarComissao(lead.comissaoAcordada || perfilVenda.comissaoPadrao || 6);
    const prazoAutorizacao = resolverPrazoAutorizacao(lead, perfilVenda);

    // 5. Preparar variáveis do template
    const variaveis = {
        // Dados auxiliares da imobiliária
        nomeImobiliaria: lead.tenant?.nome || 'Imobiliária',
        cnpjImobiliaria: formatarCpfCnpj(lead.tenant?.cnpj),
        enderecoImobiliaria: montarEnderecoTenant(lead.tenant),
        telefoneImobiliaria: lead.tenant?.telefone || lead.tenant?.whatsapp || '',
        siteImobiliaria: lead.tenant?.site || '',
        logoImobiliaria: lead.tenant?.logoUrl || '',

        // Autorizante
        nomeAutorizante: lead.nome || 'Nome não informado',
        cpfCnpjAutorizante: formatarCpfCnpj(lead.cpf),
        enderecoAutorizante: lead.enderecoPrincipal || 'Não informado',
        complementoAutorizante: lead.complementoPrincipal || 'Não informado',
        emailAutorizante: lead.email || 'Não informado',

        // Autorizado
        nomeAutorizado: lead.tenant?.nome || 'Imobiliária',
        cpfCnpjAutorizado: formatarCpfCnpj(lead.tenant?.cnpj),
        creciAutorizado: resolverCreciAutorizado(lead.tenant, perfilVenda),
        emailAutorizado: lead.tenant?.email || 'Não informado',

        // Campos legados mantidos para compatibilidade com telas antigas
        nomeProprietario: lead.nome || 'Nome não informado',
        cpf: formatarCPF(lead.cpf),
        telefone: formatarTelefone(lead.telefone),
        email: lead.email || 'Não informado',

        // Imóvel
        enderecoImovel: lead.enderecoImovel || 'Endereço não informado',
        complementoImovel: montarComplementoImovel(lead),
        iptu: lead.inscricaoIptu || 'Não informado',
        tipoImovel: lead.tipoImovel || 'Não especificado',
        areaImovel: lead.areaImovel || '---',

        // Condições comerciais
        valorImovel: formatarValorImovel(lead.valorPretendido),
        comissao,
        prazoAutorizacao,
        prazoTrabalho: prazoAutorizacao,
        tipoAutorizacao: 'exclusiva',
        tipoAutorizacaoTexto: 'EXCLUSIVA',

        // Status e datas
        aceito: false,
        aguardandoAceite: true,
        statusAceite: '',
        dataContrato: dataGeracao.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }),
        hashContrato: hashContrato,
        linkAceite: linkAceite,

        // QR Code (usando API externa gratuita)
        qrcodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(linkAceite)}`
    };

    // 6. Processar template
    const htmlContrato = processarTemplate(templateContratoCaptacao, variaveis);

    // 7. Salvar contrato no banco
    const contrato = await db.contrato.create({
        data: {
            leadId: lead.id,
            tenantId: dados.tenantId,
            tipo: dados.tipoContrato,
            status: 'PENDENTE',
            tokenAceite: tokenAceite,
            hashDocumento: hashContrato,
            htmlConteudo: htmlContrato,
            dadosSnapshot: JSON.stringify(variaveis),
            geradoEm: dataGeracao,
            vigenciaInicio: null,
            vigenciaFim: null
        }
    });

    // 8. Registrar atividade
    await db.atividade.create({
        data: {
            leadId: lead.id,
            tipo: 'NOTA',
            titulo: 'Autorização exclusiva gerada',
            descricao: `Autorização exclusiva de gestão de venda gerada e aguardando aceite digital.\nLink: ${linkAceite}`,
            criadoPor: 'sistema',
            completadoEm: new Date()
        }
    });

    // 9. Atualizar lead
    await db.lead.update({
        where: { id: lead.id },
        data: {
            status: 'ONBOARDING',
            contratoUrl: linkAceite,
            ultimaAcaoIA: 'Autorização exclusiva de gestão de venda gerada',
            ultimaAcaoIAEm: new Date()
        }
    });

    console.log(`[CONTRATO] Gerado para lead ${lead.id} - Hash: ${hashContrato}`);

    return {
        id: contrato.id,
        html: htmlContrato,
        hash: hashContrato,
        linkAceite: linkAceite
    };
}

/**
 * Registra aceite digital do contrato
 */
export async function registrarAceiteContrato(dados: DadosAceite): Promise<{ success: boolean; message: string }> {
    // 1. Buscar contrato pelo token
    const contrato = await db.contrato.findFirst({
        where: { tokenAceite: dados.contratoId },
        include: { lead: true }
    });

    if (!contrato) {
        return { success: false, message: 'Autorização não encontrada' };
    }

    if (contrato.status === 'ACEITO') {
        return { success: false, message: 'Esta autorização já foi aceita anteriormente' };
    }

    if (contrato.status === 'CANCELADO') {
        return { success: false, message: 'Esta autorização foi cancelada' };
    }

    // 2. Calcular vigência
    const prazoTrabalho = contrato.lead?.prazoTrabalho || extrairPrazoSnapshot(contrato.dadosSnapshot) || 180;
    const vigenciaInicio = new Date();
    const vigenciaFim = new Date();
    vigenciaFim.setDate(vigenciaFim.getDate() + prazoTrabalho);

    // 3. Atualizar contrato
    await db.contrato.update({
        where: { id: contrato.id },
        data: {
            status: 'ACEITO',
            aceiteEm: new Date(),
            aceiteIp: dados.ip,
            aceiteUserAgent: dados.userAgent,
            vigenciaInicio: vigenciaInicio,
            vigenciaFim: vigenciaFim
        }
    });

    // 4. Atualizar lead
    await db.lead.update({
        where: { id: contrato.leadId },
        data: {
            status: 'CAPTADO',
            dataAssinatura: new Date(),
            vigenciaInicio: vigenciaInicio,
            vigenciaFim: vigenciaFim,
            ultimaAcaoIA: 'Autorização aceita digitalmente',
            ultimaAcaoIAEm: new Date()
        }
    });

    // 5. Registrar atividade de sucesso
    await db.atividade.create({
        data: {
            leadId: contrato.leadId,
            tipo: 'NOTA',
            titulo: 'Autorização aceita digitalmente',
            descricao: `O proprietário aceitou a autorização exclusiva de gestão de venda.\n\nIP: ${dados.ip}\nVigência: ${vigenciaInicio.toLocaleDateString('pt-BR')} a ${vigenciaFim.toLocaleDateString('pt-BR')}`,
            criadoPor: 'sistema',
            completadoEm: new Date(),
            statusAgendamento: null // Remove o status PENDENTE padrão
        }
    });

    // 6. Fechar atividades pendentes relacionadas a contrato
    await db.atividade.updateMany({
        where: {
            leadId: contrato.leadId,
            completadoEm: null,
            OR: [
                { titulo: { contains: 'contrato', mode: 'insensitive' } },
                { titulo: { contains: 'assinatura', mode: 'insensitive' } },
                { titulo: { contains: 'documentação', mode: 'insensitive' } }
            ]
        },
        data: {
            completadoEm: new Date(),
            descricao: 'Concluído automaticamente após aceite digital da autorização.'
        }
    });

    console.log(`[CONTRATO] Aceito! Lead ${contrato.leadId} agora é CAPTADO`);

    return {
        success: true,
        message: 'Autorização aceita com sucesso! Bem-vindo à nossa carteira de imóveis.'
    };
}

/**
 * Busca contrato por token para exibição pública
 */
export async function buscarContratoPorToken(token: string): Promise<any> {
    const contrato = await db.contrato.findFirst({
        where: { tokenAceite: token },
        include: {
            lead: {
                select: {
                    nome: true,
                    telefone: true,
                    enderecoImovel: true,
                    tipoImovel: true
                }
            },
            tenant: {
                select: {
                    nome: true
                }
            }
        }
    });

    if (!contrato) {
        return null;
    }

    return {
        id: contrato.id,
        status: contrato.status,
        html: contrato.htmlConteudo,
        hash: contrato.hashDocumento,
        geradoEm: contrato.geradoEm,
        aceiteEm: contrato.aceiteEm,
        nomeImobiliaria: contrato.tenant?.nome,
        nomeProprietario: contrato.lead?.nome,
        enderecoImovel: contrato.lead?.enderecoImovel
    };
}

export default {
    gerarContratoCaptacao,
    registrarAceiteContrato,
    buscarContratoPorToken
};
