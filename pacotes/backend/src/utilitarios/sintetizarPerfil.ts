/**
 * Sintetizador de Perfil da Imobiliária
 * 
 * Converte as respostas do quiz em texto RAG estruturado
 * que será injetado no prompt do agente SDR de Captação.
 */

// Tipos do Quiz (espelhando os do frontend)
interface DadosGerais {
  nomeImobiliaria: string;
  diferenciais: string[];
  tempoMercado?: number;
  atendeFinalDeSemana: boolean;
  horarioAtendimento?: string;
  trabalhaComLocacao: boolean;
  trabalhaComVenda: boolean;
  // Informações de contato
  endereco?: string;
  cidade?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  instagram?: string;
  facebook?: string;
}

interface PerfilLocacao {
  garantiasAceitas: string[];
  taxaAdministracao: number;
  taxaPrimeiroAluguel: boolean;
  prazoMinimoContrato: number;
  aceitaPet: boolean;
  fazVistoriaEntrada: boolean;
  fazVistoriaSaida: boolean;
  tempoMedioContrato: number;
  observacoesLocacao?: string;
}

interface PerfilVenda {
  comissaoPadrao: number;
  aceitaExclusividade: boolean;
  tempoExclusividade?: number;
  fazAvaliacaoGratuita: boolean;
  fazFotoProfissional: boolean;
  fazTourVirtual: boolean;
  anunciaPortais: string[];
  temParcerias: boolean;
  percentualParceria?: number;
  observacoesVenda?: string;
}

interface PerfilImobiliaria {
  dadosGerais: DadosGerais;
  locacao: PerfilLocacao;
  venda: PerfilVenda;
}

// Mapeamento de garantias para texto amigável
const GARANTIAS_TEXTO: Record<string, string> = {
  'FIADOR': 'fiador (pessoa física com imóvel quitado)',
  'SEGURO_FIANCA': 'seguro fiança',
  'TITULO_CAPITALIZACAO': 'título de capitalização',
  'CAUCAO': 'caução (depósito antecipado)',
  'CARTAO_CREDITO': 'garantia via cartão de crédito',
};

/**
 * Sintetiza o perfil da imobiliária em texto RAG
 * para ser injetado no contexto do agente.
 */
