/**
 * Rotas de Mensagens - Chat e Histórico de Contatos
 * 
 * Responsabilidades:
 * - Buscar dados completos de um contato
 * - Buscar histórico de mensagens
 * - Enviar mensagens manuais
 * - Histórico de atividades
 */

import { responderErro } from '../../utilitarios/resposta';
import { Router } from 'express';
import { logger } from '../../lib/logger';
import { prisma } from '../../lib/db';
import type { DadosCacheCpf } from '../../types/cache-cpf';

const router = Router();

// ============================================
// DADOS DO CONTATO
// ============================================

/**
 * GET /contatos/:id
 * Retorna os dados completos de um contato específico
 */
router.get('/contatos/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.lead.findUnique({
      where: { id },
      include: {
        campanhaOrigem: {
          select: {
            id: true,
            nome: true,
            tenantId: true,
            empreendimento: { select: { nome: true } }
          }
        }
      }
    });

    if (!contato) {
      return responderErro(res, 404, 'Contato não encontrado');
    }

    // ✅ TASK-02: Isolamento multi-tenant (IDOR fix)
    // Verificar se o contato pertence ao tenant autenticado via header
    const tenantId = req.tenantId as string;
    if (tenantId && contato.campanhaOrigem?.tenantId && contato.campanhaOrigem.tenantId !== tenantId) {
      return responderErro(res, 403, 'Acesso negado');
    }

    // ============================================
    // SMART FETCHING (Enriquecimento em tempo real)
    // ============================================
    
    // 1. Tentar enriquecer dados profissionais/pessoais via CacheCpf
    // Critério: se falta profissão, renda OU box/unidade (para quando temos dados de IPTU)
    const precisaEnriquecimentoProfissional = contato.cpf && (!contato.profissao || (!contato.rendaEstimada && String(contato.rendaEstimada) !== '0'));
    const precisaSmartBox = contato.cpf && !contato.box;
    
    if (precisaEnriquecimentoProfissional || precisaSmartBox) {
      const cpfLimpo = contato.cpf!.replace(/\D/g, '');
      // ✅ TASK-05: CPF mascarado nos logs (LGPD Art. 46)
      logger.info(`[Campanhas] 🔍 Enriquecendo contato ${contato.nome} (CPF: ***${cpfLimpo.slice(-4)})...`);
      
      const cache = await prisma.cacheCpf.findFirst({
        where: { cpf: cpfLimpo }
      });

      if (cache && cache.dados) {
        // ✅ TASK-12: Tipagem correta — elimina `as any` em código crítico
        const dados = cache.dados as DadosCacheCpf;
        logger.info(`[Campanhas] ✅ Dados de cache encontrados para ${contato.nome}`);
        
        // Mapear campos que estão vazios no contato
        if (dados.profissao && !contato.profissao) {
          contato.profissao = dados.profissao;
          logger.info(`[Campanhas] -> Profissão: ${dados.profissao}`);
        }
        
        if (dados.rendaEstimada && !contato.rendaEstimada) {
          contato.rendaEstimada = dados.rendaEstimada as any;
          logger.info(`[Campanhas] -> Renda: ${dados.rendaEstimada}`);
        }

        if (dados.faixaSalarial && !contato.faixaSalarial) contato.faixaSalarial = dados.faixaSalarial;
        if (dados.setor && !contato.setor) contato.setor = dados.setor;
        if (dados.empresaAtual && !contato.empresaAtual) contato.empresaAtual = dados.empresaAtual;
        if (dados.cnpjEmpresa && !contato.cnpjEmpresa) contato.cnpjEmpresa = dados.cnpjEmpresa;
        if (dados.sexo && !contato.sexo) contato.sexo = dados.sexo;
        if (dados.idade && !contato.idade) contato.idade = Number(dados.idade);
        if (dados.signo && !contato.signo) contato.signo = dados.signo;
        if (dados.situacaoCadastral && !contato.situacaoCadastral) contato.situacaoCadastral = dados.situacaoCadastral;
        if (dados.nomeMae && !contato.nomeMae) contato.nomeMae = dados.nomeMae;
        
        if (dados.dataNascimento && !contato.dataNascimento) {
          try {
            const partes = dados.dataNascimento.split('/');
            if (partes.length === 3) {
              contato.dataNascimento = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
            }
          } catch (e) { /* ignora erro de data */ }
        }

        // Se o contato não tem endereços e o cache tem, mapear também
        if (!contato.enderecoPessoal && dados.endereco) {
          const end = dados.endereco;
          contato.enderecoPessoal = [end.tipoLogradouro, end.logradouro, end.numero, end.complemento]
            .filter(Boolean).join(' ').trim() || null;
          contato.cidade = end.cidade || null;
          contato.estado = end.uf || null;
          contato.cep = end.cep || null;
        }

        // Telefones e Emails do cache (enviar via JSON se não existirem campos específicos)
        if (!contato.telefonesJson && dados.telefones) contato.telefonesJson = dados.telefones;
        if (!contato.emailsJson && dados.emails) contato.emailsJson = dados.emails;

        // 🟢 HOLÍSTICO: Fallback para Sócios e Empresários
        // Se não tem profissão/empresa recente mas tem participações em empresas
        if (!contato.profissao && !contato.empresaAtual && dados.participacoesEmpresas && Array.from(dados.participacoesEmpresas as any).length > 0) {
          const participacao = (dados.participacoesEmpresas as any)[0];
          contato.empresaAtual = participacao.razaoSocial;
          contato.profissao = participacao.participacao || 'Sócio/Proprietário';
          contato.cnpjEmpresa = participacao.cnpj;
          logger.info(`[Campanhas] 🏢 Fallback para sócio: ${contato.profissao} na ${contato.empresaAtual}`);
        }
        
        // Sincronizar campo participation para o Contato
        if (!contato.participacoesEmpresas && dados.participacoesEmpresas) {
          contato.participacoesEmpresas = dados.participacoesEmpresas as any;
        }
      } else {
        logger.info(`[Campanhas] ⚠️ Nenhum cache encontrado para CPF ${cpfLimpo}`);
      }
    }

    // 2. Tentar enriquecer dados do Imóvel via tabela Imovel (pela inscrição IPTU)
    if (contato.inscricaoIptu) {
      const imovel = await prisma.imovel.findFirst({
        where: { 
          inscricaoIptu: contato.inscricaoIptu
        },
        include: {
          dadosBairro: true,
          dadosEdificio: true
        }
      });

      if (imovel) {
        // Preencher campos físicos do imóvel se estiverem vazios
        if (!contato.areaTerreno && imovel.areaTerreno) (contato as any).areaTerreno = imovel.areaTerreno;
        if (!contato.areaConstruida && imovel.areaEdificada) (contato as any).areaConstruida = imovel.areaEdificada;
        if (!contato.tipoImovel) contato.tipoImovel = imovel.tipoImovel;
        if (!contato.nomeEdificio) contato.nomeEdificio = imovel.nomeEdificio;
        
        // Garantir endereço do imóvel como string legível (apenas Rua + Numero)
        if (!contato.enderecoImovel || String(contato.enderecoImovel).includes('[object')) {
          contato.enderecoImovel = `${imovel.logradouro}${imovel.numero ? ', ' + imovel.numero : ''}`;
        }

        if (!contato.quadra) contato.quadra = imovel.quadra;
        if (!contato.lote) contato.lote = imovel.lote;
        if (!contato.box) contato.box = imovel.box;
        if (!contato.unidade) contato.unidade = imovel.unidade || imovel.apartamento;
        
        // Bairro: Tentar pegar o nome real da tabela de Bairros, senão usa o campo do imovel
        const nomeRealBairro = imovel.dadosBairro?.nome || imovel.bairro;
        if (!contato.bairroImovel || String(contato.bairroImovel).includes('[object') || String(contato.bairroImovel).includes('AV ') || String(contato.bairroImovel).includes('RUA ')) {
          contato.bairroImovel = nomeRealBairro;
        }

        // Se o endereço e o bairro forem iguais (erro comum da prefeitura), tenta limpar
        if (contato.enderecoImovel === contato.bairroImovel) {
           contato.bairroImovel = imovel.dadosBairro?.nome || contato.bairroImovel;
        }
      }
    }

    // 3. Smart Box Discovery (Busca cruzada por CPF no mesmo prédio/edifício)
    if (!contato.box && contato.cpf) {
      logger.info(`[Campanhas] 📦 Iniciando Smart Box Discovery para ${contato.nome}...`);
      
      const iptuPref = contato.inscricaoIptu ? contato.inscricaoIptu.substring(0, 10) : null;
      const nomeEdifCurto = contato.nomeEdificio ? String(contato.nomeEdificio).split(' ')[0].toUpperCase() : null;

      // Buscar todos os imóveis do mesmo dono
      // ✅ TASK-09: take: 10 — evita query N+1 sem bounds (ex: proprietário com 200 unidades)
      const imoveisDono = await prisma.imovel.findMany({
        where: {
          lead: { cpf: contato.cpf }
        },
        take: 10,
        select: {
          inscricaoIptu: true,
          box: true,
          complemento: true,
          unidade: true,
          nomeEdificio: true,
        }
      });

      logger.info(`[Campanhas] -> Encontrados ${imoveisDono.length} imóveis do proprietário no banco.`);

      const imovelBox = imoveisDono.find(img => {
         if (img.inscricaoIptu === contato.inscricaoIptu) return false; // Ignora o próprio apto

         const comp = (img.complemento || "").toUpperCase();
         const unid = (img.unidade || "").toUpperCase();
         const edif = (img.nomeEdificio || "").toUpperCase();
         
         const ehBox = (img.box || comp.includes('BOX') || comp.includes('VAGA') || comp.includes('GARAGEM') || comp.includes('ESC') ||
                        unid.includes('BOX') || unid.includes('VAGA') || unid.includes('GARAGEM') || unid.includes('ESC'));

         if (!ehBox) return false;

         // Critério de vizinhança: Mesmo prefixo IPTU OU Mesmo nome de edifício
         const mesmoPredio = (iptuPref && img.inscricaoIptu.startsWith(iptuPref)) || 
                             (nomeEdifCurto && edif.includes(nomeEdifCurto));

         return mesmoPredio;
      });

      if (imovelBox) {
        contato.box = imovelBox.box || imovelBox.complemento?.match(/(?:BOX|VAGA|GARAGEM|ESC|GAR)\s*(\d+)/i)?.[1] || imovelBox.unidade;
        logger.info(`[Campanhas] ✅ Box encontrado via Smart Discovery: ${contato.box} (IPTU: ${imovelBox.inscricaoIptu})`);
      } else {
        logger.info(`[Campanhas] ⚠️ Nenhum box correspondente encontrado para este CPF no edifício.`);
      }
    }

    // ✅ TASK-17: Persistência do Enriquecimento (Lazy Enrichment)
    // Se o contato precisou ser enriquecido em memória, nós persistimos o resultado.
    // Assim, todas as futuras visualizações farão apenas 1 query rápida, eliminando o problema do N+1.
    if (precisaEnriquecimentoProfissional || precisaSmartBox) {
       try {
         await prisma.lead.update({
           where: { id: contato.id },
           data: {
             profissao: contato.profissao,
             empresaAtual: contato.empresaAtual,
             rendaEstimada: contato.rendaEstimada ? typeof contato.rendaEstimada === 'string' ? contato.rendaEstimada : String(contato.rendaEstimada) : undefined,
             areaTerreno: contato.areaTerreno ? String(contato.areaTerreno) : undefined,
             areaConstruida: contato.areaConstruida ? String(contato.areaConstruida) : undefined,
             valorVenal: contato.valorVenal ? String(contato.valorVenal) : undefined,
             nomeEdificio: String(contato.nomeEdificio) || undefined,
             box: String(contato.box) || undefined,
             unidade: String(contato.unidade) || undefined
           }
         });
         logger.info(`[Campanhas] 💾 Enriquecimento persistido no banco de dados para o longo prazo (Lead ${contato.id})`);
       } catch (errDb) {
         logger.error('Erro registrado');
       }
    }

    return res.json(contato);

  } catch (error: any) {
    logger.error('Erro');
    return responderErro(res, 500, 'Erro ao buscar dados do contato');
  }
});

