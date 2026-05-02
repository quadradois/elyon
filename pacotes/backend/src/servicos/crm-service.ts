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
    caracteristicas_texto?: string | null;
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

function normalizarApiUrl(apiUrl: string): string {
    return String(apiUrl || '').trim().replace(/\/+$/, '');
}

function montarEndpointCrm(apiUrlBase: string, pathComApi: string): string {
    const base = normalizarApiUrl(apiUrlBase);
    const path = pathComApi.startsWith('/') ? pathComApi : `/${pathComApi}`;
    if (base.endsWith('/api') && path.startsWith('/api/')) {
        return `${base}${path.replace(/^\/api/, '')}`;
    }
    return `${base}${path}`;
}

function validarApiUrlProducao(apiUrl: string): void {
    let url: URL;
    try {
        url = new URL(apiUrl);
    } catch {
        throw new Error('apiUrl inválida. Informe uma URL completa, ex: https://crm.exemplo.com');
    }

    const host = url.hostname.toLowerCase();
    const ehLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    if (process.env.NODE_ENV === 'production' && ehLocalhost) {
        throw new Error('apiUrl inválida para produção: localhost/127.0.0.1 não funciona entre VPS diferentes');
    }
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
        const apiUrl = normalizarApiUrl(config.apiUrl);
        validarApiUrlProducao(apiUrl);
        return {
            apiUrl,
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
        'lote': 'terreno',
        'fazenda': 'fazenda',
        'sitio': 'sitio',
        'sítio': 'sitio',
        'chacara': 'chacara',
        'chácara': 'chacara',
        'flat': 'flat',
        'studio': 'studio',
        'kitnet': 'studio',
        'loft': 'loft',
        'sala': 'sala_comercial',
        'sala comercial': 'sala_comercial',
        'sala_comercial': 'sala_comercial',
        'galpao': 'galpao',
        'galpão': 'galpao',
        'loja': 'loja',
    };
    return mapping[(tipo || '').toLowerCase()] || 'apartamento';
}