export function sintetizarPerfilRAG(perfil: PerfilImobiliaria): string {
  const { dadosGerais, locacao, venda } = perfil;
  
  const secoes: string[] = [];
  
  // ===== SEÇÃO: SOBRE A IMOBILIÁRIA =====
  secoes.push(`## SOBRE A IMOBILIÁRIA`);
  
  if (dadosGerais.nomeImobiliaria) {
    secoes.push(`Você representa a ${dadosGerais.nomeImobiliaria}.`);
  }
  
  if (dadosGerais.tempoMercado && dadosGerais.tempoMercado > 0) {
    secoes.push(`A imobiliária está no mercado há ${dadosGerais.tempoMercado} anos.`);
  }
  
  // Informar quais serviços a imobiliária oferece
  const servicos: string[] = [];
  if (dadosGerais.trabalhaComLocacao) servicos.push('LOCAÇÃO');
  if (dadosGerais.trabalhaComVenda) servicos.push('VENDA');
  
  if (servicos.length > 0) {
    secoes.push(`A imobiliária trabalha com: ${servicos.join(' e ')}.`);
  }
  
  if (dadosGerais.diferenciais.length > 0) {
    secoes.push(`Diferenciais: ${dadosGerais.diferenciais.join(', ')}.`);
  }
  
  if (dadosGerais.atendeFinalDeSemana) {
    secoes.push(`A imobiliária atende também aos finais de semana.`);
  }
  
  // ===== SEÇÃO: INFORMAÇÕES DE CONTATO =====
  const temContato = dadosGerais.endereco || dadosGerais.telefone || dadosGerais.whatsapp || 
                     dadosGerais.email || dadosGerais.site || dadosGerais.instagram || dadosGerais.facebook;
  
  if (temContato) {
    secoes.push(`\n## INFORMAÇÕES DE CONTATO`);
    secoes.push(`Quando o cliente perguntar sobre a imobiliária, forneça estas informações:`);
    
    if (dadosGerais.endereco) {
      const enderecoCompleto = dadosGerais.cidade 
        ? `${dadosGerais.endereco}, ${dadosGerais.cidade}`
        : dadosGerais.endereco;
      secoes.push(`- Endereço: ${enderecoCompleto}`);
    }
    if (dadosGerais.telefone) {
      secoes.push(`- Telefone: ${dadosGerais.telefone}`);
    }
    if (dadosGerais.whatsapp) {
      secoes.push(`- WhatsApp: ${dadosGerais.whatsapp}`);
    }
    if (dadosGerais.email) {
      secoes.push(`- E-mail: ${dadosGerais.email}`);
    }
    if (dadosGerais.site) {
      secoes.push(`- Site: ${dadosGerais.site}`);
    }
    if (dadosGerais.instagram) {
      secoes.push(`- Instagram: ${dadosGerais.instagram}`);
    }
    if (dadosGerais.facebook) {
      secoes.push(`- Facebook: ${dadosGerais.facebook}`);
    }
  }
  
  // ===== SEÇÃO: POLÍTICA DE LOCAÇÃO (apenas se trabalha com locação) =====
  if (dadosGerais.trabalhaComLocacao) {
    secoes.push(`\n## POLÍTICA DE LOCAÇÃO`);
    secoes.push(`Quando o proprietário deseja ALUGAR o imóvel:`);
    
    // Garantias
    const garantiasTexto = locacao.garantiasAceitas
      .map(g => GARANTIAS_TEXTO[g] || g.toLowerCase())
      .join(', ');
    secoes.push(`- Garantias aceitas: ${garantiasTexto || 'a definir'}.`);
    
    // Taxa
    secoes.push(`- Taxa de administração: ${locacao.taxaAdministracao}% sobre o aluguel mensal.`);
    
    if (locacao.taxaPrimeiroAluguel) {
      secoes.push(`- Cobramos o valor do primeiro aluguel como taxa de contrato.`);
    }
    
    // Contrato
    secoes.push(`- Prazo mínimo de contrato: ${locacao.prazoMinimoContrato} meses.`);
    
    // Pet
    if (locacao.aceitaPet) {
      secoes.push(`- Trabalhamos com imóveis que aceitam animais de estimação.`);
    } else {
      secoes.push(`- A maioria dos nossos imóveis não aceita animais de estimação.`);
    }
    
    // Vistoria
    if (locacao.fazVistoriaEntrada && locacao.fazVistoriaSaida) {
      secoes.push(`- Realizamos vistoria completa na entrada e saída do inquilino.`);
    } else if (locacao.fazVistoriaEntrada) {
      secoes.push(`- Realizamos vistoria na entrada do inquilino.`);
    }
    
    if (locacao.observacoesLocacao) {
      secoes.push(`- Observações: ${locacao.observacoesLocacao}`);
    }
  } else {
    secoes.push(`\n## LOCAÇÃO`);
    secoes.push(`A imobiliária NÃO trabalha com locação de imóveis.`);
    secoes.push(`Se o proprietário mencionar interesse em alugar, informe educadamente que não oferecemos esse serviço.`);
  }
  
  // ===== SEÇÃO: POLÍTICA DE VENDAS (apenas se trabalha com venda) =====
  if (dadosGerais.trabalhaComVenda) {
    secoes.push(`\n## POLÍTICA DE VENDAS`);
    secoes.push(`Quando o proprietário deseja VENDER o imóvel:`);
    
    // Comissão
    secoes.push(`- Comissão padrão: ${venda.comissaoPadrao}% sobre o valor de venda.`);
    
    // Exclusividade — Reframing: gestão de venda + compartilhamento ativo
    if (venda.aceitaExclusividade) {
      secoes.push(`- ⚠️ REGRA FUNDAMENTAL SOBRE EXCLUSIVIDADE: Quando o proprietário citar "exclusividade", NUNCA explique de cara. AJA EM 2 PASSOS.`);
      secoes.push(`  Passo 1: Pergunte "O que você entende por exclusividade hoje?" e aguarde ele responder.`);
      secoes.push(`  Passo 2: Após a resposta, foque direto na dor dele (o medo de ficar preso). Diga: "Ao invés de UMA empresa trabalhando, a gente compartilha sua venda com TODOS os corretores da cidade. O contrato de Gestão existe apenas porque arcamos com os custos iniciais e só recebemos no sucesso. Ele garante nosso investimento, não prende você a um corretor só."`);
      
      secoes.push(`- ⚠️ OBJEÇÃO "VÁRIOS CORRETORES / POUCAS VISITAS": Se o cliente disser que prefere deixar com várias imobiliárias, ou reclamar que já tem vários mas quase não tem visita, use o 'Dilema do Carona' para explicar a causa. Diga que se ele deixa solto, nenhum corretor investe dinheiro em tráfego ou fotos profissionais por medo de outro corretor vender rápido e pegar carona no investimento. O imóvel fica sem marketing. Com a nossa gestão, nós bancamos 100% do marketing pesado, protegemos nossa operação através da gestão, e ainda assim acionamos toda a rede para vender.`);

      secoes.push(`- ⚠️ REGRA INQUEBRÁVEL (E SE EU VENDER SOZINHO?): Se ele perguntar se pode vender sozinho sem pagar caso encontre o comprador, NUNCA autorize trabalho gratuito. Diga: "Se você contrata a gente pra fazer tudo e assumir o risco do investimento, o lógico é que se achar um cliente, você repassa pra nós resolvermos a burocracia e garantirmos o pagamento de ponta a ponta. Como na analogia de uma reforma com os empreiteiros: ele cobrará pela reforma mesmo se você for lá na obra lavar as ferramentas dele, certo? Nós somos a sua gestora imobiliária, a comissão continua sendo paga integralmente na venda final sob nossa responsabilidade de execução de papelada."`);
    } else {
      secoes.push(`- Não trabalhamos com contratos de exclusividade.`);
      secoes.push(`- O proprietário fica livre para anunciar em outros lugares.`);
    }

    secoes.push(`- Prazo do Contrato Padrão: 180 dias.`);
    secoes.push(`  (Se questionado por que 180 dias: Responda de forma simples que este tempo foi definido após estudos comprovarem que a média de tempo de venda de um apartamento na Quadra Dois gira em 180 dias. Reforce que essa média está muito abaixo da média nacional de vendas no mercado imobiliário, indicando alta velocidade na gestão. Não trata-se de prender, e sim de tempo técnico).`);
    
    
    // Serviços inclusos
    const servicosInclusos: string[] = [];
    if (venda.fazAvaliacaoGratuita) servicosInclusos.push('avaliação gratuita do imóvel');
    if (venda.fazFotoProfissional) servicosInclusos.push('fotos profissionais');
    if (venda.fazTourVirtual) servicosInclusos.push('tour virtual 360°');
    
    if (servicosInclusos.length > 0) {
      secoes.push(`- Serviços inclusos: ${servicosInclusos.join(', ')}.`);
    }
    
    // Portais
    if (venda.anunciaPortais.length > 0) {
      secoes.push(`- Anunciamos nos portais: ${venda.anunciaPortais.join(', ')}.`);
    }
    
    // Parcerias
    if (venda.temParcerias) {
      secoes.push(`- Fazemos parcerias com outras imobiliárias (${venda.percentualParceria || 50}% de divisão).`);
    }
    
    if (venda.observacoesVenda) {
      secoes.push(`- Observações: ${venda.observacoesVenda}`);
    }
  } else {
    secoes.push(`\n## VENDA`);
    secoes.push(`A imobiliária NÃO trabalha com venda de imóveis.`);
    secoes.push(`Se o proprietário mencionar interesse em vender, informe educadamente que não oferecemos esse serviço.`);
  }
  
  // ===== SEÇÃO: INSTRUÇÕES DE CAPTAÇÃO =====
  secoes.push(`\n## INSTRUÇÕES DE CAPTAÇÃO`);
  secoes.push(`Ao conversar com um proprietário interessado em anunciar:`);
  
  // Instrução 1 depende dos serviços oferecidos
  if (dadosGerais.trabalhaComLocacao && dadosGerais.trabalhaComVenda) {
    secoes.push(`1. Pergunte se deseja VENDER ou ALUGAR o imóvel.`);
  } else if (dadosGerais.trabalhaComVenda) {
    secoes.push(`1. Confirme o interesse em VENDER o imóvel (não trabalhamos com locação).`);
  } else if (dadosGerais.trabalhaComLocacao) {
    secoes.push(`1. Confirme o interesse em ALUGAR o imóvel (não trabalhamos com venda).`);
  }
  
  secoes.push(`2. Colete informações básicas: tipo, localização, metragem, quartos/suítes.`);
  secoes.push(`3. Explique os benefícios e diferenciais da imobiliária.`);
  
  if (dadosGerais.trabalhaComLocacao && dadosGerais.trabalhaComVenda) {
    secoes.push(`4. Dependendo da intenção (venda/locação), explique a política correspondente.`);
  } else if (dadosGerais.trabalhaComVenda) {
    secoes.push(`4. Explique nossa política de vendas (comissão, serviços inclusos, rede de parceiros).`);
  } else if (dadosGerais.trabalhaComLocacao) {
    secoes.push(`4. Explique nossa política de locação (garantias, taxa de administração).`);
  }
  
  secoes.push(`5. Ofereça para agendar uma visita de avaliação.`);
  secoes.push(`6. Seja educado, profissional e demonstre conhecimento do mercado local.`);
  
  return secoes.join('\n');
}

/**
 * Gera um resumo curto do perfil para exibição na UI
 */
export function resumirPerfil(perfil: PerfilImobiliaria): string {
  const { dadosGerais, locacao, venda } = perfil;
  
  const partes: string[] = [];
  
  if (dadosGerais.nomeImobiliaria) {
    partes.push(dadosGerais.nomeImobiliaria);
  }
  
  if (dadosGerais.tempoMercado && dadosGerais.tempoMercado > 0) {
    partes.push(`${dadosGerais.tempoMercado} anos no mercado`);
  }
  
  // Mostrar apenas os serviços oferecidos
  if (dadosGerais.trabalhaComLocacao) {
    partes.push(`Locação: ${locacao.taxaAdministracao}% adm`);
  }
  if (dadosGerais.trabalhaComVenda) {
    partes.push(`Venda: ${venda.comissaoPadrao}% comissão`);
  }
  
  return partes.join(' | ');
}