// ============================================
// MENSAGENS
// ============================================

/**
 * GET /contatos/:id/mensagens
 * Retorna o histórico de mensagens de um contato específico
 */
router.get('/contatos/:id/mensagens', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.lead.findUnique({
      where: { id },
      include: { campanhaOrigem: { select: { nome: true, tenantId: true } } }
    });

    if (!contato) {
      return responderErro(res, 404, 'Contato não encontrado');
    }

    const mensagens = await prisma.mensagemProspeccao.findMany({
      where: { leadId: id },
      orderBy: { dataHora: 'asc' },
      select: {
        id: true,
        tipo: true,
        direcao: true,
        conteudo: true,
        dataHora: true,
        messageId: true,
      }
    });

    const mensagensFormatadas = mensagens.map((msg: {
      id: string;
      tipo: string;
      direcao: string;
      conteudo: string;
      dataHora: Date;
      messageId: string | null;
    }) => ({
      id: msg.id,
      tipo: msg.direcao === 'SAIDA' ? 'ENVIADA' : 'RECEBIDA',
      conteudo: msg.conteudo,
      timestamp: msg.dataHora.toISOString(),
      remetente: msg.direcao === 'SAIDA' ? 'Agente IA' : contato.nome
    }));

    return res.json({
      mensagens: mensagensFormatadas,
      contato: {
        id: contato.id,
        nome: contato.nome,
        telefone: contato.telefone,
        ultimoContato: contato.ultimaTentativa,
      }
    });

  } catch (error: any) {
    logger.error('Erro');
    return responderErro(res, 500, 'Erro ao buscar histórico de mensagens');
  }
});

