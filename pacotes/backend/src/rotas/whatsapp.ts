import { Router } from 'express';
import { whatsappService } from '../servicos/whatsapp';
import axios from 'axios';
import { prisma } from '../servidor';

const router = Router();

// GET /api/whatsapp/status
router.get('/status', async (req, res) => {
  try {
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
    const resultado = await whatsappService.conectarInstancia();
    
    console.log('Resultado da conexão Evolution:', JSON.stringify(resultado, null, 2));

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
                await axios.delete(
                    `${process.env.EVOLUTION_API_URL}/instance/delete/${process.env.EVOLUTION_INSTANCE_NAME}`,
                    { headers: { apikey: process.env.EVOLUTION_API_KEY } }
                );
                await whatsappService.criarInstancia();
                // Tenta pegar o QR Code novamente da nova instância
                const novoResultado = await whatsappService.conectarInstancia();
                if (novoResultado.base64 || novoResultado.qrcode) {
                    res.json({ qrcode: novoResultado.base64 || novoResultado.qrcode });
                } else {
                    res.status(400).json({ error: 'Falha ao regenerar QR Code após reset.' });
                }
             } catch (err) {
                 console.error('Erro ao tentar recuperar instância:', err);
                 res.status(500).json({ error: 'Erro ao recuperar instância travada.' });
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
            res.status(400).json({ error: 'Não foi possível obter o QR Code', debug: resultado });
        }
    }
  } catch (error: any) {
    console.error('Erro ao conectar:', error);
    const errorMessage = error.response?.data || error.message || 'Erro desconhecido';
    res.status(500).json({ error: 'Erro ao conectar instância', details: errorMessage });
  }
});

// POST /api/whatsapp/reset
router.post('/reset', async (req, res) => {
  try {
    console.log('Solicitação de reset manual da instância...');
    try {
        await axios.delete(
            `${process.env.EVOLUTION_API_URL}/instance/delete/${process.env.EVOLUTION_INSTANCE_NAME}`,
            { headers: { apikey: process.env.EVOLUTION_API_KEY } }
        );
    } catch (e: any) {
        console.log('Erro ao deletar (pode não existir):', e.message);
    }
    
    // Aguarda um pouco para garantir
    await new Promise(r => setTimeout(r, 2000));
    
    res.json({ status: 'RESETADO', message: 'Instância resetada com sucesso. Tente conectar novamente.' });
  } catch (error: any) {
    console.error('Erro ao resetar:', error);
    res.status(500).json({ error: 'Erro ao resetar instância.' });
  }
});

// POST /api/whatsapp/enviar
router.post('/enviar', async (req, res) => {
  try {
    const { telefone, mensagem } = req.body;

    if (!telefone || !mensagem) {
      return res.status(400).json({ error: 'Telefone e mensagem são obrigatórios.' });
    }

    const resultado = await whatsappService.enviarMensagemTexto(telefone, mensagem);

    // Persistir mensagem enviada
    try {
      // Busca Lead (tenta match exato ou parcial)
      const lead = await prisma.lead.findFirst({
        where: { telefone: { contains: telefone.slice(-8) } }
      });

      if (lead) {
        let conversa = await prisma.conversa.findFirst({
          where: { leadId: lead.id, canal: 'WHATSAPP', status: 'ATIVA' }
        });

        if (!conversa) {
          conversa = await prisma.conversa.create({
            data: {
              leadId: lead.id,
              canal: 'WHATSAPP',
              sessaoId: `wa_${lead.id}_${Date.now()}`,
              status: 'ATIVA'
            }
          });
        }

        await prisma.mensagemConversa.create({
          data: {
            conversaId: conversa.id,
            papel: 'ASSISTENTE', // Enviado pelo sistema/usuário
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
    res.status(500).json({ 
      error: 'Erro ao enviar mensagem.',
      details: error.message,
      evolutionError: error.response?.data
    });
  }
});

// GET /api/whatsapp/configurar
router.get('/configurar', async (req, res) => {
  try {
    const configuracao = await whatsappService.buscarConfiguracao();
    res.json(configuracao);
  } catch (error: any) {
    console.error('Erro ao buscar configuração:', error);
    res.status(500).json({ error: 'Erro ao buscar configuração.', details: error.message });
  }
});

// POST /api/whatsapp/configurar
router.post('/configurar', async (req, res) => {
  try {
    const { ignorarGrupos } = req.body;

    if (typeof ignorarGrupos !== 'boolean') {
      return res.status(400).json({ error: 'Parâmetro ignorarGrupos deve ser booleano.' });
    }

    const resultado = await whatsappService.atualizarConfiguracao(ignorarGrupos);
    res.json({ status: 'CONFIGURADO', resultado });
  } catch (error: any) {
    console.error('Erro ao configurar instância:', error);
    res.status(500).json({ 
      error: 'Erro ao configurar instância.', 
      details: error.message,
      evolutionError: error.response?.data
    });
  }
});

// POST /api/whatsapp/configurar-webhook
router.post('/configurar-webhook', async (req, res) => {
  try {
    const { url, enabled } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL do webhook é obrigatória.' });
    }

    const resultado = await whatsappService.configurarWebhook(url, enabled);
    res.json({ status: 'CONFIGURADO', resultado });
  } catch (error: any) {
    console.error('Erro ao configurar webhook:', error);
    res.status(500).json({ 
      error: 'Erro ao configurar webhook.', 
      details: error.message,
      evolutionError: error.response?.data
    });
  }
});

export default router;
