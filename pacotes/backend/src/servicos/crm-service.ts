/**
 * CRM Integration Service
 * 
 * Envia leads captados + dados do imóvel para o CRM
 * Usa configuração por tenant (criptografada)
 * 
 * @version 2.0
 * @date 22/12/2025
 */

import { prisma } from '../lib/db';
import { descriptografar } from '../lib/crypto';
import { Lead, TipoIntegracao } from '@prisma/client';

interface CrmResponse {
    success: boolean;
    proprietario_id?: number;
    property_id?: number;
    property_code?: string;
    status?: string;
    message?: string;
    error?: string;
    already_imported?: boolean;
}

interface ProprietarioData {
    nome: string;
    cpf?: string | null;
    rg?: string | null;
    telefone?: string | null;
    telefone2?: string | null;
    email?: string | null;
    whatsapp?: string | null;
    cep?: string | null;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
}

interface ImovelData {
    tipo: string;
    tipo_negocio: string;
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cep?: string | null;
    quartos?: number | null;
    suites?: number | null;
    banheiros?: number | null;
    vagas?: number | null;
    area_util?: number | null;
    area_total?: number | null;
    andar?: number | null;
    valor_venda?: number | null;
    valor_locacao?: number | null;
    valor_condominio?: number | null;
    valor_iptu?: number | null;
    caracteristicas?: string[];
    descricao?: string | null;
    fotos?: string[];
}

interface ContratoData {
    tipo: string;
    comissao?: string | null;
    vigencia_inicio?: string | null;
    vigencia_fim?: string | null;
}

interface OrigemData {
    elyon_lead_id: string;
    elyon_tenant_id: string;
    campanha_id?: string | null;
}

interface IntegracaoConfig {
    apiUrl: string;
    apiKey: string;
    tenantIdDestino: number | null;
}

/**
 * Busca configuração de integração CRM do tenant
 */
async function getConfigCrm(tenantId: string): Promise<IntegracaoConfig | null> {
    const config = await prisma.configuracaoIntegracao.findUnique({
        where: {
            tenantId_tipo: {
                tenantId,
                tipo: TipoIntegracao.CRM_QUADRADOIS
            }
        }
    });

    if (!config || !config.ativo) {
        return null;
    }

    try {
        const apiKey = descriptografar(config.apiKeyCriptografada);
        return {
            apiUrl: config.apiUrl,
            apiKey,
            tenantIdDestino: config.tenantIdDestino
        };
    } catch (error) {
        console.error(`[CRM] Erro ao descriptografar API Key do tenant ${tenantId}:`, error);
        return null;
    }
}

/**
 * Mapeia tipo de imóvel do Elyon para CRM
 */
function mapTipoImovel(tipo: string | null): string {
    const mapping: Record<string, string> = {
        'apartamento': 'apartamento',
        'casa': 'casa',
        'comercial': 'comercial',
        'terreno': 'terreno',
        'flat': 'flat',
        'studio': 'studio',
        'kitnet': 'studio',
        'sala': 'comercial',
        'galpao': 'comercial',
        'loja': 'comercial',
    };
    return mapping[(tipo || '').toLowerCase()] || 'apartamento';
}

/**
 * Extrai cidade e estado do endereço se não estiver separado
 */
function parseEndereco(endereco: string | null): { cidade?: string; estado?: string; bairro?: string } {
    if (!endereco) return {};

    const match = endereco.match(/,?\s*([^,]+)\s*[-\/]\s*([A-Z]{2})$/i);
    if (match) {
        return {
            cidade: match[1].trim(),
            estado: match[2].toUpperCase()
        };
    }
    return {};
}

/**
 * Converte valor monetário string para número
 */
function parseValor(valor: string | null): number | null {
    if (!valor) return null;

    const cleaned = valor
        .replace(/R\$\s*/gi, '')
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '');

    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

/**
 * Monta o payload para enviar ao CRM
 */
