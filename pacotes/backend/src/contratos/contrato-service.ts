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
 * Gera contrato de captação para um lead
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
        const baseUrl = process.env.FRONTEND_URL || 'https://elyon.quadradois.com.br';
        const linkAceite = `${baseUrl}/aceitar-contrato/${contratoExistente.tokenAceite}`;

        return {
            id: contratoExistente.id,
            html: contratoExistente.htmlConteudo,
            hash: contratoExistente.hashDocumento,
            linkAceite: linkAceite
        };
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
    const baseUrl = process.env.FRONTEND_URL || 'https://elyon.quadradois.com.br';
    const linkAceite = `${baseUrl}/aceitar-contrato/${tokenAceite}`;

    // Extrair perfil de venda do tenant para defaults
    const perfilVenda = lead.tenant?.perfilVenda as any || {};
    const comissaoPadrao = perfilVenda.comissaoPadrao || '6%';
    const prazoPadrao = perfilVenda.prazoContrato ? Number(perfilVenda.prazoContrato) : 90;

    // 5. Preparar variáveis do template
    const variaveis = {
        // Imobiliária (Tenant)
        nomeImobiliaria: lead.tenant?.nome || 'Imobiliária',
        cnpjImobiliaria: lead.tenant?.cnpj || '',
        enderecoImobiliaria: lead.tenant?.endereco ? `${lead.tenant.endereco} - ${lead.tenant.cidade || ''}` : '',
        telefoneImobiliaria: lead.tenant?.telefone || lead.tenant?.whatsapp || '',
        siteImobiliaria: lead.tenant?.site || '',
        logoImobiliaria: lead.tenant?.logoUrl || '',

        // Proprietário
        nomeProprietario: lead.nome || 'Nome não informado',
        cpf: formatarCPF(lead.cpf),
        telefone: formatarTelefone(lead.telefone),
        email: lead.email || 'Não informado',

        // Imóvel
        enderecoImovel: lead.enderecoImovel || 'Endereço não informado',
        tipoImovel: lead.tipoImovel || 'Não especificado',
        areaImovel: lead.areaImovel || '---',

        // Condições comerciais
        comissao: lead.comissaoAcordada || comissaoPadrao,
        prazoTrabalho: lead.prazoTrabalho || prazoPadrao,
        tipoAutorizacao: lead.tipoAutorizacao || 'simples',
        tipoAutorizacaoTexto: lead.tipoAutorizacao === 'exclusiva'
            ? 'EXCLUSIVA'
            : 'SIMPLES (outras imobiliárias também podem comercializar)',

        // Cláusula de exclusividade
        clausulaExclusividade: lead.tipoAutorizacao === 'exclusiva'
            ? 'Trata-se de AUTORIZAÇÃO EXCLUSIVA, ficando o PROPRIETÁRIO impedido de comercializar o imóvel diretamente ou por intermédio de terceiros durante a vigência deste contrato, sob pena de pagamento da comissão integral acordada.'
            : 'Trata-se de AUTORIZAÇÃO SIMPLES, podendo o PROPRIETÁRIO comercializar o imóvel por conta própria ou por intermédio de outras imobiliárias, sendo a comissão devida apenas em caso de negócio realizado por esta IMOBILIÁRIA.',

        // Status e datas
        aceito: false,
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
            titulo: '📄 Contrato de captação gerado',
            descricao: `Contrato gerado e aguardando aceite digital.\nLink: ${linkAceite}`,
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
            ultimaAcaoIA: 'Contrato de captação gerado',
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
        return { success: false, message: 'Contrato não encontrado' };
    }

    if (contrato.status === 'ACEITO') {
        return { success: false, message: 'Este contrato já foi aceito anteriormente' };
    }

    if (contrato.status === 'CANCELADO') {
        return { success: false, message: 'Este contrato foi cancelado' };
    }

    // 2. Calcular vigência
    const prazoTrabalho = contrato.lead?.prazoTrabalho || 90;
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
            ultimaAcaoIA: 'Contrato aceito digitalmente',
            ultimaAcaoIAEm: new Date()
        }
    });

    // 5. Registrar atividade de sucesso
    await db.atividade.create({
        data: {
            leadId: contrato.leadId,
            tipo: 'NOTA',
            titulo: '🎉 Contrato aceito digitalmente!',
            descricao: `O proprietário aceitou o contrato de captação.\n\nIP: ${dados.ip}\nVigência: ${vigenciaInicio.toLocaleDateString('pt-BR')} a ${vigenciaFim.toLocaleDateString('pt-BR')}`,
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
            descricao: 'Concluído automaticamente após aceite digital do contrato.'
        }
    });

    console.log(`[CONTRATO] Aceito! Lead ${contrato.leadId} agora é CAPTADO`);

    return {
        success: true,
        message: 'Contrato aceito com sucesso! Bem-vindo à nossa carteira de imóveis.'
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
