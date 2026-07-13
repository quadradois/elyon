import { responderErro } from '../utilitarios/resposta';
import { Router } from 'express';
import { getWhatsAppService, limparCacheWhatsApp } from '../servicos/whatsapp';
import { prisma } from '../lib/db';

const router = Router();

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
  try {
    // Obter tenantId do header ou query parameter
    const tenantId = req.tenantId as string;
    
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    // Buscar sessão ativa do tenant
    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId, 
        status: 'CONECTADO' 
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    // Usar a instância correta do tenant
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const status = await whatsappService.verificarStatus();
    console.log('Status verificado (GET /status):', JSON.stringify(status, null, 2));
    
    if (status?.instance?.state === 'open') {
      res.json({ status: 'CONECTADO' });
    } else if (status?.instance?.state === 'connecting') {
      res.json({ status: 'CONECTANDO' });
    } else {
      res.json({ status: 'DESCONECTADO', debug: status });
    }
  } catch (error) {
    console.error('Erro na rota /status:', error);
    res.json({ status: 'DESCONECTADO', error: error });
  }
});

// POST /api/whatsapp/conectar
router.post('/conectar', async (req, res) => {
  try {
    // Obter tenantId do header ou query parameter
    const tenantId = req.tenantId as string;
    
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    // Buscar sessão ativa do tenant ou criar uma nova
    let sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId, 
        status: 'CONECTADO' 
      }
    });

    let instanceName: string;
    
    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      // Se não houver sessão ativa, usar a instância padrão do tenant
      instanceName = `elyon_${tenantId.substring(0, 8)}_vendas`;
    } else {
      instanceName = sessaoWhatsapp.instanceName;
    }

    // Usar a instância correta do tenant
    const whatsappService = getWhatsAppService(instanceName);
    const resultado = await whatsappService.conectarInstancia();
    
    console.log('[WhatsApp] Solicitação de conexão concluída');

    // A Evolution retorna { qrcode: { base64: "..." } } ou algo similar dependendo da versão
    // Vamos garantir que retornamos o base64 ou o código para o frontend
    
    if (resultado && (resultado.base64 || (resultado.qrcode && typeof resultado.qrcode === 'string'))) {
       // Suporte a diferentes formatos de resposta da Evolution
       const qrCode = resultado.base64 || resultado.qrcode;
       res.json({ qrcode: qrCode });
    } else if (resultado && (resultado.count === 0 || resultado.status === 'open')) {
        // Se count for 0, pode estar conectado OU conectando OU desconectado sem QR Code novo
        // Vamos verificar o status real para ter certeza
        const statusReal = await whatsappService.verificarStatus();
        
        if (statusReal?.instance?.state === 'open') {
            res.json({ status: 'CONECTADO' });
        } else if (statusReal?.instance?.state === 'connecting') {
             res.json({ status: 'CONECTANDO' });
        } else if (statusReal?.instance?.state === 'close') {
             // Se está close e count=0, significa que não gerou QR Code e não está conectando.
             // Estado zumbi. Vamos deletar e recriar para forçar novo QR.
             console.log('Instância travada em close sem QR Code. Reiniciando...');
             try {
                await whatsappService.deletarInstancia().catch(() => {});
                await whatsappService.criarInstancia();
                // Tenta pegar o QR Code novamente da nova instância
                const novoResultado = await whatsappService.conectarInstancia();
                if (novoResultado.base64 || novoResultado.qrcode) {
                    res.json({ qrcode: novoResultado.base64 || novoResultado.qrcode });
                } else {
                    responderErro(res, 400, 'Falha ao regenerar QR Code após reset.');
                }
             } catch (err) {
                 console.error('Erro ao tentar recuperar instância:', err);
                 responderErro(res, 500, 'Erro ao recuperar instância travada.');
             }
        } else {
             res.json({ status: 'DESCONECTADO', detalhe: statusReal?.instance?.state });
        }
    } else {
        // Tenta pegar o base64 de dentro do objeto qrcode se for objeto
        // @ts-ignore
        if (resultado?.qrcode?.base64) {
            // @ts-ignore
            res.json({ qrcode: resultado.qrcode.base64 });
        } else {
            console.error('QR Code não encontrado na resposta:', resultado);
            responderErro(res, 400, 'Não foi possível obter o QR Code', {debug: resultado});
        }
    }
  } catch (error: any) {
    console.error('Erro ao conectar:', error);
    const errorMessage = error.response?.data || error.message || 'Erro desconhecido';
    responderErro(res, 500, 'Erro ao conectar instância', {details: errorMessage});
  }
});

