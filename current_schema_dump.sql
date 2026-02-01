--
-- PostgreSQL database dump
--

\restrict Aj4hj6bnpkyOmVtJ3BlrboNo9bwoSu2ttlDuJewN0PcZTEACRct2TJ50C28Oed3

-- Dumped from database version 15.15
-- Dumped by pg_dump version 15.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: ModoCriacao; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ModoCriacao" AS ENUM (
    'PRE_TREINADO',
    'PERSONALIZADO'
);


--
-- Name: PapelUsuario; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PapelUsuario" AS ENUM (
    'SUPER_ADMIN',
    'ADMIN',
    'CORRETOR',
    'VISUALIZADOR'
);


--
-- Name: StatusAgente; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusAgente" AS ENUM (
    'RASCUNHO',
    'ATIVO',
    'PAUSADO'
);


--
-- Name: StatusDocumento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusDocumento" AS ENUM (
    'PENDENTE',
    'PROCESSANDO',
    'SUCESSO',
    'ERRO'
);


--
-- Name: StatusLead; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusLead" AS ENUM (
    'NOVO',
    'CONTATANDO',
    'QUALIFICADO',
    'EM_NEGOCIACAO',
    'CONVERTIDO',
    'PERDIDO',
    'INATIVO'
);


--
-- Name: StatusTenant; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StatusTenant" AS ENUM (
    'ATIVO',
    'SUSPENSO',
    'CANCELADO'
);


--
-- Name: Temperatura; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."Temperatura" AS ENUM (
    'FRIO',
    'MORNO',
    'QUENTE'
);


--
-- Name: TipoAgente; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoAgente" AS ENUM (
    'SDR_VENDAS',
    'SDR_LOCACAO',
    'SDR_CAPTACAO',
    'DOCUMENTOS',
    'PERSONALIZADO'
);


