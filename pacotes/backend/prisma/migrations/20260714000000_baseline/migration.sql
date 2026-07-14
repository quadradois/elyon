-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "StatusTenant" AS ENUM ('ATIVO', 'SUSPENSO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "PlanoTipo" AS ENUM ('STARTER', 'GROWTH', 'PRO');

-- CreateEnum
CREATE TYPE "StatusPagamento" AS ENUM ('PENDENTE', 'PAGO', 'ATRASADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoIntegracao" AS ENUM ('CRM_QUADRADOIS', 'CRM_OUTRO', 'CANALPRO', 'WEBHOOK_CUSTOM');

-- CreateEnum
CREATE TYPE "StatusDocumento" AS ENUM ('PENDENTE', 'PROCESSANDO', 'SUCESSO', 'ERRO');

-- CreateEnum
CREATE TYPE "TipoAgente" AS ENUM ('SDR_CAPTACAO', 'PERSONALIZADO', 'SDR_VENDAS', 'SDR_LOCACAO', 'DOCUMENTOS');

-- CreateEnum
CREATE TYPE "ModoCriacao" AS ENUM ('PRE_TREINADO', 'PERSONALIZADO');

-- CreateEnum
CREATE TYPE "StatusAgente" AS ENUM ('RASCUNHO', 'ATIVO', 'PAUSADO');

-- CreateEnum
CREATE TYPE "StatusConexao" AS ENUM ('DESCONECTADO', 'CONECTANDO', 'CONECTADO', 'ERRO');

-- CreateEnum
CREATE TYPE "PapelUsuario" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'CORRETOR', 'VISUALIZADOR');

-- CreateEnum
CREATE TYPE "StatusLead" AS ENUM ('NOVO', 'TENTATIVA_AGENDAMENTO', 'VISITA_AGENDADA', 'AVALIACAO_EM_ANDAMENTO', 'DOCUMENTACAO', 'ONBOARDING', 'CAPTADO', 'PERDIDO', 'ARQUIVADO');

-- CreateEnum
CREATE TYPE "Temperatura" AS ENUM ('FRIO', 'MORNO', 'QUENTE');

-- CreateEnum
CREATE TYPE "Urgencia" AS ENUM ('BAIXA', 'MEDIA', 'ALTA');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('CAPTACAO', 'LOCACAO', 'VENDA');

-- CreateEnum
CREATE TYPE "StatusContrato" AS ENUM ('PENDENTE', 'ENVIADO', 'ACEITO', 'CANCELADO', 'EXPIRADO');

-- CreateEnum
CREATE TYPE "TipoAtividade" AS ENUM ('LIGACAO', 'EMAIL', 'WHATSAPP', 'REUNIAO', 'NOTA', 'TAREFA', 'AVALIACAO', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "StatusAgendamento" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'REALIZADO', 'NAO_COMPARECEU');

-- CreateEnum
CREATE TYPE "StatusConfirmacaoCorretor" AS ENUM ('PENDENTE', 'CONFIRMADO', 'EXPIRADO', 'REMANEJADO', 'RECUSADO');

-- CreateEnum
CREATE TYPE "TipoTransacao" AS ENUM ('ASSINATURA', 'RECARGA', 'BONUS', 'ESTORNO');

-- CreateEnum
CREATE TYPE "TipoCredito" AS ENUM ('MENSAIS', 'PREPAGOS', 'BONUS');

-- CreateEnum
CREATE TYPE "StatusTransacao" AS ENUM ('PENDENTE', 'CONFIRMADO', 'CANCELADO', 'ESTORNADO');

-- CreateEnum
CREATE TYPE "MetodoPagamento" AS ENUM ('PIX', 'BOLETO', 'CARTAO_CREDITO', 'CARTAO_DEBITO');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "StatusTenant" NOT NULL DEFAULT 'ATIVO',
    "plano" TEXT NOT NULL DEFAULT 'SMALL_BUSINESS',
    "precoConsultaCpf" DECIMAL(65,30) NOT NULL DEFAULT 2.00,
    "quotaMensal" INTEGER NOT NULL DEFAULT 100,
    "totalConsultas" INTEGER NOT NULL DEFAULT 0,
    "taxaCacheHit" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cnpj" TEXT,
    "endereco" TEXT,
    "cidade" TEXT DEFAULT 'Goiânia - GO',
    "telefone" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "site" TEXT,
    "instagram" TEXT,
    "facebook" TEXT,
    "logoUrl" TEXT,
    "diferenciais" JSONB,
    "horarioAtendimento" TEXT DEFAULT '08:00 às 18:00',
    "atendeFinalDeSemana" BOOLEAN NOT NULL DEFAULT false,
    "tempoMercado" INTEGER,
    "expedienteSemanal" JSONB,
    "perfilLocacao" JSONB,
    "perfilVenda" JSONB,
    "ragPerfilTexto" TEXT,
    "llmProvedor" TEXT,
    "llmModelo" TEXT,
    "llmApiKeyCriptografada" TEXT,
    "llmBaseUrl" TEXT,
    "openaiApiKeyCriptografada" TEXT,
    "usarChavePrincipalParaAudio" BOOLEAN NOT NULL DEFAULT true,
    "usarChavePrincipalParaRag" BOOLEAN NOT NULL DEFAULT true,
    "creditosMensais" INTEGER NOT NULL DEFAULT 0,
    "creditosPrepagos" INTEGER NOT NULL DEFAULT 0,
    "creditosBonus" INTEGER NOT NULL DEFAULT 0,
    "agentesExtras" INTEGER NOT NULL DEFAULT 0,
    "planoTipo" "PlanoTipo" NOT NULL DEFAULT 'STARTER',
    "valorPlano" DECIMAL(65,30) NOT NULL DEFAULT 199.00,
    "dataRenovacao" TIMESTAMP(3),
    "statusPagamento" "StatusPagamento" NOT NULL DEFAULT 'PENDENTE',
    "asaasClienteId" TEXT,
    "asaasAssinaturaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_integracao" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoIntegracao" NOT NULL DEFAULT 'CRM_QUADRADOIS',
    "nome" TEXT NOT NULL DEFAULT 'CRM Principal',
    "apiUrl" TEXT NOT NULL,
    "apiKeyCriptografada" TEXT NOT NULL,
    "tenantIdDestino" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ultimoTesteEm" TIMESTAMP(3),
    "ultimoTesteOk" BOOLEAN,
    "ultimoErro" TEXT,
    "totalEnvios" INTEGER NOT NULL DEFAULT 0,
    "totalSucessos" INTEGER NOT NULL DEFAULT 0,
    "totalFalhas" INTEGER NOT NULL DEFAULT 0,
    "ultimoEnvioEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_integracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configuracoes_agente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sessaoWhatsappId" TEXT,
    "tipoAgente" "TipoAgente" NOT NULL DEFAULT 'SDR_CAPTACAO',
    "modoCreacao" "ModoCriacao" NOT NULL DEFAULT 'PRE_TREINADO',
    "templateBase" TEXT,
    "nome" TEXT NOT NULL,
    "avatar" TEXT,
    "genero" TEXT NOT NULL DEFAULT 'feminino',
    "personalidade" JSONB NOT NULL,
    "expertise" JSONB NOT NULL,
    "scripts" JSONB NOT NULL,
    "regrasNegocio" JSONB NOT NULL,
    "perfilImobiliaria" JSONB,
    "ragPerfilTexto" TEXT,
    "promptCustomizado" TEXT,
    "toolsCustomizadas" JSONB,
    "status" "StatusAgente" NOT NULL DEFAULT 'RASCUNHO',
    "estaAtivo" BOOLEAN NOT NULL DEFAULT false,
    "termosAceitos" BOOLEAN NOT NULL DEFAULT false,
    "termosAceitosEm" TIMESTAMP(3),
    "termosVersao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "configuracoes_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_agente" (
    "id" TEXT NOT NULL,
    "agenteId" TEXT NOT NULL,
    "nomeOriginal" TEXT NOT NULL,
    "nomeStorage" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "textoExtraido" TEXT,
    "totalCaracteres" INTEGER,
    "status" "StatusDocumento" NOT NULL DEFAULT 'PENDENTE',
    "erroProcessamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "documentos_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessoes_whatsapp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "instanceName" TEXT NOT NULL,
    "evolutionInstanceId" TEXT,
    "evolutionToken" TEXT,
    "numeroWhatsapp" TEXT,
    "nomeWhatsapp" TEXT,
    "status" "StatusConexao" NOT NULL DEFAULT 'DESCONECTADO',
    "ultimoStatus" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "ignorarGrupos" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessoes_whatsapp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "senha" TEXT NOT NULL,
    "papel" "PapelUsuario" NOT NULL DEFAULT 'CORRETOR',
    "avatar" TEXT,
    "telefone" TEXT,
    "estaAtivo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "ultimoLoginEm" TIMESTAMP(3),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cache_cpf" (
    "id" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "dados" JSONB NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'assertiva',
    "buscadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "contagemConsultas" INTEGER NOT NULL DEFAULT 1,
    "ultimoUsoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "primeiraConsultaPor" TEXT,

    CONSTRAINT "cache_cpf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultas_cpf" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "veioDoCache" BOOLEAN NOT NULL DEFAULT false,
    "custoParaNos" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cobradoDe" DECIMAL(65,30) NOT NULL,
    "lucro" DECIMAL(65,30) NOT NULL,
    "consultadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consultadoPor" TEXT,
    "cacheId" TEXT,

    CONSTRAINT "consultas_cpf_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empreendimentos_conhecimento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "nome" TEXT NOT NULL,
    "localizacao" TEXT NOT NULL,
    "cep" TEXT,
    "tipo" TEXT NOT NULL,
    "briefingCompleto" TEXT NOT NULL,
    "briefingEstruturado" JSONB NOT NULL,
    "confiabilidade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "embedding" vector(1536),
    "embeddingGeradoEm" TIMESTAMP(3),
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "validadoPor" TEXT,
    "validadoEm" TIMESTAMP(3),
    "versao" INTEGER NOT NULL DEFAULT 1,
    "ultimaAtualizacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vezesReutilizado" INTEGER NOT NULL DEFAULT 0,
    "ultimoUso" TIMESTAMP(3),
    "totalCampanhasVinculadas" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empreendimentos_conhecimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisas_manus" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomeEmpreendimento" TEXT NOT NULL,
    "construtora" TEXT,
    "endereco" TEXT,
    "bairro" TEXT,
    "cidade" TEXT NOT NULL,
    "estado" TEXT,
    "taskId" TEXT NOT NULL,
    "taskUrl" TEXT,
    "shareUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "erro" TEXT,
    "resultado" TEXT,
    "resultadoJson" JSONB,
    "creditosUsados" INTEGER,
    "campanhaId" TEXT,
    "empreendimentoId" TEXT,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "pesquisas_manus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campanhas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'MINERACAO',
    "parametrosBusca" JSONB,
    "empreendimentoId" TEXT,
    "nomeEmpreendimento" TEXT,
    "tipoImovel" TEXT,
    "localizacao" TEXT,
    "perfilImovel" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "briefingCompleto" TEXT,
    "briefingEstruturado" JSONB,
    "briefingGeradoEm" TIMESTAMP(3),
    "briefingConfiabilidade" DECIMAL(65,30),
    "briefingValidado" BOOLEAN NOT NULL DEFAULT false,
    "validadoPor" TEXT,
    "validadoEm" TIMESTAMP(3),
    "editadoPor" TEXT,
    "editadoEm" TIMESTAMP(3),
    "totalContatos" INTEGER NOT NULL DEFAULT 0,
    "totalLeads" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "configDisparo" JSONB,
    "responsavelCorretorId" TEXT,
    "fallbackCorretorId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campanhas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens_prospeccao" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "direcao" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'TEXTO',
    "telefone" TEXT,
    "messageId" TEXT,
    "processadaPorIA" BOOLEAN NOT NULL DEFAULT false,
    "respostaGerada" TEXT,
    "toolsChamadas" JSONB,
    "dataHora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mensagens_prospeccao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cpf" TEXT,
    "rg" TEXT,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT,
    "telefoneVerificado" BOOLEAN NOT NULL DEFAULT false,
    "dataNascimento" TIMESTAMP(3),
    "enderecoPrincipal" TEXT,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "campanhaOrigemId" TEXT,
    "primeiroContato" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaInteracao" TIMESTAMP(3),
    "status" "StatusLead" NOT NULL DEFAULT 'NOVO',
    "estagio" TEXT NOT NULL DEFAULT 'contato_inicial',
    "temperatura" "Temperatura" NOT NULL DEFAULT 'FRIO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "deletadoEm" TIMESTAMP(3),
    "enderecoImovel" TEXT,
    "tipoImovel" TEXT,
    "areaImovel" TEXT,
    "quartosImovel" INTEGER,
    "vagasImovel" INTEGER,
    "valorPretendido" TEXT,
    "ocupacaoImovel" TEXT,
    "interesseEm" TEXT,
    "bairroImovel" TEXT,
    "nomeEdificio" TEXT,
    "inscricaoIptu" TEXT,
    "valorVenal" TEXT,
    "apartamento" TEXT,
    "bloco" TEXT,
    "unidade" TEXT,
    "box" TEXT,
    "quadra" TEXT,
    "lote" TEXT,
    "areaTerreno" DECIMAL(65,30),
    "areaConstruida" DECIMAL(65,30),
    "anoConstituicao" INTEGER,
    "idade" INTEGER,
    "sexo" TEXT,
    "estadoCivil" TEXT,
    "cpfMae" TEXT,
    "nomeMae" TEXT,
    "escolaridade" TEXT,
    "situacaoCadastral" TEXT,
    "obitoProvavel" BOOLEAN NOT NULL DEFAULT false,
    "ppe" BOOLEAN NOT NULL DEFAULT false,
    "signo" TEXT,
    "rendaEstimada" TEXT,
    "faixaSalarial" TEXT,
    "scoreAssertiva" INTEGER,
    "scoreQualificacao" INTEGER,
    "perfilInvestidor" BOOLEAN NOT NULL DEFAULT false,
    "empresaAtual" TEXT,
    "cnpjEmpresa" TEXT,
    "profissao" TEXT,
    "setor" TEXT,
    "enderecoPessoal" TEXT,
    "tipoLogradouro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "cep" TEXT,
    "participacoesEmpresas" JSONB,
    "redesSociais" JSONB,
    "fonteEnriquecimento" TEXT,
    "enriquecidoEm" TIMESTAMP(3),
    "telefone2" TEXT,
    "telefone3" TEXT,
    "telefone4" TEXT,
    "telefone5" TEXT,
    "telefonesJson" JSONB,
    "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeWhatsapp" INTEGER NOT NULL DEFAULT 0,
    "email2" TEXT,
    "email3" TEXT,
    "email4" TEXT,
    "email5" TEXT,
    "emailsJson" JSONB,
    "statusProspeccao" TEXT,
    "tentativasContato" INTEGER NOT NULL DEFAULT 0,
    "ultimaTentativa" TIMESTAMP(3),
    "respondeu" BOOLEAN NOT NULL DEFAULT false,
    "primeiraResposta" TIMESTAMP(3),
    "manifestouInteresse" BOOLEAN NOT NULL DEFAULT false,
    "motivoDesinteresse" TEXT,
    "modoAtendimento" TEXT NOT NULL DEFAULT 'IA',
    "atendidoPor" TEXT,
    "pausadoEm" TIMESTAMP(3),
    "motivoPausa" TEXT,
    "dataRecontato" TIMESTAMP(3),
    "motivoRecontato" TEXT,
    "observacoes" TEXT,
    "briefingCloser" TEXT,
    "schemaState" JSONB,
    "situacaoAtual" TEXT,
    "tempoDecisao" TEXT,
    "tentativasAnteriores" TEXT,
    "comCorretorAtualmente" BOOLEAN,
    "motivacaoVenda" TEXT,
    "doresIdentificadas" TEXT[],
    "prazoDesejado" TEXT,
    "urgencia" "Urgencia",
    "consequencias" TEXT,
    "custosAtuais" TEXT,
    "pressaoTempo" BOOLEAN,
    "expectativaServico" TEXT,
    "objecoes" TEXT[],
    "interesseAvaliacao" BOOLEAN,
    "observacoesSpin" TEXT,
    "situacaoFinanceira" TEXT,
    "temDividas" BOOLEAN,
    "estadoConservacao" TEXT,
    "comissaoAcordada" TEXT,
    "tipoAutorizacao" TEXT,
    "prazoTrabalho" INTEGER,
    "autorizouAnuncio" BOOLEAN,
    "contratoUrl" TEXT,
    "dataAssinatura" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFim" TIMESTAMP(3),
    "ultimaAcaoIA" TEXT,
    "ultimaAcaoIAEm" TIMESTAMP(3),
    "imovelSuites" INTEGER,
    "imovelBanheiros" INTEGER,
    "imovelAreaTotal" DOUBLE PRECISION,
    "imovelAndar" INTEGER,
    "imovelCaracteristicas" TEXT[],
    "imovelDescricao" TEXT,
    "imovelFotos" TEXT[],
    "imovelValorLocacao" DOUBLE PRECISION,
    "imovelValorCondominio" DOUBLE PRECISION,
    "imovelValorIPTU" DOUBLE PRECISION,
    "dadosImovelColetadosEm" TIMESTAMP(3),
    "crmProprietarioId" INTEGER,
    "crmPropertyId" INTEGER,
    "crmPropertyCode" TEXT,
    "enviadoParaCrmEm" TIMESTAMP(3),
    "crmSyncStatus" TEXT,
    "crmSyncError" TEXT,
    "motivoPerda" TEXT,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "TipoContrato" NOT NULL DEFAULT 'CAPTACAO',
    "status" "StatusContrato" NOT NULL DEFAULT 'PENDENTE',
    "tokenAceite" TEXT NOT NULL,
    "hashDocumento" TEXT NOT NULL,
    "htmlConteudo" TEXT NOT NULL,
    "dadosSnapshot" TEXT,
    "geradoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviadoEm" TIMESTAMP(3),
    "aceiteEm" TIMESTAMP(3),
    "canceladoEm" TIMESTAMP(3),
    "vigenciaInicio" TIMESTAMP(3),
    "vigenciaFim" TIMESTAMP(3),
    "aceiteIp" TEXT,
    "aceiteUserAgent" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documentos_lead" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nomeOriginal" TEXT,
    "mimeType" TEXT NOT NULL,
    "tamanhoBytes" INTEGER,
    "s3Key" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'documento',
    "origem" TEXT NOT NULL DEFAULT 'whatsapp',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documentos_lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imoveis" (
    "id" TEXT NOT NULL,
    "inscricaoIptu" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "quadra" TEXT,
    "lote" TEXT,
    "codigoEdificio" INTEGER,
    "codigoBairro" INTEGER,
    "nomeEdificio" TEXT,
    "apartamento" TEXT,
    "bloco" TEXT,
    "unidade" TEXT,
    "box" TEXT,
    "tipoImovel" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "areaTerreno" DOUBLE PRECISION,
    "areaEdificada" DOUBLE PRECISION,
    "dataCadastroPref" TIMESTAMP(3),
    "nomeEmpresa" TEXT,
    "numeroPavimentos" INTEGER,
    "numeroElevadores" INTEGER,
    "vagasCobertas" INTEGER,
    "vagasDescobertas" INTEGER,
    "numeroGaragens" INTEGER,
    "tipoEdificacao1" INTEGER,
    "tipoEdificacao2" INTEGER,
    "posicaoEdificacao" INTEGER,
    "estrutura" INTEGER,
    "esquadrias" INTEGER,
    "piso" INTEGER,
    "forro" INTEGER,
    "instEletrica" INTEGER,
    "instSanitaria" INTEGER,
    "revestimentoInt" INTEGER,
    "acabamentoInt" INTEGER,
    "revestimentoExt" INTEGER,
    "acabamentoExt" INTEGER,
    "cobertura" INTEGER,
    "estadoConservacao" INTEGER,
    "certidaoCache" JSONB,
    "certidaoBuscadaEm" TIMESTAMP(3),
    "leadId" TEXT,
    "statusCaptacao" TEXT NOT NULL DEFAULT 'IDENTIFICADO',
    "interesse" TEXT,
    "cpfProprietario" TEXT,
    "cpfVerificadoEm" TIMESTAMP(3),
    "histProprietarios" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "imoveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bairros_geo" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "ehCondominio" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bairros_geo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edificios_geo" (
    "id" TEXT NOT NULL,
    "codigo" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "logradouro" TEXT,
    "codigoBairro" INTEGER,
    "totalUnidades" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "edificios_geo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sincronizacoes_mapa" (
    "id" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'manual',
    "status" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
    "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidoEm" TIMESTAMP(3),
    "duracaoMs" INTEGER,
    "totalBairros" INTEGER NOT NULL DEFAULT 0,
    "totalEdificios" INTEGER NOT NULL DEFAULT 0,
    "totalUnidades" INTEGER NOT NULL DEFAULT 0,
    "mensagem" TEXT,
    "detalhesErro" JSONB,

    CONSTRAINT "sincronizacoes_mapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "imoveis_rancho" (
    "id" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "inscricao_cartografica" TEXT NOT NULL,
    "id_lote" INTEGER,
    "numero_cadastro" INTEGER,
    "cpf_cnpj" TEXT,
    "nome_pessoa" TEXT,
    "tipo_pessoa" INTEGER,
    "endereco" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "sincronizado_em" TIMESTAMP(3) NOT NULL,
    "atualizado_em" TIMESTAMP(3) NOT NULL,
    "complemento" TEXT,
    "logradouro" TEXT,
    "area_construida" DOUBLE PRECISION,
    "area_terreno" DOUBLE PRECISION,
    "tipo_edificacao" INTEGER,
    "nr_lote" TEXT,
    "id_bairro" INTEGER,
    "id_quadra" INTEGER,
    "id_setor" INTEGER,
    "raw" JSONB,
    "versao_enriquecimento" INTEGER NOT NULL DEFAULT 0,
    "detalhe_em" TIMESTAMP(3),
    "propriedad_mapa" INTEGER,
    "status_proprietario" TEXT,
    "fonte_proprietario" TEXT,
    "enriquecido_em" TIMESTAMP(3),

    CONSTRAINT "imoveis_rancho_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividades" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tipo" "TipoAtividade" NOT NULL,
    "canal" TEXT,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "duracao" INTEGER,
    "gravacao" TEXT,
    "mensagem" TEXT,
    "resultado" TEXT,
    "agendadoPara" TIMESTAMP(3),
    "completadoEm" TIMESTAMP(3),
    "criadoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "statusAgendamento" "StatusAgendamento" DEFAULT 'PENDENTE',
    "tokenConfirmacao" TEXT,
    "confirmacoesEnviadas" INTEGER NOT NULL DEFAULT 0,
    "confirmadoPor" TEXT,
    "confirmadoEm" TIMESTAMP(3),
    "canceladoPor" TEXT,
    "canceladoEm" TIMESTAMP(3),
    "motivoCancelamento" TEXT,
    "statusConfirmacaoCorretor" "StatusConfirmacaoCorretor" DEFAULT 'PENDENTE',
    "tokenConfirmacaoCorretor" TEXT,
    "confirmacaoCorretorSolicitadaEm" TIMESTAMP(3),
    "lembreteCorretorEnviadoEm" TIMESTAMP(3),
    "confirmadoCorretorEm" TIMESTAMP(3),
    "expiradoCorretorEm" TIMESTAMP(3),
    "remanejadoCorretorEm" TIMESTAMP(3),
    "corretorOriginalId" TEXT,
    "corretorAtualId" TEXT,

    CONSTRAINT "atividades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "numeroOrigem" TEXT NOT NULL,
    "estadoConversa" TEXT NOT NULL DEFAULT 'ativa',
    "contexto" JSONB NOT NULL,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimaMensagemEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizadaEm" TIMESTAMP(3),
    "faseSPIN" TEXT,
    "dadosColetados" JSONB,
    "tentativasRecovery" INTEGER NOT NULL DEFAULT 0,
    "podeQualificar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "conversas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mensagens" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "remetente" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'texto',
    "metadata" JSONB,
    "enviadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lidaEm" TIMESTAMP(3),

    CONSTRAINT "mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversas_embeddings" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT,
    "leadId" TEXT,
    "tenantId" TEXT NOT NULL,
    "textoOriginal" TEXT NOT NULL,
    "tipoConteudo" TEXT NOT NULL,
    "metadados" JSONB,
    "embedding" vector(1536),
    "embeddingModelo" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "scoreQualidade" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "vezesUtilizado" INTEGER NOT NULL DEFAULT 0,
    "feedbackPositivo" INTEGER NOT NULL DEFAULT 0,
    "feedbackNegativo" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversas_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conhecimento_curado" (
    "id" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "subcategoria" TEXT,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "contextoUso" TEXT NOT NULL,
    "exemplo" TEXT,
    "tipoImovel" TEXT[],
    "faixaPreco" TEXT,
    "tipoNegocio" TEXT[],
    "scoreEficacia" DECIMAL(65,30) NOT NULL DEFAULT 80,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "embedding" TEXT,
    "embeddingModelo" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "criadoPor" TEXT,
    "fonte" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conhecimento_curado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "nomeEdificio" TEXT NOT NULL,
    "localizacao" TEXT,
    "cep" TEXT,
    "totalContatos" INTEGER NOT NULL DEFAULT 0,
    "totalEnriquecidos" INTEGER NOT NULL DEFAULT 0,
    "totalComWhatsapp" INTEGER NOT NULL DEFAULT 0,
    "totalUsados" INTEGER NOT NULL DEFAULT 0,
    "dadosPesquisa" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contatos_lista" (
    "id" TEXT NOT NULL,
    "listaId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "inscricaoIptu" TEXT,
    "unidade" TEXT,
    "box" TEXT,
    "enderecoImovel" TEXT,
    "bairroImovel" TEXT,
    "telefone" TEXT,
    "telefone2" TEXT,
    "telefone3" TEXT,
    "telefone4" TEXT,
    "telefone5" TEXT,
    "telefonesJson" JSONB,
    "email" TEXT,
    "email2" TEXT,
    "email3" TEXT,
    "email4" TEXT,
    "email5" TEXT,
    "emailsJson" JSONB,
    "temWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "quantidadeWhatsapp" INTEGER NOT NULL DEFAULT 0,
    "usadoEmCampanha" BOOLEAN NOT NULL DEFAULT false,
    "campanhaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contatos_lista_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telefones_blacklist" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "telefone" TEXT NOT NULL,
    "motivo" TEXT NOT NULL,
    "nomeContato" TEXT,
    "campanhaOrigem" TEXT,
    "observacoes" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telefones_blacklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metricas_mensagens" (
    "id" TEXT NOT NULL,
    "mensagemId" TEXT,
    "conversaId" TEXT,
    "leadId" TEXT,
    "tenantId" TEXT NOT NULL,
    "mensagemUsuario" TEXT,
    "respostaGerada" TEXT,
    "workerUsado" TEXT NOT NULL,
    "modoOperacao" TEXT NOT NULL DEFAULT 'PASSIVO',
    "confianca" INTEGER NOT NULL DEFAULT 0,
    "relevancia" INTEGER NOT NULL DEFAULT 0,
    "tom" TEXT NOT NULL DEFAULT 'ADEQUADO',
    "riscoEscalacao" INTEGER NOT NULL DEFAULT 0,
    "acaoSupervisor" TEXT NOT NULL DEFAULT 'ENVIAR',
    "foiRefinada" BOOLEAN NOT NULL DEFAULT false,
    "foiEscalada" BOOLEAN NOT NULL DEFAULT false,
    "alertaCorretor" BOOLEAN NOT NULL DEFAULT false,
    "tempoProcessamentoMs" INTEGER,
    "tokensUsados" INTEGER,
    "custoEstimado" DECIMAL(65,30),
    "toolsChamadas" JSONB,
    "temperaturaLead" TEXT,
    "processadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metricas_mensagens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aprendizados_agente" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contexto" TEXT NOT NULL,
    "contextoHash" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "recompensa" DOUBLE PRECISION NOT NULL,
    "metadados" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aprendizados_agente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auditorias_replay_aprendizado" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "executadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'SUCESSO',
    "erro" TEXT,
    "periodoRecenteHoras" INTEGER NOT NULL DEFAULT 24,
    "janelaHistoricaDias" INTEGER NOT NULL DEFAULT 90,
    "amostraRecente" INTEGER NOT NULL DEFAULT 0,
    "amostraHistorica" INTEGER NOT NULL DEFAULT 0,
    "totalAmostras" INTEGER NOT NULL DEFAULT 0,
    "padroesAvaliados" INTEGER NOT NULL DEFAULT 0,
    "padroesAjustados" INTEGER NOT NULL DEFAULT 0,
    "taxaRecente" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxaHistorica" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ajusteTotalAbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ajusteMaxPorPadrao" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limiteDerivaExecucaoAbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "resumoOutcomes" JSONB,
    "ajustesAplicados" JSONB,
    "duracaoMs" INTEGER,

    CONSTRAINT "auditorias_replay_aprendizado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paol_politicas" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contextoHash" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "emaRecompensa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "emaSucesso" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amostra" INTEGER NOT NULL DEFAULT 0,
    "ultimaRecompensa" DOUBLE PRECISION,
    "ultimoOutcome" TEXT,
    "ultimaOrigem" TEXT,
    "ultimoFallback" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paol_politicas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alertas_corretor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "conversaId" TEXT,
    "tipo" TEXT NOT NULL,
    "prioridade" TEXT NOT NULL DEFAULT 'MEDIA',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "contexto" JSONB,
    "riscoEscalacao" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "visualizadoEm" TIMESTAMP(3),
    "atendidoEm" TIMESTAMP(3),
    "atendidoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alertas_corretor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transacoes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoTransacao" NOT NULL,
    "descricao" TEXT,
    "valor" DECIMAL(65,30) NOT NULL,
    "creditos" INTEGER NOT NULL,
    "tipoCredito" "TipoCredito" NOT NULL,
    "asaasPagamentoId" TEXT,
    "asaasAssinaturaId" TEXT,
    "metodoPagamento" "MetodoPagamento",
    "promocaoAplicada" TEXT,
    "creditosBonus" INTEGER NOT NULL DEFAULT 0,
    "status" "StatusTransacao" NOT NULL DEFAULT 'PENDENTE',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmadoEm" TIMESTAMP(3),

    CONSTRAINT "transacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pacotes" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "creditos" INTEGER NOT NULL,
    "valor" DECIMAL(65,30) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "descricao" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pacotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "renovacoes_log" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planoAnterior" "PlanoTipo" NOT NULL,
    "planoNovo" "PlanoTipo" NOT NULL,
    "creditosExpirados" INTEGER NOT NULL,
    "creditosNovos" INTEGER NOT NULL,
    "renovadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "renovacoes_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "endereco" TEXT,
    "origemLeadId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_scraper_iptu" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "inscricao" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "mensagemErro" TEXT,
    "dataTentativa" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jobId" TEXT,

    CONSTRAINT "logs_scraper_iptu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs_auditoria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT,
    "entidadeId" TEXT,
    "detalhes" JSONB,
    "ip" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_eventos" (
    "id" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "maxTentativas" INTEGER NOT NULL DEFAULT 5,
    "proximaTentativaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseAte" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "ultimoErro" TEXT,
    "replayCount" INTEGER NOT NULL DEFAULT 0,
    "ultimoReplayEm" TIMESTAMP(3),
    "ultimoReplayPor" TEXT,
    "ultimoReplayMotivo" TEXT,
    "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "webhook_eventos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_slug_idx" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "configuracoes_integracao_tenantId_idx" ON "configuracoes_integracao"("tenantId");

-- CreateIndex
CREATE INDEX "configuracoes_integracao_tipo_idx" ON "configuracoes_integracao"("tipo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_integracao_tenantId_tipo_key" ON "configuracoes_integracao"("tenantId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "configuracoes_agente_sessaoWhatsappId_key" ON "configuracoes_agente"("sessaoWhatsappId");

-- CreateIndex
CREATE INDEX "configuracoes_agente_tenantId_idx" ON "configuracoes_agente"("tenantId");

-- CreateIndex
CREATE INDEX "documentos_agente_agenteId_idx" ON "documentos_agente"("agenteId");

-- CreateIndex
CREATE UNIQUE INDEX "sessoes_whatsapp_instanceName_key" ON "sessoes_whatsapp"("instanceName");

-- CreateIndex
CREATE INDEX "sessoes_whatsapp_tenantId_idx" ON "sessoes_whatsapp"("tenantId");

-- CreateIndex
CREATE INDEX "sessoes_whatsapp_instanceName_idx" ON "sessoes_whatsapp"("instanceName");

-- CreateIndex
CREATE INDEX "usuarios_email_idx" ON "usuarios"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON "usuarios"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "cache_cpf_cpf_key" ON "cache_cpf"("cpf");

-- CreateIndex
CREATE INDEX "cache_cpf_cpf_idx" ON "cache_cpf"("cpf");

-- CreateIndex
CREATE INDEX "cache_cpf_expiraEm_idx" ON "cache_cpf"("expiraEm");

-- CreateIndex
CREATE INDEX "consultas_cpf_tenantId_idx" ON "consultas_cpf"("tenantId");

-- CreateIndex
CREATE INDEX "consultas_cpf_cpf_idx" ON "consultas_cpf"("cpf");

-- CreateIndex
CREATE INDEX "consultas_cpf_consultadoEm_idx" ON "consultas_cpf"("consultadoEm");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_nome_idx" ON "empreendimentos_conhecimento"("nome");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_cep_idx" ON "empreendimentos_conhecimento"("cep");

-- CreateIndex
CREATE INDEX "empreendimentos_conhecimento_validado_idx" ON "empreendimentos_conhecimento"("validado");

-- CreateIndex
CREATE UNIQUE INDEX "empreendimentos_conhecimento_nome_localizacao_key" ON "empreendimentos_conhecimento"("nome", "localizacao");

-- CreateIndex
CREATE UNIQUE INDEX "pesquisas_manus_taskId_key" ON "pesquisas_manus"("taskId");

-- CreateIndex
CREATE INDEX "pesquisas_manus_tenantId_status_idx" ON "pesquisas_manus"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pesquisas_manus_taskId_idx" ON "pesquisas_manus"("taskId");

-- CreateIndex
CREATE INDEX "pesquisas_manus_campanhaId_idx" ON "pesquisas_manus"("campanhaId");

-- CreateIndex
CREATE INDEX "campanhas_tenantId_status_idx" ON "campanhas"("tenantId", "status");

-- CreateIndex
CREATE INDEX "campanhas_empreendimentoId_idx" ON "campanhas"("empreendimentoId");

-- CreateIndex
CREATE INDEX "campanhas_responsavelCorretorId_idx" ON "campanhas"("responsavelCorretorId");

-- CreateIndex
CREATE INDEX "campanhas_fallbackCorretorId_idx" ON "campanhas"("fallbackCorretorId");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_leadId_idx" ON "mensagens_prospeccao"("leadId");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_leadId_dataHora_idx" ON "mensagens_prospeccao"("leadId", "dataHora");

-- CreateIndex
CREATE INDEX "mensagens_prospeccao_direcao_idx" ON "mensagens_prospeccao"("direcao");

-- CreateIndex
CREATE INDEX "leads_tenantId_idx" ON "leads"("tenantId");

-- CreateIndex
CREATE INDEX "leads_tenantId_cpf_idx" ON "leads"("tenantId", "cpf");

-- CreateIndex
CREATE INDEX "leads_cpf_idx" ON "leads"("cpf");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "leads_tenantId_status_atualizadoEm_idx" ON "leads"("tenantId", "status", "atualizadoEm");

-- CreateIndex
CREATE INDEX "leads_telefone_idx" ON "leads"("telefone");

-- CreateIndex
CREATE INDEX "leads_urgencia_idx" ON "leads"("urgencia");

-- CreateIndex
CREATE INDEX "leads_campanhaOrigemId_statusProspeccao_idx" ON "leads"("campanhaOrigemId", "statusProspeccao");

-- CreateIndex
CREATE INDEX "leads_statusProspeccao_idx" ON "leads"("statusProspeccao");

-- CreateIndex
CREATE INDEX "leads_modoAtendimento_idx" ON "leads"("modoAtendimento");

-- CreateIndex
CREATE INDEX "leads_dataRecontato_idx" ON "leads"("dataRecontato");

-- CreateIndex
CREATE INDEX "leads_tentativasContato_idx" ON "leads"("tentativasContato");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_tokenAceite_key" ON "contratos"("tokenAceite");

-- CreateIndex
CREATE INDEX "contratos_tenantId_idx" ON "contratos"("tenantId");

-- CreateIndex
CREATE INDEX "contratos_leadId_idx" ON "contratos"("leadId");

-- CreateIndex
CREATE INDEX "contratos_tokenAceite_idx" ON "contratos"("tokenAceite");

-- CreateIndex
CREATE INDEX "contratos_status_idx" ON "contratos"("status");

-- CreateIndex
CREATE INDEX "documentos_lead_leadId_idx" ON "documentos_lead"("leadId");

-- CreateIndex
CREATE INDEX "documentos_lead_tenantId_idx" ON "documentos_lead"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_inscricaoIptu_key" ON "imoveis"("inscricaoIptu");

-- CreateIndex
CREATE INDEX "imoveis_inscricaoIptu_idx" ON "imoveis"("inscricaoIptu");

-- CreateIndex
CREATE INDEX "imoveis_cpfProprietario_idx" ON "imoveis"("cpfProprietario");

-- CreateIndex
CREATE INDEX "imoveis_bairro_idx" ON "imoveis"("bairro");

-- CreateIndex
CREATE INDEX "imoveis_codigoEdificio_idx" ON "imoveis"("codigoEdificio");

-- CreateIndex
CREATE INDEX "imoveis_codigoBairro_idx" ON "imoveis"("codigoBairro");

-- CreateIndex
CREATE INDEX "imoveis_leadId_idx" ON "imoveis"("leadId");

-- CreateIndex
CREATE UNIQUE INDEX "bairros_geo_codigo_key" ON "bairros_geo"("codigo");

-- CreateIndex
CREATE INDEX "bairros_geo_nome_idx" ON "bairros_geo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "edificios_geo_codigo_key" ON "edificios_geo"("codigo");

-- CreateIndex
CREATE INDEX "edificios_geo_nome_idx" ON "edificios_geo"("nome");

-- CreateIndex
CREATE INDEX "edificios_geo_codigoBairro_idx" ON "edificios_geo"("codigoBairro");

-- CreateIndex
CREATE INDEX "sincronizacoes_mapa_status_idx" ON "sincronizacoes_mapa"("status");

-- CreateIndex
CREATE INDEX "sincronizacoes_mapa_iniciadoEm_idx" ON "sincronizacoes_mapa"("iniciadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "imoveis_rancho_inscricao_cartografica_key" ON "imoveis_rancho"("inscricao_cartografica");

-- CreateIndex
CREATE INDEX "imoveis_rancho_cpf_cnpj_idx" ON "imoveis_rancho"("cpf_cnpj");

-- CreateIndex
CREATE INDEX "imoveis_rancho_cidade_id_setor_id_quadra_idx" ON "imoveis_rancho"("cidade", "id_setor", "id_quadra");

-- CreateIndex
CREATE INDEX "imoveis_rancho_id_bairro_idx" ON "imoveis_rancho"("id_bairro");

-- CreateIndex
CREATE INDEX "imoveis_rancho_status_proprietario_idx" ON "imoveis_rancho"("status_proprietario");

-- CreateIndex
CREATE UNIQUE INDEX "atividades_tokenConfirmacao_key" ON "atividades"("tokenConfirmacao");

-- CreateIndex
CREATE UNIQUE INDEX "atividades_tokenConfirmacaoCorretor_key" ON "atividades"("tokenConfirmacaoCorretor");

-- CreateIndex
CREATE INDEX "atividades_leadId_idx" ON "atividades"("leadId");

-- CreateIndex
CREATE INDEX "atividades_tipo_idx" ON "atividades"("tipo");

-- CreateIndex
CREATE INDEX "atividades_agendadoPara_idx" ON "atividades"("agendadoPara");

-- CreateIndex
CREATE INDEX "atividades_statusAgendamento_idx" ON "atividades"("statusAgendamento");

-- CreateIndex
CREATE INDEX "atividades_tokenConfirmacao_idx" ON "atividades"("tokenConfirmacao");

-- CreateIndex
CREATE INDEX "atividades_statusConfirmacaoCorretor_idx" ON "atividades"("statusConfirmacaoCorretor");

-- CreateIndex
CREATE INDEX "atividades_tokenConfirmacaoCorretor_idx" ON "atividades"("tokenConfirmacaoCorretor");

-- CreateIndex
CREATE INDEX "atividades_lembreteCorretorEnviadoEm_idx" ON "atividades"("lembreteCorretorEnviadoEm");

-- CreateIndex
CREATE INDEX "atividades_corretorOriginalId_idx" ON "atividades"("corretorOriginalId");

-- CreateIndex
CREATE INDEX "atividades_corretorAtualId_idx" ON "atividades"("corretorAtualId");

-- CreateIndex
CREATE INDEX "conversas_leadId_idx" ON "conversas"("leadId");

-- CreateIndex
CREATE INDEX "conversas_numeroOrigem_idx" ON "conversas"("numeroOrigem");

-- CreateIndex
CREATE INDEX "conversas_estadoConversa_idx" ON "conversas"("estadoConversa");

-- CreateIndex
CREATE INDEX "conversas_faseSPIN_idx" ON "conversas"("faseSPIN");

-- CreateIndex
CREATE INDEX "mensagens_conversaId_idx" ON "mensagens"("conversaId");

-- CreateIndex
CREATE INDEX "mensagens_enviadaEm_idx" ON "mensagens"("enviadaEm");

-- CreateIndex
CREATE INDEX "conversas_embeddings_tenantId_idx" ON "conversas_embeddings"("tenantId");

-- CreateIndex
CREATE INDEX "conversas_embeddings_tipoConteudo_idx" ON "conversas_embeddings"("tipoConteudo");

-- CreateIndex
CREATE INDEX "conversas_embeddings_conversaId_idx" ON "conversas_embeddings"("conversaId");

-- CreateIndex
CREATE INDEX "conversas_embeddings_leadId_idx" ON "conversas_embeddings"("leadId");

-- CreateIndex
CREATE INDEX "conhecimento_curado_categoria_idx" ON "conhecimento_curado"("categoria");

-- CreateIndex
CREATE INDEX "conhecimento_curado_subcategoria_idx" ON "conhecimento_curado"("subcategoria");

-- CreateIndex
CREATE INDEX "conhecimento_curado_ativo_idx" ON "conhecimento_curado"("ativo");

-- CreateIndex
CREATE INDEX "listas_tenantId_idx" ON "listas"("tenantId");

-- CreateIndex
CREATE INDEX "listas_nomeEdificio_idx" ON "listas"("nomeEdificio");

-- CreateIndex
CREATE INDEX "contatos_lista_listaId_idx" ON "contatos_lista"("listaId");

-- CreateIndex
CREATE INDEX "contatos_lista_usadoEmCampanha_idx" ON "contatos_lista"("usadoEmCampanha");

-- CreateIndex
CREATE UNIQUE INDEX "contatos_lista_listaId_cpf_key" ON "contatos_lista"("listaId", "cpf");

-- CreateIndex
CREATE INDEX "telefones_blacklist_telefone_idx" ON "telefones_blacklist"("telefone");

-- CreateIndex
CREATE INDEX "telefones_blacklist_tenantId_idx" ON "telefones_blacklist"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "telefones_blacklist_tenantId_telefone_key" ON "telefones_blacklist"("tenantId", "telefone");

-- CreateIndex
CREATE INDEX "metricas_mensagens_tenantId_idx" ON "metricas_mensagens"("tenantId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_leadId_idx" ON "metricas_mensagens"("leadId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_conversaId_idx" ON "metricas_mensagens"("conversaId");

-- CreateIndex
CREATE INDEX "metricas_mensagens_workerUsado_idx" ON "metricas_mensagens"("workerUsado");

-- CreateIndex
CREATE INDEX "metricas_mensagens_acaoSupervisor_idx" ON "metricas_mensagens"("acaoSupervisor");

-- CreateIndex
CREATE INDEX "metricas_mensagens_processadoEm_idx" ON "metricas_mensagens"("processadoEm");

-- CreateIndex
CREATE INDEX "aprendizados_agente_tenantId_idx" ON "aprendizados_agente"("tenantId");

-- CreateIndex
CREATE INDEX "aprendizados_agente_tenantId_contextoHash_idx" ON "aprendizados_agente"("tenantId", "contextoHash");

-- CreateIndex
CREATE INDEX "aprendizados_agente_tenantId_criadoEm_idx" ON "aprendizados_agente"("tenantId", "criadoEm");

-- CreateIndex
CREATE INDEX "aprendizados_agente_tenantId_contextoHash_acao_idx" ON "aprendizados_agente"("tenantId", "contextoHash", "acao");

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_tenantId_idx" ON "auditorias_replay_aprendizado"("tenantId");

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_tenantId_executadoEm_idx" ON "auditorias_replay_aprendizado"("tenantId", "executadoEm");

-- CreateIndex
CREATE INDEX "auditorias_replay_aprendizado_status_executadoEm_idx" ON "auditorias_replay_aprendizado"("status", "executadoEm");

-- CreateIndex
CREATE INDEX "paol_politicas_tenantId_contextoHash_idx" ON "paol_politicas"("tenantId", "contextoHash");

-- CreateIndex
CREATE INDEX "paol_politicas_tenantId_atualizadoEm_idx" ON "paol_politicas"("tenantId", "atualizadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "paol_politicas_tenantId_contextoHash_acao_key" ON "paol_politicas"("tenantId", "contextoHash", "acao");

-- CreateIndex
CREATE INDEX "alertas_corretor_tenantId_idx" ON "alertas_corretor"("tenantId");

-- CreateIndex
CREATE INDEX "alertas_corretor_status_idx" ON "alertas_corretor"("status");

-- CreateIndex
CREATE INDEX "alertas_corretor_prioridade_idx" ON "alertas_corretor"("prioridade");

-- CreateIndex
CREATE INDEX "alertas_corretor_criadoEm_idx" ON "alertas_corretor"("criadoEm");

-- CreateIndex
CREATE INDEX "transacoes_tenantId_idx" ON "transacoes"("tenantId");

-- CreateIndex
CREATE INDEX "transacoes_status_idx" ON "transacoes"("status");

-- CreateIndex
CREATE INDEX "transacoes_criadoEm_idx" ON "transacoes"("criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "pacotes_slug_key" ON "pacotes"("slug");

-- CreateIndex
CREATE INDEX "renovacoes_log_tenantId_idx" ON "renovacoes_log"("tenantId");

-- CreateIndex
CREATE INDEX "renovacoes_log_renovadoEm_idx" ON "renovacoes_log"("renovadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_origemLeadId_key" ON "clientes"("origemLeadId");

-- CreateIndex
CREATE INDEX "clientes_tenantId_idx" ON "clientes"("tenantId");

-- CreateIndex
CREATE INDEX "clientes_cpf_idx" ON "clientes"("cpf");

-- CreateIndex
CREATE INDEX "clientes_email_idx" ON "clientes"("email");

-- CreateIndex
CREATE INDEX "logs_scraper_iptu_tenantId_idx" ON "logs_scraper_iptu"("tenantId");

-- CreateIndex
CREATE INDEX "logs_scraper_iptu_inscricao_idx" ON "logs_scraper_iptu"("inscricao");

-- CreateIndex
CREATE INDEX "logs_scraper_iptu_status_idx" ON "logs_scraper_iptu"("status");

-- CreateIndex
CREATE INDEX "logs_auditoria_tenantId_idx" ON "logs_auditoria"("tenantId");

-- CreateIndex
CREATE INDEX "logs_auditoria_usuarioId_idx" ON "logs_auditoria"("usuarioId");

-- CreateIndex
CREATE INDEX "logs_auditoria_acao_idx" ON "logs_auditoria"("acao");

-- CreateIndex
CREATE INDEX "logs_auditoria_criadoEm_idx" ON "logs_auditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "webhook_eventos_provedor_recebidoEm_idx" ON "webhook_eventos"("provedor", "recebidoEm");

-- CreateIndex
CREATE INDEX "webhook_eventos_status_proximaTentativaEm_idx" ON "webhook_eventos"("status", "proximaTentativaEm");

-- CreateIndex
CREATE INDEX "webhook_eventos_status_leaseAte_idx" ON "webhook_eventos"("status", "leaseAte");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_eventos_provedor_eventoId_key" ON "webhook_eventos"("provedor", "eventoId");

-- AddForeignKey
ALTER TABLE "configuracoes_integracao" ADD CONSTRAINT "configuracoes_integracao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_agente" ADD CONSTRAINT "configuracoes_agente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "configuracoes_agente" ADD CONSTRAINT "configuracoes_agente_sessaoWhatsappId_fkey" FOREIGN KEY ("sessaoWhatsappId") REFERENCES "sessoes_whatsapp"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_agente" ADD CONSTRAINT "documentos_agente_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "configuracoes_agente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessoes_whatsapp" ADD CONSTRAINT "sessoes_whatsapp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultas_cpf" ADD CONSTRAINT "consultas_cpf_cacheId_fkey" FOREIGN KEY ("cacheId") REFERENCES "cache_cpf"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "empreendimentos_conhecimento" ADD CONSTRAINT "empreendimentos_conhecimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisas_manus" ADD CONSTRAINT "pesquisas_manus_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES "empreendimentos_conhecimento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_responsavelCorretorId_fkey" FOREIGN KEY ("responsavelCorretorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campanhas" ADD CONSTRAINT "campanhas_fallbackCorretorId_fkey" FOREIGN KEY ("fallbackCorretorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens_prospeccao" ADD CONSTRAINT "mensagens_prospeccao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_campanhaOrigemId_fkey" FOREIGN KEY ("campanhaOrigemId") REFERENCES "campanhas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos_lead" ADD CONSTRAINT "documentos_lead_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_codigoEdificio_fkey" FOREIGN KEY ("codigoEdificio") REFERENCES "edificios_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "imoveis" ADD CONSTRAINT "imoveis_codigoBairro_fkey" FOREIGN KEY ("codigoBairro") REFERENCES "bairros_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edificios_geo" ADD CONSTRAINT "edificios_geo_codigoBairro_fkey" FOREIGN KEY ("codigoBairro") REFERENCES "bairros_geo"("codigo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividades" ADD CONSTRAINT "atividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversas" ADD CONSTRAINT "conversas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mensagens" ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "conversas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listas" ADD CONSTRAINT "listas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contatos_lista" ADD CONSTRAINT "contatos_lista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES "listas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telefones_blacklist" ADD CONSTRAINT "telefones_blacklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aprendizados_agente" ADD CONSTRAINT "aprendizados_agente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditorias_replay_aprendizado" ADD CONSTRAINT "auditorias_replay_aprendizado_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "paol_politicas" ADD CONSTRAINT "paol_politicas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transacoes" ADD CONSTRAINT "transacoes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "renovacoes_log" ADD CONSTRAINT "renovacoes_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_origemLeadId_fkey" FOREIGN KEY ("origemLeadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_scraper_iptu" ADD CONSTRAINT "logs_scraper_iptu_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "logs_auditoria" ADD CONSTRAINT "logs_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