// POST /api/whatsapp/reset
router.post('/reset', async (req, res) => {
  try {
    const tenantId = req.tenantId as string;

    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { tenantId },
      orderBy: { criadoEm: 'desc' }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp encontrada para este tenant.');
    }

    console.log(`Solicitação de reset manual da instância ${sessaoWhatsapp.instanceName}...`);
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);

    try {
      await whatsappService.deletarInstancia();
    } catch (e: any) {
      console.log('Erro ao deletar (pode não existir):', e.message);
    }

    // Limpa instanceId/token para forçar recriação no próximo conectar
    await prisma.sessaoWhatsapp.update({
      where: { id: sessaoWhatsapp.id },
      data: { evolutionInstanceId: null, evolutionToken: null, status: 'DESCONECTADO' }
    });
    limparCacheWhatsApp(sessaoWhatsapp.instanceName);

    res.json({ status: 'RESETADO', message: 'Instância resetada com sucesso. Tente conectar novamente.' });
  } catch (error: any) {
    console.error('Erro ao resetar:', error);
    responderErro(res, 500, 'Erro ao resetar instância.');
  }
});

// POST /api/whatsapp/enviar
router.post('/enviar', async (req, res) => {
  try {
    const { telefone, mensagem } = req.body;

    if (!telefone || !mensagem) {
      return responderErro(res, 400, 'Telefone e mensagem são obrigatórios.');
    }

    // Busca Lead para obter o tenantId
    const lead = await prisma.lead.findFirst({
      where: { telefone: { contains: telefone.slice(-8) } }
    });

    if (!lead) {
      return responderErro(res, 404, 'Lead não encontrado para o telefone fornecido.');
    }

    // Busca sessão ativa do tenant
    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId: lead.tenantId, 
        status: 'CONECTADO' 
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    // Usa a instância correta do tenant
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const resultado = await whatsappService.enviarMensagemTexto(telefone, mensagem);

    // Persistir mensagem enviada
    try {
      // Lead já foi encontrado anteriormente, usar ele
      if (lead) {
        let conversa = await prisma.conversa.findFirst({
          where: { leadId: lead.id, canal: 'WHATSAPP', estadoConversa: 'ativa' }
        });

        if (!conversa) {
          conversa = await prisma.conversa.create({
            data: {
              leadId: lead.id,
              canal: 'WHATSAPP',
              numeroOrigem: telefone,
              estadoConversa: 'ativa',
              contexto: {}
            }
          });
        }

        await prisma.mensagem.create({
          data: {
            conversaId: conversa.id,
            remetente: 'assistente',
            conteudo: mensagem,
            enviadaEm: new Date()
          }
        });
      }
    } catch (persistError) {
      console.error('Erro ao persistir mensagem enviada:', persistError);
      // Não falha a requisição se apenas o banco falhar, pois o envio foi feito
    }

    res.json({ status: 'ENVIADO', resultado });
  } catch (error: any) {
    console.error('Erro ao enviar mensagem:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// GET /api/whatsapp/configurar
router.get('/configurar', async (req, res) => {
  try {
    // Obter tenantId do header ou query parameter
    const tenantId = req.tenantId as string;
    
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    // Buscar sessão ativa do tenant
    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId, 
        status: 'CONECTADO' 
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    // Usar a instância correta do tenant
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const configuracao = await whatsappService.buscarConfiguracao();
    res.json(configuracao);
  } catch (error: any) {
    console.error('Erro ao buscar configuração:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// POST /api/whatsapp/configurar
router.post('/configurar', async (req, res) => {
  try {
    const { ignorarGrupos } = req.body;

    if (typeof ignorarGrupos !== 'boolean') {
      return responderErro(res, 400, 'Parâmetro ignorarGrupos deve ser booleano.');
    }

    // Obter tenantId do header ou query parameter
    const tenantId = req.tenantId as string;
    
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    // Buscar sessão ativa do tenant
    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId, 
        status: 'CONECTADO' 
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    // Usar a instância correta do tenant
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const resultado = await whatsappService.atualizarConfiguracao(ignorarGrupos);
    res.json({ status: 'CONFIGURADO', resultado });
  } catch (error: any) {
    console.error('Erro ao configurar instância:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

// POST /api/whatsapp/configurar-webhook
router.post('/configurar-webhook', async (req, res) => {
  try {
    const { url, enabled } = req.body;

    if (!url) {
      return responderErro(res, 400, 'URL do webhook é obrigatória.');
    }

    // Obter tenantId do header ou query parameter
    const tenantId = req.tenantId as string;
    
    if (!tenantId) {
      return responderErro(res, 400, 'Tenant ID é obrigatório. Forneça via header X-Tenant-Id ou query parameter tenantId.');
    }

    // Buscar sessão ativa do tenant
    const sessaoWhatsapp = await prisma.sessaoWhatsapp.findFirst({
      where: { 
        tenantId, 
        status: 'CONECTADO' 
      }
    });

    if (!sessaoWhatsapp || !sessaoWhatsapp.instanceName) {
      return responderErro(res, 400, 'Nenhuma sessão WhatsApp ativa encontrada para este tenant.');
    }

    // Usar a instância correta do tenant
    const whatsappService = getWhatsAppService(sessaoWhatsapp.instanceName);
    const resultado = await whatsappService.configurarWebhook(url, enabled);
    res.json({ status: 'CONFIGURADO', resultado });
  } catch (error: any) {
    console.error('Erro ao configurar webhook:', error);
    responderErro(res, 500, 'Erro interno do servidor');
  }
});

export default router;
