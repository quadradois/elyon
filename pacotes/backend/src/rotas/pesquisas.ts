/**
 * ROTAS DE PESQUISA DE EMPREENDIMENTOS
 * 
 * Integração com Manus API para pesquisa autônoma por IA
 * 
 * Endpoints:
 * - POST /api/pesquisas                   - Iniciar nova pesquisa
 * - GET  /api/pesquisas                   - Listar pesquisas do tenant
 * - GET  /api/pesquisas/:id               - Obter pesquisa específica
 * - POST /api/pesquisas/:id/verificar     - Verificar status no Manus
 * - POST /api/pesquisas/:id/aplicar       - Aplicar resultado como RAG
 * - POST /api/campanhas/:id/pesquisar     - Iniciar pesquisa para campanha
 */

import { responderErro } from '../utilitarios/resposta';
import { Router, Request } from 'express';
import { prisma } from '../lib/db';
import { z } from 'zod';
import { 
  manusService, 
  extrairTextoResposta,
  extrairJSONBriefing,
  converterParaBriefingEstruturado,
  gerarResumoTextual,
  BriefingEmpreendimentoJSON
} from '../servicos/manus';
import { getTenantId } from '../utils/tenant';

const router = Router();

// ============================================
// HELPERS
// ============================================

// ============================================
// SCHEMAS
// ============================================

const iniciarPesquisaSchema = z.object({
  nomeEmpreendimento: z.string().min(3, 'Nome do empreendimento obrigatório'),
  construtora: z.string().optional(),
  endereco: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().min(2, 'Cidade obrigatória'),
  estado: z.string().optional(),
  campanhaId: z.string().optional(),
});

// ============================================
// ROTAS
// ============================================

/**
 * POST /api/pesquisas
 * Inicia uma nova pesquisa de empreendimento via Manus
 */
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    // Validar dados
    const dados = iniciarPesquisaSchema.parse(req.body);

    // Verificar se Manus está configurado
    if (!manusService.estaConfigurado()) {
      return responderErro(res, 503, 'Serviço de pesquisa não configurado',
        {detalhes: 'Configure MANUS_API_KEY no ambiente'});
    }

    console.log(`[PESQUISA] 🚀 Iniciando pesquisa: ${dados.nomeEmpreendimento}`);

    // Iniciar pesquisa no Manus
    const resultado = await manusService.pesquisarEmpreendimento({
      nomeEmpreendimento: dados.nomeEmpreendimento,
      construtora: dados.construtora,
      endereco: dados.endereco,
      bairro: dados.bairro,
      cidade: dados.cidade,
      estado: dados.estado,
    });

    // Salvar no banco
    const pesquisa = await prisma.pesquisaManus.create({
      data: {
        tenantId,
        nomeEmpreendimento: dados.nomeEmpreendimento,
        construtora: dados.construtora,
        endereco: dados.endereco,
        bairro: dados.bairro,
        cidade: dados.cidade,
        estado: dados.estado,
        taskId: resultado.taskId,
        taskUrl: resultado.taskUrl,
        shareUrl: resultado.shareUrl,
        status: 'PENDENTE',
        campanhaId: dados.campanhaId,
      }
    });

    console.log(`[PESQUISA] ✅ Pesquisa criada: ${pesquisa.id}`);

    return res.status(201).json({
      sucesso: true,
      pesquisa: {
        id: pesquisa.id,
        taskId: pesquisa.taskId,
        taskUrl: pesquisa.taskUrl,
        shareUrl: pesquisa.shareUrl,
        status: pesquisa.status,
      }
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    
    if (error.name === 'ZodError') {
      return responderErro(res, 400, 'Dados inválidos', {detalhes: error.errors});
    }
    
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * GET /api/pesquisas
 * Lista todas as pesquisas do tenant
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }

    const { status, limite = '20' } = req.query;

    const pesquisas = await prisma.pesquisaManus.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as string } : {}),
      },
      orderBy: { iniciadaEm: 'desc' },
      take: parseInt(limite as string),
      include: {
        campanha: {
          select: { id: true, nome: true }
        }
      }
    });

    return res.json({
      sucesso: true,
      pesquisas: pesquisas.map(p => ({
        id: p.id,
        nomeEmpreendimento: p.nomeEmpreendimento,
        cidade: p.cidade,
        status: p.status,
        taskUrl: p.taskUrl,
        shareUrl: p.shareUrl,
        campanha: p.campanha,
        iniciadaEm: p.iniciadaEm,
        concluidaEm: p.concluidaEm,
      }))
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    return responderErro(res, 500, 'Erro ao listar pesquisas');
  }
});