--
-- Name: TipoAtividade; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."TipoAtividade" AS ENUM (
    'LIGACAO',
    'WHATSAPP',
    'EMAIL',
    'NOTA',
    'REUNIAO',
    'TAREFA'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: alertas_corretor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alertas_corretor (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "leadId" text,
    "conversaId" text,
    tipo text NOT NULL,
    prioridade text DEFAULT 'MEDIA'::text NOT NULL,
    titulo text NOT NULL,
    descricao text NOT NULL,
    contexto jsonb,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    "visualizadoEm" timestamp(3) without time zone,
    "atendidoEm" timestamp(3) without time zone,
    "atendidoPor" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: atividades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.atividades (
    id text NOT NULL,
    "leadId" text NOT NULL,
    tipo public."TipoAtividade" NOT NULL,
    canal text,
    titulo text NOT NULL,
    descricao text,
    duracao integer,
    gravacao text,
    mensagem text,
    resultado text,
    "agendadoPara" timestamp(3) without time zone,
    "completadoEm" timestamp(3) without time zone,
    "criadoPor" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: cache_cpf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cache_cpf (
    id text NOT NULL,
    cpf text NOT NULL,
    dados jsonb NOT NULL,
    fonte text DEFAULT 'assertiva'::text NOT NULL,
    "buscadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiraEm" timestamp(3) without time zone NOT NULL,
    "contagemConsultas" integer DEFAULT 1 NOT NULL,
    "ultimoUsoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "primeiraConsultaPor" text
);


--
-- Name: campanhas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campanhas (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    nome text NOT NULL,
    descricao text,
    tipo text DEFAULT 'MINERACAO'::text NOT NULL,
    "parametrosBusca" jsonb,
    "totalContatos" integer DEFAULT 0 NOT NULL,
    "totalLeads" integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'ATIVA'::text NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "briefingCompleto" text,
    "briefingConfiabilidade" numeric(65,30),
    "briefingEstruturado" jsonb,
    "briefingGeradoEm" timestamp(3) without time zone,
    localizacao text,
    "nomeEmpreendimento" text,
    "perfilImovel" text,
    "tipoImovel" text,
    "briefingValidado" boolean DEFAULT false NOT NULL,
    "editadoEm" timestamp(3) without time zone,
    "editadoPor" text,
    "validadoEm" timestamp(3) without time zone,
    "validadoPor" text,
    "empreendimentoId" text,
    bairro text,
    cep text,
    cidade text,
    complemento text,
    estado text,
    logradouro text,
    numero text,
    "configDisparo" jsonb
);


--
-- Name: configuracoes_agente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracoes_agente (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    nome text NOT NULL,
    avatar text,
    personalidade jsonb NOT NULL,
    expertise jsonb NOT NULL,
    scripts jsonb NOT NULL,
    "regrasNegocio" jsonb NOT NULL,
    "estaAtivo" boolean DEFAULT false NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    genero text DEFAULT 'feminino'::text NOT NULL,
    "modoCreacao" public."ModoCriacao" DEFAULT 'PRE_TREINADO'::public."ModoCriacao" NOT NULL,
    "promptCustomizado" text,
    status public."StatusAgente" DEFAULT 'RASCUNHO'::public."StatusAgente" NOT NULL,
    "templateBase" text,
    "termosAceitos" boolean DEFAULT false NOT NULL,
    "termosAceitosEm" timestamp(3) without time zone,
    "termosVersao" text,
    "tipoAgente" public."TipoAgente" DEFAULT 'SDR_CAPTACAO'::public."TipoAgente" NOT NULL,
    "toolsCustomizadas" jsonb,
    "perfilImobiliaria" jsonb,
    "ragPerfilTexto" text
);


--
-- Name: consultas_cpf; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consultas_cpf (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    cpf text NOT NULL,
    "veioDoCache" boolean DEFAULT false NOT NULL,
    "custoParaNos" numeric(65,30) DEFAULT 0 NOT NULL,
    "cobradoDe" numeric(65,30) NOT NULL,
    lucro numeric(65,30) NOT NULL,
    "consultadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "consultadoPor" text,
    "cacheId" text
);


--
-- Name: contatos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contatos (
    id text NOT NULL,
    "campanhaId" text NOT NULL,
    nome text NOT NULL,
    telefone text,
    email text,
    cpf text,
    "inscricaoIptu" text,
    endereco text,
    "statusProspeccao" text DEFAULT 'AGUARDANDO'::text NOT NULL,
    "tentativasContato" integer DEFAULT 0 NOT NULL,
    respondeu boolean DEFAULT false NOT NULL,
    "primeiraResposta" timestamp(3) without time zone,
    "manifestouInteresse" boolean DEFAULT false NOT NULL,
    "virouLead" boolean DEFAULT false NOT NULL,
    "leadId" text,
    "virouLeadEm" timestamp(3) without time zone,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "anoConstituicao" integer,
    "areaConstruida" numeric(65,30),
    "areaTerreno" numeric(65,30),
    "bairroImovel" text,
    cep text,
    cidade text,
    "dataNascimento" timestamp(3) without time zone,
    email2 text,
    "emailsJson" jsonb,
    "enderecoImovel" text,
    "enriquecidoEm" timestamp(3) without time zone,
    estado text,
    "estadoCivil" text,
    "fonteEnriquecimento" text,
    idade integer,
    "motivoDesinteresse" text,
    observacoes text,
    "perfilInvestidor" boolean DEFAULT false NOT NULL,
    profissao text,
    "scoreAssertiva" integer,
    "scoreQualificacao" integer,
    sexo text,
    telefone2 text,
    telefone3 text,
    "telefonesJson" jsonb,
    "temWhatsapp" boolean DEFAULT false NOT NULL,
    "tipoImovel" text,
    "ultimaTentativa" timestamp(3) without time zone,
    "valorVenal" numeric(65,30),
    "cnpjEmpresa" text,
    "empresaAtual" text,
    "faixaSalarial" text,
    "nomeMae" text,
    "obitoProvavel" boolean DEFAULT false NOT NULL,
    "participacoesEmpresas" jsonb,
    ppe boolean DEFAULT false NOT NULL,
    "redesSociais" jsonb,
    setor text,
    signo text,
    "situacaoCadastral" text,
    "rendaEstimada" numeric(65,30),
    apartamento text,
    bloco text,
    box text,
    lote text,
    "nomeEdificio" text,
    quadra text,
    unidade text,
    email3 text,
    email4 text,
    email5 text,
    "quantidadeWhatsapp" integer DEFAULT 0 NOT NULL,
    telefone4 text,
    telefone5 text,
    "dataRecontato" timestamp(3) without time zone,
    "motivoRecontato" text,
    "atendidoPor" text,
    "modoAtendimento" text DEFAULT 'IA'::text NOT NULL,
    "motivoPausa" text,
    "pausadoEm" timestamp(3) without time zone
);


--
-- Name: contatos_lista; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contatos_lista (
    id text NOT NULL,
    "listaId" text NOT NULL,
    nome text NOT NULL,
    cpf text,
    "inscricaoIptu" text,
    unidade text,
    box text,
    "enderecoImovel" text,
    "bairroImovel" text,
    telefone text,
    telefone2 text,
    telefone3 text,
    telefone4 text,
    telefone5 text,
    "telefonesJson" jsonb,
    email text,
    email2 text,
    email3 text,
    email4 text,
    email5 text,
    "emailsJson" jsonb,
    "temWhatsapp" boolean DEFAULT false NOT NULL,
    "quantidadeWhatsapp" integer DEFAULT 0 NOT NULL,
    "usadoEmCampanha" boolean DEFAULT false NOT NULL,
    "campanhaId" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: conversas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversas (
    id text NOT NULL,
    "leadId" text NOT NULL,
    contexto jsonb NOT NULL,
    "iniciadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "finalizadaEm" timestamp(3) without time zone,
    "estadoConversa" text DEFAULT 'ativa'::text NOT NULL,
    "numeroOrigem" text NOT NULL,
    "ultimaMensagemEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    canal text NOT NULL
);


--
-- Name: conversas_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversas_embeddings (
    id text NOT NULL,
    "conversaId" text,
    "leadId" text,
    "tenantId" text NOT NULL,
    "textoOriginal" text NOT NULL,
    "tipoConteudo" text NOT NULL,
    metadados jsonb,
    embedding text NOT NULL,
    "embeddingModelo" text DEFAULT 'text-embedding-3-small'::text NOT NULL,
    "scoreQualidade" numeric(65,30) DEFAULT 0 NOT NULL,
    "vezesUtilizado" integer DEFAULT 0 NOT NULL,
    "feedbackPositivo" integer DEFAULT 0 NOT NULL,
    "feedbackNegativo" integer DEFAULT 0 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: documentos_agente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.documentos_agente (
    id text NOT NULL,
    "agenteId" text NOT NULL,
    "nomeOriginal" text NOT NULL,
    "nomeStorage" text NOT NULL,
    "mimeType" text NOT NULL,
    "tamanhoBytes" integer NOT NULL,
    "textoExtraido" text,
    "totalCaracteres" integer,
    status public."StatusDocumento" DEFAULT 'PENDENTE'::public."StatusDocumento" NOT NULL,
    "erroProcessamento" text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "processadoEm" timestamp(3) without time zone
);


--
-- Name: empreendimentos_conhecimento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.empreendimentos_conhecimento (
    id text NOT NULL,
    "tenantId" text,
    nome text NOT NULL,
    localizacao text NOT NULL,
    cep text,
    tipo text NOT NULL,
    "briefingCompleto" text NOT NULL,
    "briefingEstruturado" jsonb NOT NULL,
    confiabilidade numeric(65,30) DEFAULT 0 NOT NULL,
    embedding text,
    "embeddingModelo" text DEFAULT 'text-embedding-3-small'::text NOT NULL,
    "embeddingGeradoEm" timestamp(3) without time zone,
    validado boolean DEFAULT false NOT NULL,
    "validadoPor" text,
    "validadoEm" timestamp(3) without time zone,
    versao integer DEFAULT 1 NOT NULL,
    "ultimaAtualizacao" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "vezesReutilizado" integer DEFAULT 0 NOT NULL,
    "ultimoUso" timestamp(3) without time zone,
    "totalCampanhasVinculadas" integer DEFAULT 0 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: imoveis; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.imoveis (
    id text NOT NULL,
    "inscricaoIptu" text NOT NULL,
    logradouro text NOT NULL,
    numero text,
    complemento text,
    bairro text NOT NULL,
    quadra text,
    lote text,
    "codigoEdificio" text,
    "nomeEdificio" text,
    latitude double precision,
    longitude double precision,
    "areaTerreno" double precision,
    "areaEdificada" double precision,
    "certidaoCache" jsonb,
    "certidaoBuscadaEm" timestamp(3) without time zone,
    "leadId" text,
    "statusCaptacao" text DEFAULT 'IDENTIFICADO'::text NOT NULL,
    interesse text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    apartamento text,
    bloco text,
    box text,
    "tipoImovel" text,
    unidade text
);


--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    cpf text,
    nome text NOT NULL,
    email text,
    telefone text,
    "telefoneVerificado" boolean DEFAULT false NOT NULL,
    "dataNascimento" timestamp(3) without time zone,
    "enderecoPrincipal" text,
    origem text DEFAULT 'manual'::text NOT NULL,
    "primeiroContato" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public."StatusLead" DEFAULT 'NOVO'::public."StatusLead" NOT NULL,
    estagio text DEFAULT 'contato_inicial'::text NOT NULL,
    temperatura public."Temperatura" DEFAULT 'FRIO'::public."Temperatura" NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "deletadoEm" timestamp(3) without time zone,
    "campanhaOrigemId" text,
    "ultimaInteracao" timestamp(3) without time zone
);


--
-- Name: listas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.listas (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    nome text NOT NULL,
    "nomeEdificio" text NOT NULL,
    localizacao text,
    cep text,
    "totalContatos" integer DEFAULT 0 NOT NULL,
    "totalEnriquecidos" integer DEFAULT 0 NOT NULL,
    "totalComWhatsapp" integer DEFAULT 0 NOT NULL,
    "totalUsados" integer DEFAULT 0 NOT NULL,
    "dadosPesquisa" jsonb,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens (
    id text NOT NULL,
    "conversaId" text NOT NULL,
    remetente text NOT NULL,
    conteudo text NOT NULL,
    tipo text DEFAULT 'texto'::text NOT NULL,
    metadata jsonb,
    "enviadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lidaEm" timestamp(3) without time zone
);


--
-- Name: mensagens_prospeccao; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mensagens_prospeccao (
    id text NOT NULL,
    "contatoId" text NOT NULL,
    direcao text NOT NULL,
    conteudo text NOT NULL,
    tipo text DEFAULT 'TEXTO'::text NOT NULL,
    telefone text,
    "messageId" text,
    "processadaPorIA" boolean DEFAULT false NOT NULL,
    "respostaGerada" text,
    "toolsChamadas" jsonb,
    "dataHora" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: metricas_mensagens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.metricas_mensagens (
    id text NOT NULL,
    "mensagemId" text,
    "conversaId" text,
    "leadId" text,
    "tenantId" text NOT NULL,
    "mensagemUsuario" text,
    "respostaGerada" text,
    "workerUsado" text NOT NULL,
    "modoOperacao" text DEFAULT 'PASSIVO'::text NOT NULL,
    confianca integer DEFAULT 0 NOT NULL,
    relevancia integer DEFAULT 0 NOT NULL,
    tom text DEFAULT 'ADEQUADO'::text NOT NULL,
    "riscoEscalacao" integer DEFAULT 0 NOT NULL,
    "acaoSupervisor" text DEFAULT 'ENVIAR'::text NOT NULL,
    "foiRefinada" boolean DEFAULT false NOT NULL,
    "foiEscalada" boolean DEFAULT false NOT NULL,
    "alertaCorretor" boolean DEFAULT false NOT NULL,
    "tempoProcessamentoMs" integer,
    "tokensUsados" integer,
    "custoEstimado" numeric(65,30),
    "toolsChamadas" jsonb,
    "temperaturaLead" text,
    "processadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: pesquisas_manus; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pesquisas_manus (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "nomeEmpreendimento" text NOT NULL,
    construtora text,
    endereco text,
    bairro text,
    cidade text NOT NULL,
    estado text,
    "taskId" text NOT NULL,
    "taskUrl" text,
    "shareUrl" text,
    status text DEFAULT 'PENDENTE'::text NOT NULL,
    erro text,
    resultado text,
    "resultadoJson" jsonb,
    "creditosUsados" integer,
    "campanhaId" text,
    "empreendimentoId" text,
    "iniciadaEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "concluidaEm" timestamp(3) without time zone
);


--
-- Name: telefones_blacklist; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telefones_blacklist (
    id text NOT NULL,
    "tenantId" text,
    telefone text NOT NULL,
    motivo text NOT NULL,
    "nomeContato" text,
    "campanhaOrigem" text,
    observacoes text,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    id text NOT NULL,
    nome text NOT NULL,
    slug text NOT NULL,
    status public."StatusTenant" DEFAULT 'ATIVO'::public."StatusTenant" NOT NULL,
    plano text DEFAULT 'SMALL_BUSINESS'::text NOT NULL,
    "precoConsultaCpf" numeric(65,30) DEFAULT 2.00 NOT NULL,
    "quotaMensal" integer DEFAULT 100 NOT NULL,
    "totalConsultas" integer DEFAULT 0 NOT NULL,
    "taxaCacheHit" numeric(65,30) DEFAULT 0 NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "atendeFinalDeSemana" boolean DEFAULT false NOT NULL,
    cidade text DEFAULT 'Goiânia - GO'::text,
    cnpj text,
    diferenciais jsonb,
    email text,
    endereco text,
    facebook text,
    "horarioAtendimento" text DEFAULT '08:00 às 18:00'::text,
    instagram text,
    "logoUrl" text,
    "perfilLocacao" jsonb,
    "perfilVenda" jsonb,
    "ragPerfilTexto" text,
    site text,
    telefone text,
    "tempoMercado" integer,
    whatsapp text,
    expedientesemanal jsonb,
    "expedienteSemanal" jsonb
);


--
-- Name: usuarios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usuarios (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    email text NOT NULL,
    nome text NOT NULL,
    senha text NOT NULL,
    papel public."PapelUsuario" DEFAULT 'CORRETOR'::public."PapelUsuario" NOT NULL,
    avatar text,
    telefone text,
    "estaAtivo" boolean DEFAULT true NOT NULL,
    "criadoEm" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "atualizadoEm" timestamp(3) without time zone NOT NULL,
    "ultimoLoginEm" timestamp(3) without time zone
);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: alertas_corretor alertas_corretor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alertas_corretor
    ADD CONSTRAINT alertas_corretor_pkey PRIMARY KEY (id);


--
-- Name: atividades atividades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT atividades_pkey PRIMARY KEY (id);


--
-- Name: cache_cpf cache_cpf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cache_cpf
    ADD CONSTRAINT cache_cpf_pkey PRIMARY KEY (id);


--
-- Name: campanhas campanhas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT campanhas_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_agente configuracoes_agente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_agente
    ADD CONSTRAINT configuracoes_agente_pkey PRIMARY KEY (id);


--
-- Name: consultas_cpf consultas_cpf_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultas_cpf
    ADD CONSTRAINT consultas_cpf_pkey PRIMARY KEY (id);


--
-- Name: contatos_lista contatos_lista_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos_lista
    ADD CONSTRAINT contatos_lista_pkey PRIMARY KEY (id);


--
-- Name: contatos contatos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT contatos_pkey PRIMARY KEY (id);


--
-- Name: conversas_embeddings conversas_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas_embeddings
    ADD CONSTRAINT conversas_embeddings_pkey PRIMARY KEY (id);


--
-- Name: conversas conversas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT conversas_pkey PRIMARY KEY (id);


--
-- Name: documentos_agente documentos_agente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_agente
    ADD CONSTRAINT documentos_agente_pkey PRIMARY KEY (id);


--
-- Name: empreendimentos_conhecimento empreendimentos_conhecimento_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empreendimentos_conhecimento
    ADD CONSTRAINT empreendimentos_conhecimento_pkey PRIMARY KEY (id);


--
-- Name: imoveis imoveis_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imoveis
    ADD CONSTRAINT imoveis_pkey PRIMARY KEY (id);


--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);


--
-- Name: listas listas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listas
    ADD CONSTRAINT listas_pkey PRIMARY KEY (id);


--
-- Name: mensagens mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT mensagens_pkey PRIMARY KEY (id);


--
-- Name: mensagens_prospeccao mensagens_prospeccao_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_prospeccao
    ADD CONSTRAINT mensagens_prospeccao_pkey PRIMARY KEY (id);


--
-- Name: metricas_mensagens metricas_mensagens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.metricas_mensagens
    ADD CONSTRAINT metricas_mensagens_pkey PRIMARY KEY (id);


--
-- Name: pesquisas_manus pesquisas_manus_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesquisas_manus
    ADD CONSTRAINT pesquisas_manus_pkey PRIMARY KEY (id);


--
-- Name: telefones_blacklist telefones_blacklist_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telefones_blacklist
    ADD CONSTRAINT telefones_blacklist_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: usuarios usuarios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT usuarios_pkey PRIMARY KEY (id);


--
-- Name: alertas_corretor_criadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "alertas_corretor_criadoEm_idx" ON public.alertas_corretor USING btree ("criadoEm");


--
-- Name: alertas_corretor_prioridade_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertas_corretor_prioridade_idx ON public.alertas_corretor USING btree (prioridade);


--
-- Name: alertas_corretor_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX alertas_corretor_status_idx ON public.alertas_corretor USING btree (status);


--
-- Name: alertas_corretor_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "alertas_corretor_tenantId_idx" ON public.alertas_corretor USING btree ("tenantId");


--
-- Name: atividades_agendadoPara_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "atividades_agendadoPara_idx" ON public.atividades USING btree ("agendadoPara");


--
-- Name: atividades_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "atividades_leadId_idx" ON public.atividades USING btree ("leadId");


--
-- Name: atividades_tipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX atividades_tipo_idx ON public.atividades USING btree (tipo);


--
-- Name: cache_cpf_cpf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cache_cpf_cpf_idx ON public.cache_cpf USING btree (cpf);


--
-- Name: cache_cpf_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cache_cpf_cpf_key ON public.cache_cpf USING btree (cpf);


--
-- Name: cache_cpf_expiraEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "cache_cpf_expiraEm_idx" ON public.cache_cpf USING btree ("expiraEm");


--
-- Name: campanhas_empreendimentoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "campanhas_empreendimentoId_idx" ON public.campanhas USING btree ("empreendimentoId");


--
-- Name: campanhas_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "campanhas_tenantId_status_idx" ON public.campanhas USING btree ("tenantId", status);


--
-- Name: configuracoes_agente_tenantId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "configuracoes_agente_tenantId_key" ON public.configuracoes_agente USING btree ("tenantId");


--
-- Name: consultas_cpf_consultadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "consultas_cpf_consultadoEm_idx" ON public.consultas_cpf USING btree ("consultadoEm");


--
-- Name: consultas_cpf_cpf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX consultas_cpf_cpf_idx ON public.consultas_cpf USING btree (cpf);


--
-- Name: consultas_cpf_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "consultas_cpf_tenantId_idx" ON public.consultas_cpf USING btree ("tenantId");


--
-- Name: contatos_campanhaId_cpf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_campanhaId_cpf_idx" ON public.contatos USING btree ("campanhaId", cpf);


--
-- Name: contatos_campanhaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_campanhaId_idx" ON public.contatos USING btree ("campanhaId");


--
-- Name: contatos_campanhaId_telefone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contatos_campanhaId_telefone_key" ON public.contatos USING btree ("campanhaId", telefone);


--
-- Name: contatos_dataRecontato_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_dataRecontato_idx" ON public.contatos USING btree ("dataRecontato");


--
-- Name: contatos_leadId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contatos_leadId_key" ON public.contatos USING btree ("leadId");


--
-- Name: contatos_lista_listaId_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "contatos_lista_listaId_cpf_key" ON public.contatos_lista USING btree ("listaId", cpf);


--
-- Name: contatos_lista_listaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_lista_listaId_idx" ON public.contatos_lista USING btree ("listaId");


--
-- Name: contatos_lista_usadoEmCampanha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_lista_usadoEmCampanha_idx" ON public.contatos_lista USING btree ("usadoEmCampanha");


--
-- Name: contatos_statusProspeccao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_statusProspeccao_idx" ON public.contatos USING btree ("statusProspeccao");


--
-- Name: contatos_virouLead_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "contatos_virouLead_idx" ON public.contatos USING btree ("virouLead");


--
-- Name: conversas_embeddings_conversaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_embeddings_conversaId_idx" ON public.conversas_embeddings USING btree ("conversaId");


--
-- Name: conversas_embeddings_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_embeddings_leadId_idx" ON public.conversas_embeddings USING btree ("leadId");


--
-- Name: conversas_embeddings_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_embeddings_tenantId_idx" ON public.conversas_embeddings USING btree ("tenantId");


--
-- Name: conversas_embeddings_tipoConteudo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_embeddings_tipoConteudo_idx" ON public.conversas_embeddings USING btree ("tipoConteudo");


--
-- Name: conversas_estadoConversa_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_estadoConversa_idx" ON public.conversas USING btree ("estadoConversa");


--
-- Name: conversas_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_leadId_idx" ON public.conversas USING btree ("leadId");


--
-- Name: conversas_numeroOrigem_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "conversas_numeroOrigem_idx" ON public.conversas USING btree ("numeroOrigem");


--
-- Name: documentos_agente_agenteId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "documentos_agente_agenteId_idx" ON public.documentos_agente USING btree ("agenteId");


--
-- Name: empreendimentos_conhecimento_cep_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX empreendimentos_conhecimento_cep_idx ON public.empreendimentos_conhecimento USING btree (cep);


--
-- Name: empreendimentos_conhecimento_nome_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX empreendimentos_conhecimento_nome_idx ON public.empreendimentos_conhecimento USING btree (nome);


--
-- Name: empreendimentos_conhecimento_nome_localizacao_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX empreendimentos_conhecimento_nome_localizacao_key ON public.empreendimentos_conhecimento USING btree (nome, localizacao);


--
-- Name: empreendimentos_conhecimento_validado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX empreendimentos_conhecimento_validado_idx ON public.empreendimentos_conhecimento USING btree (validado);


--
-- Name: imoveis_bairro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX imoveis_bairro_idx ON public.imoveis USING btree (bairro);


--
-- Name: imoveis_codigoEdificio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "imoveis_codigoEdificio_idx" ON public.imoveis USING btree ("codigoEdificio");


--
-- Name: imoveis_inscricaoIptu_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "imoveis_inscricaoIptu_idx" ON public.imoveis USING btree ("inscricaoIptu");


--
-- Name: imoveis_inscricaoIptu_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "imoveis_inscricaoIptu_key" ON public.imoveis USING btree ("inscricaoIptu");


--
-- Name: imoveis_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "imoveis_leadId_idx" ON public.imoveis USING btree ("leadId");


--
-- Name: leads_cpf_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_cpf_idx ON public.leads USING btree (cpf);


--
-- Name: leads_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_status_idx ON public.leads USING btree (status);


--
-- Name: leads_telefone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX leads_telefone_idx ON public.leads USING btree (telefone);


--
-- Name: leads_tenantId_cpf_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "leads_tenantId_cpf_key" ON public.leads USING btree ("tenantId", cpf);


--
-- Name: leads_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "leads_tenantId_idx" ON public.leads USING btree ("tenantId");


--
-- Name: listas_nomeEdificio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "listas_nomeEdificio_idx" ON public.listas USING btree ("nomeEdificio");


--
-- Name: listas_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "listas_tenantId_idx" ON public.listas USING btree ("tenantId");


--
-- Name: mensagens_conversaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mensagens_conversaId_idx" ON public.mensagens USING btree ("conversaId");


--
-- Name: mensagens_enviadaEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mensagens_enviadaEm_idx" ON public.mensagens USING btree ("enviadaEm");


--
-- Name: mensagens_prospeccao_contatoId_dataHora_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mensagens_prospeccao_contatoId_dataHora_idx" ON public.mensagens_prospeccao USING btree ("contatoId", "dataHora");


--
-- Name: mensagens_prospeccao_contatoId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "mensagens_prospeccao_contatoId_idx" ON public.mensagens_prospeccao USING btree ("contatoId");


--
-- Name: mensagens_prospeccao_direcao_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mensagens_prospeccao_direcao_idx ON public.mensagens_prospeccao USING btree (direcao);


--
-- Name: metricas_mensagens_acaoSupervisor_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_acaoSupervisor_idx" ON public.metricas_mensagens USING btree ("acaoSupervisor");


--
-- Name: metricas_mensagens_conversaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_conversaId_idx" ON public.metricas_mensagens USING btree ("conversaId");


--
-- Name: metricas_mensagens_leadId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_leadId_idx" ON public.metricas_mensagens USING btree ("leadId");


--
-- Name: metricas_mensagens_processadoEm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_processadoEm_idx" ON public.metricas_mensagens USING btree ("processadoEm");


--
-- Name: metricas_mensagens_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_tenantId_idx" ON public.metricas_mensagens USING btree ("tenantId");


--
-- Name: metricas_mensagens_workerUsado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "metricas_mensagens_workerUsado_idx" ON public.metricas_mensagens USING btree ("workerUsado");


--
-- Name: pesquisas_manus_campanhaId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pesquisas_manus_campanhaId_idx" ON public.pesquisas_manus USING btree ("campanhaId");


--
-- Name: pesquisas_manus_taskId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pesquisas_manus_taskId_idx" ON public.pesquisas_manus USING btree ("taskId");


--
-- Name: pesquisas_manus_taskId_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "pesquisas_manus_taskId_key" ON public.pesquisas_manus USING btree ("taskId");


--
-- Name: pesquisas_manus_tenantId_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "pesquisas_manus_tenantId_status_idx" ON public.pesquisas_manus USING btree ("tenantId", status);


--
-- Name: telefones_blacklist_telefone_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX telefones_blacklist_telefone_idx ON public.telefones_blacklist USING btree (telefone);


--
-- Name: telefones_blacklist_tenantId_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "telefones_blacklist_tenantId_idx" ON public.telefones_blacklist USING btree ("tenantId");


--
-- Name: telefones_blacklist_tenantId_telefone_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "telefones_blacklist_tenantId_telefone_key" ON public.telefones_blacklist USING btree ("tenantId", telefone);


--
-- Name: tenants_slug_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_slug_idx ON public.tenants USING btree (slug);


--
-- Name: tenants_slug_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tenants_slug_key ON public.tenants USING btree (slug);


--
-- Name: tenants_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tenants_status_idx ON public.tenants USING btree (status);


--
-- Name: usuarios_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX usuarios_email_idx ON public.usuarios USING btree (email);


--
-- Name: usuarios_tenantId_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "usuarios_tenantId_email_key" ON public.usuarios USING btree ("tenantId", email);


--
-- Name: atividades atividades_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.atividades
    ADD CONSTRAINT "atividades_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: campanhas campanhas_empreendimentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT "campanhas_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES public.empreendimentos_conhecimento(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: campanhas campanhas_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campanhas
    ADD CONSTRAINT "campanhas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: configuracoes_agente configuracoes_agente_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_agente
    ADD CONSTRAINT "configuracoes_agente_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: consultas_cpf consultas_cpf_cacheId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consultas_cpf
    ADD CONSTRAINT "consultas_cpf_cacheId_fkey" FOREIGN KEY ("cacheId") REFERENCES public.cache_cpf(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: contatos contatos_campanhaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT "contatos_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES public.campanhas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: contatos contatos_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos
    ADD CONSTRAINT "contatos_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: contatos_lista contatos_lista_listaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contatos_lista
    ADD CONSTRAINT "contatos_lista_listaId_fkey" FOREIGN KEY ("listaId") REFERENCES public.listas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: conversas conversas_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversas
    ADD CONSTRAINT "conversas_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: documentos_agente documentos_agente_agenteId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.documentos_agente
    ADD CONSTRAINT "documentos_agente_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES public.configuracoes_agente(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: empreendimentos_conhecimento empreendimentos_conhecimento_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.empreendimentos_conhecimento
    ADD CONSTRAINT "empreendimentos_conhecimento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: imoveis imoveis_leadId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.imoveis
    ADD CONSTRAINT "imoveis_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES public.leads(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_campanhaOrigemId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_campanhaOrigemId_fkey" FOREIGN KEY ("campanhaOrigemId") REFERENCES public.campanhas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: leads leads_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT "leads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: listas listas_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.listas
    ADD CONSTRAINT "listas_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mensagens mensagens_conversaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens
    ADD CONSTRAINT "mensagens_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES public.conversas(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: mensagens_prospeccao mensagens_prospeccao_contatoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mensagens_prospeccao
    ADD CONSTRAINT "mensagens_prospeccao_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES public.contatos(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: pesquisas_manus pesquisas_manus_campanhaId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesquisas_manus
    ADD CONSTRAINT "pesquisas_manus_campanhaId_fkey" FOREIGN KEY ("campanhaId") REFERENCES public.campanhas(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pesquisas_manus pesquisas_manus_empreendimentoId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesquisas_manus
    ADD CONSTRAINT "pesquisas_manus_empreendimentoId_fkey" FOREIGN KEY ("empreendimentoId") REFERENCES public.empreendimentos_conhecimento(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: pesquisas_manus pesquisas_manus_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pesquisas_manus
    ADD CONSTRAINT "pesquisas_manus_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: telefones_blacklist telefones_blacklist_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telefones_blacklist
    ADD CONSTRAINT "telefones_blacklist_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: usuarios usuarios_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usuarios
    ADD CONSTRAINT "usuarios_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public.tenants(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict Aj4hj6bnpkyOmVtJ3BlrboNo9bwoSu2ttlDuJewN0PcZTEACRct2TJ50C28Oed3