function mapTipoNegocio(interesseEm: string | null): string {
    const v = (interesseEm || '').toLowerCase().trim();
    if (!v) return 'venda';
    if (v.includes('amb')) return 'ambos';
    if (v.includes('loc') || v.includes('alugu')) return 'locacao';
    if (v.includes('vend')) return 'venda';
    return 'venda';
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

function parseEnderecoDetalhado(endereco: string | null): {
    logradouro?: string | null;
    numero?: string | null;
    complemento?: string | null;
    bairro?: string | null;
    cidade?: string;
    estado?: string;
    cep?: string | null;
} {
    if (!endereco) return {};
    const partes = endereco.split(',').map(p => p.trim()).filter(Boolean);
    const primeira = partes[0] || null;
    const segunda = partes[1] || null;
    const terceira = partes[2] || null;

    const numeroMatch = segunda?.match(/^(\d+[A-Za-z0-9\-\/]*)/);
    const numero = numeroMatch ? numeroMatch[1] : null;
    const complemento = segunda && numero ? segunda.replace(numero, '').trim() || null : null;

    const cidadeEstado = parseEndereco(endereco);
    const cepMatch = endereco.match(/\b(\d{5}-?\d{3})\b/);

    return {
        logradouro: primeira,
        numero,
        complemento,
        bairro: terceira || cidadeEstado.bairro || null,
        cidade: cidadeEstado.cidade,
        estado: cidadeEstado.estado,
        cep: cepMatch ? cepMatch[1] : null,
    };
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
function toNumberOrNull(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

/**
 * Extrai o número WhatsApp do lead.
 * Prioridade: primeiro número com flag whatsapp=true em telefonesJson → telefone principal.
 */
function extrairWhatsapp(lead: Lead): string | null {
    if (lead.telefonesJson && Array.isArray(lead.telefonesJson)) {
        const comWpp = (lead.telefonesJson as Array<{ numero?: string; whatsapp?: boolean }>)
            .find(t => t.whatsapp === true);
        if (comWpp?.numero) return String(comWpp.numero);
    }
    return lead.telefone || null;
}

function buildCrmPayload(lead: Lead, tenantId: string): {
    proprietario: ProprietarioData;
    imovel: ImovelData;
    contrato: ContratoData;
    origem: OrigemData;
} {
    // Endereço do imóvel: parsing da string + bairro dedicado
    const enderecoImovel = parseEnderecoDetalhado(lead.enderecoImovel);

    // Endereço do proprietário: tenta enderecoPrincipal e enderecoPessoal (Assertiva);
    // usa campos estruturados da Assertiva (cidade/estado/cep) como fallback confiável
    const enderecoProprietario = parseEnderecoDetalhado(lead.enderecoPrincipal || lead.enderecoPessoal);

    const caracteristicasBase = (lead.imovelCaracteristicas && lead.imovelCaracteristicas.length > 0)
        ? lead.imovelCaracteristicas.join(', ')
        : null;
    const detalhesMineracao = [
        lead.quadra ? `Quadra ${lead.quadra}` : null,
        lead.lote ? `Lote ${lead.lote}` : null,
        lead.unidade ? `Unidade ${lead.unidade}` : null,
        lead.bloco ? `Bloco ${lead.bloco}` : null,
        lead.box ? `Box ${lead.box}` : null,
    ].filter(Boolean).join(', ');
    const caracteristicasTexto = [caracteristicasBase, detalhesMineracao].filter(Boolean).join(', ') || null;

    // Áreas: areaConstruida → área útil; imovelAreaTotal → área total registrada
    const areaUtil = toNumberOrNull(lead.areaConstruida)
        || lead.imovelAreaTotal
        || (lead.areaImovel ? parseFloat(lead.areaImovel.replace(/[^\d.]/g, '')) : null);
    const areaTotal = lead.imovelAreaTotal
        || toNumberOrNull(lead.areaConstruida)
        || toNumberOrNull(lead.areaTerreno)
        || (lead.areaImovel ? parseFloat(lead.areaImovel.replace(/[^\d.]/g, '')) : null);

    const valorVenalContato = toNumberOrNull(lead.valorVenal);

    return {
        proprietario: {
            nome: lead.nome,
            cpf: lead.cpf,
            rg: lead.rg,
            telefone: lead.telefone,
            telefone2: lead.telefone2,
            email: lead.email,
            // Extrai número WhatsApp real de telefonesJson; fallback: telefone principal
            whatsapp: extrairWhatsapp(lead),
            // Parsing do endereço livre; campos Assertiva (cidade/estado/cep) como fallback
            cep: enderecoProprietario.cep || lead.cep || null,
            logradouro: enderecoProprietario.logradouro || null,
            numero: enderecoProprietario.numero || null,
            complemento: enderecoProprietario.complemento || null,
            bairro: enderecoProprietario.bairro || null,
            cidade: enderecoProprietario.cidade || lead.cidade || null,
            estado: enderecoProprietario.estado || lead.estado || null,
        },
        imovel: {
            tipo: mapTipoImovel(lead.tipoImovel),
            tipo_negocio: mapTipoNegocio(lead.interesseEm),
            logradouro: enderecoImovel.logradouro || null,
            numero: enderecoImovel.numero || null,
            complemento: enderecoImovel.complemento || null,
            bairro: lead.bairroImovel || enderecoImovel.bairro || null,
            cidade: enderecoImovel.cidade || null,
            estado: enderecoImovel.estado || null,
            cep: enderecoImovel.cep || null,
            quartos: lead.quartosImovel,
            suites: lead.imovelSuites,
            banheiros: lead.imovelBanheiros,
            vagas: lead.vagasImovel,
            area_util: areaUtil,   // área construída/útil
            area_total: areaTotal, // área total cadastrada
            andar: lead.imovelAndar,
            valor_venda: lead.interesseEm?.includes('vend') ? parseValor(lead.valorPretendido) : null,
            valor_locacao: lead.imovelValorLocacao,
            valor_condominio: lead.imovelValorCondominio,
            valor_iptu: lead.imovelValorIPTU || valorVenalContato,
            caracteristicas: lead.imovelCaracteristicas || [],
            caracteristicas_texto: caracteristicasTexto,
            descricao: [
                lead.imovelDescricao,
                lead.nomeEdificio ? `Edifício: ${lead.nomeEdificio}` : null,
                lead.inscricaoIptu ? `IPTU: ${lead.inscricaoIptu}` : null,
            ].filter(Boolean).join('\n') || null,
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

// Backoff exponencial recomendado pelo SOP Quadra Dois: 5s, 15s, 30s
const BACKOFF_MS = [5000, 15000, 30000];

async function enviarComRetry(url: string, options: RequestInit, tentativasMax: number = 3): Promise<Response> {
    let ultimaResposta: Response | null = null;
    let ultimoErro: Error | null = null;
    for (let tentativa = 1; tentativa <= tentativasMax; tentativa++) {
        const timeoutMs = Number(process.env.CRM_REQUEST_TIMEOUT_MS || 30000);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const resposta = await fetch(url, { ...options, signal: controller.signal });
            ultimaResposta = resposta;
            if (!isRetryableStatus(resposta.status) || tentativa === tentativasMax) {
                return resposta;
            }
            const esperaMs = BACKOFF_MS[tentativa - 1] ?? 30000;
            console.info(`[OBS] crm_sync_retry tentativa=${tentativa} status=${resposta.status} aguardando=${esperaMs}ms`);
            await aguardar(esperaMs);
        } catch (error: any) {
            ultimoErro = error instanceof Error ? error : new Error(String(error));
            if (tentativa === tentativasMax) break;
            const esperaMs = BACKOFF_MS[tentativa - 1] ?? 30000;
            console.info(`[OBS] crm_sync_retry tentativa=${tentativa} erro_rede=\"${ultimoErro.message}\" aguardando=${esperaMs}ms`);
            await aguardar(esperaMs);
        } finally {
            clearTimeout(timer);
        }
    }

    if (ultimaResposta) return ultimaResposta;
    throw ultimoErro || new Error('Falha ao enviar para CRM após retentativas');
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

        const response = await enviarComRetry(montarEndpointCrm(config.apiUrl, '/api/leads/from-elyon'), {
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
        const response = await fetch(montarEndpointCrm(config.apiUrl, `/api/leads/from-elyon/${leadId}`), {
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