/**
 * GET /api/pesquisas/:id
 * Obtém uma pesquisa específica com resultado
 */
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) {
      return responderErro(res, 401, 'Não autorizado - tenant não identificado');
    }
    
    const { id } = req.params;

    const pesquisa = await prisma.pesquisaManus.findUnique({
      where: { id },
      include: {
        campanha: { select: { id: true, nome: true } },
        empreendimento: { select: { id: true, nome: true } },
      }
    });

    if (!pesquisa) {
      return responderErro(res, 404, 'Pesquisa não encontrada');
    }
    
    // ✅ Verificar ownership
    if (pesquisa.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    return res.json({
      sucesso: true,
      pesquisa: {
        id: pesquisa.id,
        nomeEmpreendimento: pesquisa.nomeEmpreendimento,
        construtora: pesquisa.construtora,
        endereco: pesquisa.endereco,
        bairro: pesquisa.bairro,
        cidade: pesquisa.cidade,
        estado: pesquisa.estado,
        taskId: pesquisa.taskId,
        taskUrl: pesquisa.taskUrl,
        shareUrl: pesquisa.shareUrl,
        status: pesquisa.status,
        erro: pesquisa.erro,
        resultado: pesquisa.resultado,
        resultadoJson: pesquisa.resultadoJson,
        creditosUsados: pesquisa.creditosUsados,
        campanha: pesquisa.campanha,
        empreendimento: pesquisa.empreendimento,
        iniciadaEm: pesquisa.iniciadaEm,
        concluidaEm: pesquisa.concluidaEm,
      }
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    return responderErro(res, 500, 'Erro ao buscar pesquisa');
  }
});

/**
 * POST /api/pesquisas/:id/verificar
 * Verifica status da pesquisa no Manus e atualiza
 */