function buildCrmPayload(lead: Lead, tenantId: string): {
    proprietario: ProprietarioData;
    imovel: ImovelData;
    contrato: ContratoData;
    origem: OrigemData;
} {
    const enderecoParseado = parseEndereco(lead.enderecoImovel);

    return {
        proprietario: {
            nome: lead.nome,
            cpf: lead.cpf,
            telefone: lead.telefone,
            email: lead.email,
            whatsapp: lead.telefone,
        },
        imovel: {
            tipo: mapTipoImovel(lead.tipoImovel),
            tipo_negocio: lead.interesseEm || 'venda',
            logradouro: lead.enderecoImovel?.split(',')[0] || null,
            bairro: enderecoParseado.bairro || null,
            cidade: enderecoParseado.cidade || null,
            estado: enderecoParseado.estado || null,
            quartos: lead.quartosImovel,
            suites: lead.imovelSuites,
            banheiros: lead.imovelBanheiros,
            vagas: lead.vagasImovel,
            area_util: lead.imovelAreaTotal || (lead.areaImovel ? parseFloat(lead.areaImovel.replace(/[^\d.]/g, '')) : null),
            andar: lead.imovelAndar,
            valor_venda: lead.interesseEm?.includes('vend') ? parseValor(lead.valorPretendido) : null,
            valor_locacao: lead.imovelValorLocacao,
            valor_condominio: lead.imovelValorCondominio,
            valor_iptu: lead.imovelValorIPTU,
            caracteristicas: lead.imovelCaracteristicas || [],
            descricao: lead.imovelDescricao,
            fotos: lead.imovelFotos || [],
        },
        contrato: {
            tipo: lead.tipoAutorizacao || 'simples',
            comissao: lead.comissaoAcordada,
            vigencia_inicio: lead.vigenciaInicio?.toISOString().split('T')[0],
            vigencia_fim: lead.vigenciaFim?.toISOString().split('T')[0],
        },
        origem: {
            elyon_lead_id: lead.id,
            elyon_tenant_id: tenantId,
            campanha_id: lead.campanhaOrigemId,
        }
    };
}

async function aguardar(ms: number): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableStatus(status: number): boolean {
    return status === 408 || status === 429 || status >= 500;
}

// Backoff exponencial: tentativa 1→2s, 2→8s, 3→30s
const BACKOFF_MS = [2000, 8000, 30000];

async function enviarComRetry(url: string, options: RequestInit, tentativasMax: number = 3): Promise<Response> {
    let ultimaResposta: Response | null = null;
    for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
        const resposta = await fetch(url, options);
        ultimaResposta = resposta;
        if (!isRetryableStatus(resposta.status) || tentativa === tentativasMax) {
            return resposta;
        }
        const esperaMs = BACKOFF_MS[tentativa - 1] ?? 30000;
        console.info(`[OBS] crm_sync_retry tentativa=${tentativa} status=${resposta.status} aguardando=${esperaMs}ms`);
        await aguardar(esperaMs);
    }

    if (ultimaResposta) return ultimaResposta;
    throw new Error('Falha ao enviar para CRM após retentativas');
}

/**
 * Atualiza estatísticas de envio
 */
async function atualizarEstatisticas(tenantId: string, sucesso: boolean, erro?: string) {
    await prisma.configuracaoIntegracao.update({
        where: {
            tenantId_tipo: {
                tenantId,
                tipo: TipoIntegracao.CRM_QUADRADOIS
            }
        },
        data: {
            totalEnvios: { increment: 1 },
            totalSucessos: sucesso ? { increment: 1 } : undefined,
            totalFalhas: !sucesso ? { increment: 1 } : undefined,
            ultimoEnvioEm: new Date(),
            ultimoErro: sucesso ? null : erro
        }
    });
}

/**
 * Envia lead captado para o CRM
 */