/**
 * POST /contatos/:id/mensagens
 * Envia uma mensagem manual para um contato (corretor → cliente)
 */
router.post('/contatos/:id/mensagens', async (req, res) => {
  try {
    const { id } = req.params;
    const { conteudo } = req.body;

    if (!conteudo || conteudo.trim() === '') {
      return responderErro(res, 400, 'Conteúdo da mensagem é obrigatório');
    }

    const contato = await prisma.lead.findUnique({
      where: { id },
      include: { campanhaOrigem: true }
    });

    if (!contato) {
      return responderErro(res, 404, 'Contato não encontrado');
    }

    if (!contato.telefone) {
      return responderErro(res, 400, 'Contato não possui telefone cadastrado');
    }

    // Descobrir o tenant correspondente à campanha do contato
    if (!contato.campanhaOrigem) {
      return responderErro(res, 400, 'Contato sem campanha de origem');
    }
    const tenantId = contato.campanhaOrigem.tenantId;

    // Buscar a sessão WhatsApp ativa que pertence ao tenant da campanha
    const sessao = await prisma.sessaoWhatsapp.findFirst({
      where: {
        tenantId: tenantId,
        status: 'CONECTADO'
      }
    });

    if (!sessao) {
      logger.info(`[Campanhas] Nenhuma sessão WhatsApp conectada para tenant ${tenantId}`);
      return responderErro(res, 400, 'Nenhuma sessão do WhatsApp conectada. Acesse as configurações para conectar o WhatsApp.');
    }

    let telefoneFormatado = contato.telefone.replace(/\D/g, '');
    if (!telefoneFormatado.startsWith('55')) {
      telefoneFormatado = '55' + telefoneFormatado;
    }

    let messageId = null;

    try {
      // Import dynamic service instance handler at top (if not already there, we use existing getWhatsAppService)
      const { getWhatsAppService } = require('../../servicos/whatsapp');
      const whatsappService = getWhatsAppService(sessao.instanceName);

      // Enviar a mensagem para o telefone
      const resultadoEvolution = await whatsappService.enviarMensagemTexto(telefoneFormatado, conteudo.trim());
      messageId = resultadoEvolution.key?.id || null;
    } catch (evoError: any) {
      logger.error({ err: evoError.message }, '[Campanhas] Erro Evolution service:');
      return responderErro(res, 500, 'Erro ao conectar com a API do WhatsApp. Verifique se sua sessão continua conectada.');
    }

    const mensagemSalva = await prisma.mensagemProspeccao.create({
      data: {
        leadId: id,
        direcao: 'SAIDA',
        tipo: 'TEXTO',
        conteudo: conteudo.trim(),
        telefone: telefoneFormatado,
        messageId: messageId,
        dataHora: new Date(),
      }
    });

    await prisma.lead.update({
      where: { id },
      data: { ultimaTentativa: new Date() }
    });

    return res.status(201).json({
      sucesso: true,
      mensagem: {
        id: mensagemSalva.id,
        tipo: 'ENVIADA',
        conteudo: mensagemSalva.conteudo,
        timestamp: mensagemSalva.dataHora.toISOString(),
        remetente: 'Corretor',
      }
    });

  } catch (error: any) {
    logger.error('Erro');
    return responderErro(res, 500, 'Erro ao enviar mensagem');
  }
});