router.post('/:id/verificar', async (req, res) => {
  try {
    const { id } = req.params;

    const pesquisa = await prisma.pesquisaManus.findUnique({
      where: { id }
    });

    if (!pesquisa) {
      return responderErro(res, 404, 'Pesquisa não encontrada');
    }

    if (pesquisa.status === 'CONCLUIDO' || pesquisa.status === 'ERRO') {
      return res.json({
        sucesso: true,
        pesquisa: {
          id: pesquisa.id,
          status: pesquisa.status,
          resultado: pesquisa.resultado,
        }
      });
    }

    console.log(`[PESQUISA] 🔍 Verificando status: ${pesquisa.taskId}`);

    // Consultar Manus
    let task;
    try {
      task = await manusService.obterTarefa(pesquisa.taskId);
    } catch (manusError: any) {
      // Se a tarefa não foi encontrada no Manus
      if (manusError.message?.includes('task not found') || manusError.message?.includes('not found')) {
        console.log(`[PESQUISA] ⚠️ Tarefa não encontrada no Manus: ${pesquisa.taskId}`);
        
        // Verificar se é uma pesquisa recente (menos de 5 minutos)
        const agora = new Date();
        const diffMinutos = (agora.getTime() - pesquisa.iniciadaEm.getTime()) / 1000 / 60;
        
        let mensagemErro: string;
        if (diffMinutos < 5) {
          // Pesquisa muito recente - provavelmente problema com API key
          mensagemErro = 
            'A tarefa não foi encontrada na API Manus. Isso geralmente indica um problema ' +
            'com a configuração da API key. Acesse manus.im (Configurações > Integrações > API) ' +
            'para verificar sua chave e créditos disponíveis. Pode ser necessário gerar uma nova API key.';
        } else {
          // Pesquisa antiga - pode ter expirado
          mensagemErro = 'Tarefa expirou ou não foi encontrada no Manus. Inicie uma nova pesquisa.';
        }
        
        const atualizada = await prisma.pesquisaManus.update({
          where: { id },
          data: {
            status: 'ERRO',
            erro: mensagemErro,
            concluidaEm: new Date(),
          }
        });

        return res.json({
          sucesso: true,
          pesquisa: {
            id: atualizada.id,
            status: atualizada.status,
            erro: atualizada.erro,
            taskUrl: pesquisa.taskUrl, // Incluir URL para usuário verificar manualmente
            sugestao: 'Verifique a URL da tarefa manualmente ou gere uma nova API key',
          }
        });
      }
      
      // Outros erros, repassar
      throw manusError;
    }

    let novoStatus = pesquisa.status;
    let resultado: string | null = null;
    let resultadoJson: Record<string, any> | null = null;
    let creditosUsados: number | null = null;
    let erro: string | null = null;

    if (task.status === 'completed') {
      novoStatus = 'CONCLUIDO';
      const textoResposta = extrairTextoResposta(task);
      creditosUsados = task.credit_usage || null;
      
      // Tentar extrair JSON estruturado da resposta
      const extracao = extrairJSONBriefing(textoResposta);
      
      if (extracao.sucesso && extracao.dados) {
        // Sucesso! Temos JSON estruturado
        resultadoJson = extracao.dados;
        resultado = gerarResumoTextual(extracao.dados);
        console.log(`[PESQUISA] ✅ Concluída com JSON estruturado!`);
      } else {
        // Fallback: usar texto original
        resultado = textoResposta;
        console.log(`[PESQUISA] ⚠️ Concluída sem JSON estruturado, usando texto`);
      }
      
      console.log(`[PESQUISA] ✅ ${resultado?.length || 0} caracteres`);
    } else if (task.status === 'failed') {
      novoStatus = 'ERRO';
      erro = task.error || 'Erro desconhecido';
      console.log(`[PESQUISA] ❌ Falhou: ${erro}`);
    } else if (task.status === 'running') {
      novoStatus = 'PROCESSANDO';
    }

    // Atualizar no banco
    const atualizada = await prisma.pesquisaManus.update({
      where: { id },
      data: {
        status: novoStatus,
        resultado,
        resultadoJson: resultadoJson || undefined,
        creditosUsados,
        erro,
        concluidaEm: novoStatus === 'CONCLUIDO' || novoStatus === 'ERRO' 
          ? new Date() 
          : undefined,
      }
    });

    return res.json({
      sucesso: true,
      pesquisa: {
        id: atualizada.id,
        status: atualizada.status,
        resultado: atualizada.resultado,
        creditosUsados: atualizada.creditosUsados,
        erro: atualizada.erro,
      }
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * POST /api/pesquisas/:id/aplicar
 * Aplica resultado da pesquisa como RAG para a campanha
 * Se tiver JSON estruturado, preenche os campos da campanha automaticamente
 */
router.post('/:id/aplicar', async (req, res) => {
  try {
    const { id } = req.params;

    const pesquisa = await prisma.pesquisaManus.findUnique({
      where: { id },
      include: { campanha: true }
    });

    if (!pesquisa) {
      return responderErro(res, 404, 'Pesquisa não encontrada');
    }

    if (pesquisa.status !== 'CONCLUIDO') {
      return responderErro(res, 400, 'Pesquisa ainda não foi concluída');
    }

    if (!pesquisa.resultado) {
      return responderErro(res, 400, 'Pesquisa não possui resultado');
    }

    console.log(`[PESQUISA] 📚 Aplicando resultado para pesquisa ${id}`);

    // Extrair dados do JSON estruturado (se disponível)
    const dadosJson = pesquisa.resultadoJson as BriefingEmpreendimentoJSON | null;
    
    // Converter para formato do EditorBriefing
    const briefingEstruturado = dadosJson 
      ? converterParaBriefingEstruturado(dadosJson)
      : {};

    // Determinar localização
    const localizacaoPartes = [
      dadosJson?.endereco?.bairro || pesquisa.bairro,
      dadosJson?.endereco?.cidade || pesquisa.cidade,
      dadosJson?.endereco?.estado || pesquisa.estado
    ].filter(Boolean);
    const localizacao = localizacaoPartes.join(', ') || pesquisa.cidade;

    // Determinar tipo do imóvel
    const tipoMap: Record<string, string> = {
      'Apartamento': 'APARTAMENTO',
      'Casa': 'CASA',
      'Lote': 'LOTE',
      'Comercial': 'COMERCIAL',
    };
    const tipoImovel = dadosJson?.tipo_imovel 
      ? (tipoMap[dadosJson.tipo_imovel] || 'RESIDENCIAL')
      : 'RESIDENCIAL';

    // Criar ou atualizar EmpreendimentoConhecimento (RAG)
    const empreendimento = await prisma.empreendimentoConhecimento.upsert({
      where: {
        nome_localizacao: {
          nome: pesquisa.nomeEmpreendimento,
          localizacao: localizacao,
        }
      },
      create: {
        tenantId: pesquisa.tenantId,
        nome: pesquisa.nomeEmpreendimento,
        localizacao: localizacao,
        tipo: tipoImovel,
        briefingCompleto: pesquisa.resultado,
        briefingEstruturado: briefingEstruturado,
        confiabilidade: 0.7,
        versao: 1,
      },
      update: {
        briefingCompleto: pesquisa.resultado,
        briefingEstruturado: briefingEstruturado,
        ultimaAtualizacao: new Date(),
        versao: { increment: 1 },
      }
    });

    // Vincular pesquisa ao empreendimento
    await prisma.pesquisaManus.update({
      where: { id },
      data: { empreendimentoId: empreendimento.id }
    });

    // Se tem campanha vinculada, preencher TODOS os campos
    if (pesquisa.campanhaId) {
      const dadosCampanha: Record<string, any> = {
        // Vinculação RAG
        empreendimentoId: empreendimento.id,
        
        // Briefing completo e estruturado
        briefingCompleto: pesquisa.resultado,
        briefingEstruturado: briefingEstruturado,
        briefingGeradoEm: new Date(),
        briefingConfiabilidade: 0.7,
        
        // Dados básicos do empreendimento
        nomeEmpreendimento: dadosJson?.nome_empreendimento || pesquisa.nomeEmpreendimento,
        tipoImovel: dadosJson?.tipo_imovel || undefined,
      };

      // Preencher endereço se tiver no JSON
      if (dadosJson?.endereco) {
        const end = dadosJson.endereco;
        if (end.logradouro) dadosCampanha.logradouro = end.logradouro;
        if (end.numero) dadosCampanha.numero = end.numero;
        if (end.bairro) dadosCampanha.bairro = end.bairro;
        if (end.cidade) dadosCampanha.cidade = end.cidade;
        if (end.estado) dadosCampanha.estado = end.estado;
        if (end.cep) dadosCampanha.cep = end.cep;
      } else {
        // Usar dados da pesquisa original
        if (pesquisa.endereco) dadosCampanha.logradouro = pesquisa.endereco;
        if (pesquisa.bairro) dadosCampanha.bairro = pesquisa.bairro;
        if (pesquisa.cidade) dadosCampanha.cidade = pesquisa.cidade;
        if (pesquisa.estado) dadosCampanha.estado = pesquisa.estado;
      }

      // Atualizar campanha com todos os dados
      await prisma.campanha.update({
        where: { id: pesquisa.campanhaId },
        data: dadosCampanha
      });

      console.log(`[PESQUISA] ✅ Campanha ${pesquisa.campanhaId} atualizada com dados do empreendimento`);
    }

    console.log(`[PESQUISA] ✅ RAG aplicado ao empreendimento ${empreendimento.id}`);

    return res.json({
      sucesso: true,
      empreendimento: {
        id: empreendimento.id,
        nome: empreendimento.nome,
        localizacao: empreendimento.localizacao,
      },
      dadosPreenchidos: dadosJson ? {
        nomeEmpreendimento: dadosJson.nome_empreendimento,
        tipoImovel: dadosJson.tipo_imovel,
        endereco: dadosJson.endereco,
        temBriefingEstruturado: true,
      } : {
        temBriefingEstruturado: false,
      }
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * POST /api/campanhas/:campanhaId/pesquisar
 * Inicia pesquisa para uma campanha específica
 */
router.post('/campanhas/:campanhaId/pesquisar', async (req, res) => {
  try {
    const { campanhaId } = req.params;

    // Buscar campanha
    const campanha = await prisma.campanha.findUnique({
      where: { id: campanhaId }
    });

    if (!campanha) {
      return responderErro(res, 404, 'Campanha não encontrada');
    }

    // Verificar se Manus está configurado
    if (!manusService.estaConfigurado()) {
      return responderErro(res, 503, 'Serviço de pesquisa não configurado',
        {detalhes: 'Configure MANUS_API_KEY no ambiente'});
    }

    // Extrair dados da campanha
    const nomeEmpreendimento = campanha.nomeEmpreendimento || campanha.nome;
    const cidade = campanha.cidade || 'Goiânia';
    const estado = campanha.estado || 'GO';

    console.log(`[PESQUISA] 🚀 Iniciando pesquisa para campanha ${campanha.nome}`);

    // Iniciar pesquisa
    const resultado = await manusService.pesquisarEmpreendimento({
      nomeEmpreendimento,
      endereco: campanha.logradouro || undefined,
      bairro: campanha.bairro || undefined,
      cidade,
      estado,
    });

    // Salvar pesquisa
    const pesquisa = await prisma.pesquisaManus.create({
      data: {
        tenantId: campanha.tenantId,
        nomeEmpreendimento,
        endereco: campanha.logradouro,
        bairro: campanha.bairro,
        cidade,
        estado,
        taskId: resultado.taskId,
        taskUrl: resultado.taskUrl,
        shareUrl: resultado.shareUrl,
        status: 'PENDENTE',
        campanhaId: campanha.id,
      }
    });

    console.log(`[PESQUISA] ✅ Pesquisa ${pesquisa.id} iniciada para campanha ${campanha.id}`);

    return res.status(201).json({
      sucesso: true,
      pesquisa: {
        id: pesquisa.id,
        taskId: pesquisa.taskId,
        taskUrl: pesquisa.taskUrl,
        shareUrl: pesquisa.shareUrl,
        status: pesquisa.status,
      }
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

// ============================================
// CONFIGURAÇÃO DE WEBHOOK
// ============================================

/**
 * POST /api/pesquisas/webhook/registrar
 * Registra um webhook no Manus para receber notificações
 */
router.post('/webhook/registrar', async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return responderErro(res, 400, 'URL do webhook é obrigatória');
    }

    // Verificar se Manus está configurado
    if (!manusService.estaConfigurado()) {
      return responderErro(res, 503, 'Serviço de pesquisa não configurado',
        {detalhes: 'Configure MANUS_API_KEY no ambiente'});
    }

    const resultado = await manusService.registrarWebhook(url);

    return res.json({
      sucesso: true,
      webhookId: resultado.webhookId,
      mensagem: `Webhook registrado com sucesso. O Manus enviará notificações para ${url}`
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro ao registrar webhook:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * DELETE /api/pesquisas/webhook/:webhookId
 * Remove um webhook registrado
 */
router.delete('/webhook/:webhookId', async (req, res) => {
  try {
    const { webhookId } = req.params;

    if (!manusService.estaConfigurado()) {
      return responderErro(res, 503, 'Serviço de pesquisa não configurado');
    }

    await manusService.removerWebhook(webhookId);

    return res.json({
      sucesso: true,
      mensagem: 'Webhook removido com sucesso'
    });

  } catch (error: any) {
    console.error('[PESQUISA] Erro ao remover webhook:', error);
    return responderErro(res, 500, 'Erro interno do servidor');
  }
});

/**
 * GET /api/pesquisas/testar-conexao
 * Testa a conectividade com a API Manus
 */
router.get('/testar-conexao', async (req, res) => {
  try {
    if (!manusService.estaConfigurado()) {
      return res.json({
        sucesso: false,
        mensagem: 'API Manus não configurada (MANUS_API_KEY ausente)'
      });
    }

    const resultado = await manusService.testarConectividade();
    return res.json(resultado);

  } catch (error: any) {
    return res.status(500).json({
      sucesso: false,
      mensagem: 'Erro ao testar conexão',
      detalhes: error.message
    });
  }
});

export default router;
