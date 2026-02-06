import { prisma } from '../lib/db';
import { normalizarTelefone } from '../utils/telefone';

export class ContatoService {
    /**
     * Verifica se o telefone pertence a um contato de prospecção ativa
     * e retorna os dados do contato e campanha se existir
     */
    async buscarContatoProspeccao(telefone: string) {
        // Normalizar telefone de entrada (remover DDI e formatação)
        const telNormalizado = normalizarTelefone(telefone);

        // Pegar os últimos 8 dígitos
        const ultimosDigitos = telNormalizado.slice(-8);

        // Para lidar com telefones com/sem o nono dígito, vamos buscar também com variação
        let ultimosDigitosVar = '';
        if (telNormalizado.length === 11) {
            // Remove o nono dígito e pega últimos 8
            const semNono = telNormalizado.slice(0, 2) + telNormalizado.slice(3);
            ultimosDigitosVar = semNono.slice(-8);
        } else if (telNormalizado.length === 10) {
            // Adiciona o nono dígito e pega últimos 8
            const comNono = telNormalizado.slice(0, 2) + '9' + telNormalizado.slice(2);
            ultimosDigitosVar = comNono.slice(-8);
        }

        console.log(`[ContatoService] Buscando contato - Tel: ${telNormalizado}, Últimos8: ${ultimosDigitos}, Variação: ${ultimosDigitosVar}`);

        try {
            // Usar query raw para comparar telefones normalizados
            // REGEXP_REPLACE remove caracteres não-numéricos antes de comparar
            const contatos = await prisma.$queryRawUnsafe<any[]>(`
        SELECT c.*, 
               camp.id as "campanha_id", 
               camp.nome as "campanha_nome",
               camp."nomeEmpreendimento" as "campanha_nomeEmpreendimento",
               camp."briefingCompleto" as "campanha_briefingCompleto",
               camp."tenantId" as "campanha_tenantId",
               t.nome as "tenant_nome",
               e.id as "empreendimento_id",
               e.nome as "empreendimento_nome",
               e."briefingCompleto" as "empreendimento_briefingCompleto",
               e."briefingEstruturado" as "empreendimento_briefingEstruturado",
               l.id as "lead_id",
               l.status as "lead_status",
               l."doresIdentificadas" as "lead_doresIdentificadas"
        FROM contatos c
        LEFT JOIN campanhas camp ON c."campanhaId" = camp.id
        LEFT JOIN tenants t ON camp."tenantId" = t.id
        LEFT JOIN empreendimentos_conhecimento e ON camp."empreendimentoId" = e.id
        LEFT JOIN leads l ON c."leadId" = l.id
        WHERE c."statusProspeccao" IN ('CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO')
          AND (
            RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = $1
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = $1
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = $1
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone4, ''), '[^0-9]', '', 'g'), 8) = $1
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone5, ''), '[^0-9]', '', 'g'), 8) = $1
            ${ultimosDigitosVar ? `
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone, ''), '[^0-9]', '', 'g'), 8) = $2
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone2, ''), '[^0-9]', '', 'g'), 8) = $2
            OR RIGHT(REGEXP_REPLACE(COALESCE(c.telefone3, ''), '[^0-9]', '', 'g'), 8) = $2
            ` : ''}
          )
        LIMIT 1
      `, ultimosDigitos, ultimosDigitosVar || ultimosDigitos);

            if (contatos && contatos.length > 0) {
                const c = contatos[0];
                console.log(`[ContatoService] ✅ Contato encontrado: ${c.nome} (${c.telefone}), Lead: ${c.lead_id || 'N/A'}, Status: ${c.lead_status || 'N/A'}`);

                // Montar objeto similar ao retorno do Prisma
                return {
                    ...c,
                    // Lead para os 4 agentes
                    lead: c.lead_id ? {
                        id: c.lead_id,
                        status: c.lead_status,
                        doresIdentificadas: c.lead_doresIdentificadas || []
                    } : null,
                    campanha: c.campanha_id ? {
                        id: c.campanha_id,
                        nome: c.campanha_nome,
                        nomeEmpreendimento: c.campanha_nomeEmpreendimento,
                        briefingCompleto: c.campanha_briefingCompleto,
                        tenantId: c.campanha_tenantId,
                        tenant: c.tenant_nome ? { nome: c.tenant_nome } : null,
                        empreendimento: c.empreendimento_id ? {
                            id: c.empreendimento_id,
                            nome: c.empreendimento_nome,
                            briefingCompleto: c.empreendimento_briefingCompleto,
                            briefingEstruturado: c.empreendimento_briefingEstruturado
                        } : null
                    } : null
                };
            }

            console.log(`[ContatoService] ❌ Contato NÃO encontrado para telefone ${telefone}`);
            return null;

        } catch (error) {
            console.error('[ContatoService] Erro na busca de contato:', error);

            // Fallback para busca simples se SQL raw falhar
            console.log('[ContatoService] Tentando fallback com busca simples...');
            const contato = await prisma.contato.findFirst({
                where: {
                    OR: [
                        { telefone: { contains: ultimosDigitos } },
                        { telefone2: { contains: ultimosDigitos } },
                    ],
                    statusProspeccao: {
                        in: ['CONTATANDO', 'RESPONDEU', 'INTERESSADO', 'LEAD', 'MORNO_FUTURO']
                    }
                },
                include: {
                    campanha: {
                        include: {
                            tenant: true,
                            empreendimento: true
                        }
                    }
                }
            });

            return contato;
        }
    }
}

export const contatoService = new ContatoService();