// ============================================
// HISTÓRICO DE ATIVIDADES
// ============================================

/**
 * GET /contatos/:id/historico
 * Retorna o histórico de atividades de um contato
 */
router.get('/contatos/:id/historico', async (req, res) => {
  try {
    const { id } = req.params;

    const contato = await prisma.lead.findUnique({ where: { id } });

    if (!contato) {
      return responderErro(res, 404, 'Contato não encontrado');
    }

    const historico: Array<{
      id: string;
      tipo: string;
      titulo: string;
      descricao: string;
      data: string;
      status: string;
      resultado: string | null;
    }> = [];

    // Evento de criação
    historico.push({
      id: `criacao-${contato.id}`,
      tipo: 'CRIACAO',
      titulo: 'Contato criado',
      descricao: 'Contato adicionado à campanha',
      data: contato.criadoEm.toISOString(),
      status: 'CONCLUIDA',
      resultado: null,
    });

    // Primeira mensagem
    const primeiraMensagem = await prisma.mensagemProspeccao.findFirst({
      where: { leadId: id },
      orderBy: { dataHora: 'asc' }
    });

    if (primeiraMensagem) {
      historico.push({
        id: `msg-${primeiraMensagem.id}`,
        tipo: 'PRIMEIRO_CONTATO',
        titulo: 'Primeiro contato',
        descricao: 'Início da prospecção via WhatsApp',
        data: primeiraMensagem.dataHora.toISOString(),
        status: 'CONCLUIDA',
        resultado: null,
      });
    }

    // Quando respondeu
    if (contato.respondeu && contato.primeiraResposta) {
      historico.push({
        id: `resposta-${contato.id}`,
        tipo: 'RESPOSTA',
        titulo: 'Contato respondeu',
        descricao: 'Proprietário respondeu à mensagem',
        data: contato.primeiraResposta.toISOString(),
        status: 'CONCLUIDA',
        resultado: null,
      });
    }

    // virouLead removed — lead is always a lead

    // Recontato agendado
    if (contato.dataRecontato) {
      historico.push({
        id: `recontato-${contato.id}`,
        tipo: 'RECONTATO',
        titulo: 'Recontato agendado',
        descricao: contato.motivoRecontato || 'Follow-up programado',
        data: contato.dataRecontato.toISOString(),
        status: new Date() > contato.dataRecontato ? 'PENDENTE' : 'AGENDADO',
        resultado: null,
      });
    }

    // Ordenar por data decrescente
    historico.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    return res.json({ historico });

  } catch (error: any) {
    logger.error('Erro');
    return responderErro(res, 500, 'Erro ao buscar histórico');
  }
});

export default router;