export async function enviarParaCrm(leadId: string): Promise<CrmResponse> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId },
        include: { tenant: true }
    });

    if (!lead) {
        throw new Error(`Lead ${leadId} não encontrado`);
    }

    // Buscar configuração do tenant
    const config = await getConfigCrm(lead.tenantId);

    if (!config) {
        return {
            success: false,
            error: 'Integração CRM não configurada para este tenant. Configure em Configurações > Integrações.'
        };
    }

    // Verifica se já foi enviado
    if (lead.crmPropertyId && lead.crmSyncStatus === 'synced') {
        return {
            success: true,
            already_imported: true,
            proprietario_id: lead.crmProprietarioId || undefined,
            property_id: lead.crmPropertyId,
            property_code: lead.crmPropertyCode || undefined,
            message: 'Lead já foi enviado ao CRM anteriormente'
        };
    }

    // Marca como pendente
    await prisma.lead.update({
        where: { id: leadId },
        data: {
            crmSyncStatus: 'pending',
            enviadoParaCrmEm: new Date()
        }
    });

    try {
        const payload = buildCrmPayload(lead, lead.tenantId);
        if (!payload.imovel.cidade || !payload.imovel.estado) {
            console.warn(`[CRM] crm_missing_location lead=${leadId} endereco="${lead.enderecoImovel || ''}"`);
        }

        console.log(`[CRM] Enviando lead ${leadId} para ${config.apiUrl}...`);

        const response = await enviarComRetry(`${config.apiUrl}/leads/from-elyon`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`,
                'X-Tenant-Id': config.tenantIdDestino?.toString() || '1',
            },
            body: JSON.stringify(payload)
        });

        const data: CrmResponse = await response.json();

        if (data.success) {
            // Atualiza lead com IDs do CRM
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    crmProprietarioId: data.proprietario_id,
                    crmPropertyId: data.property_id,
                    crmPropertyCode: data.property_code,
                    crmSyncStatus: 'synced',
                    crmSyncError: null
                }
            });

            await atualizarEstatisticas(lead.tenantId, true);
            console.log(`[CRM] ✅ Lead ${leadId} enviado! PropertyCode: ${data.property_code}`);
        } else {
            await prisma.lead.update({
                where: { id: leadId },
                data: {
                    crmSyncStatus: 'error',
                    crmSyncError: data.error || 'Erro desconhecido'
                }
            });

            await atualizarEstatisticas(lead.tenantId, false, data.error);
            console.error(`[CRM] ❌ Falha ao enviar lead ${leadId}:`, data.error);
        }

        return data;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erro de conexão';

        await prisma.lead.update({
            where: { id: leadId },
            data: {
                crmSyncStatus: 'error',
                crmSyncError: errorMessage
            }
        });

        await atualizarEstatisticas(lead.tenantId, false, errorMessage);
        console.error(`[CRM] ❌ Exceção ao enviar lead ${leadId}:`, error);

        return {
            success: false,
            error: errorMessage
        };
    }
}

/**
 * Verifica status de sincronização no CRM
 */
export async function verificarStatusCrm(leadId: string): Promise<CrmResponse> {
    const lead = await prisma.lead.findUnique({
        where: { id: leadId }
    });

    if (!lead) {
        throw new Error(`Lead ${leadId} não encontrado`);
    }

    if (!lead.crmPropertyId) {
        return {
            success: false,
            error: 'Lead ainda não foi enviado ao CRM'
        };
    }

    const config = await getConfigCrm(lead.tenantId);
    if (!config) {
        return { success: false, error: 'Integração CRM não configurada' };
    }

    try {
        const response = await fetch(`${config.apiUrl}/leads/from-elyon/${leadId}`, {
            headers: {
                'Authorization': `Bearer ${config.apiKey}`,
            }
        });

        return await response.json();

    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Erro ao verificar status'
        };
    }
}

/**
 * Reenviar lead que falhou
 */
export async function reenviarParaCrm(leadId: string): Promise<CrmResponse> {
    await prisma.lead.update({
        where: { id: leadId },
        data: {
            crmSyncStatus: null,
            crmSyncError: null,
            crmPropertyId: null,
            crmProprietarioId: null,
            crmPropertyCode: null
        }
    });

    return enviarParaCrm(leadId);
}

export default {
    enviarParaCrm,
    verificarStatusCrm,
    reenviarParaCrm
};

export const __testables = {
    parseEndereco,
    buildCrmPayload,
    isRetryableStatus,
    enviarComRetry,
};
