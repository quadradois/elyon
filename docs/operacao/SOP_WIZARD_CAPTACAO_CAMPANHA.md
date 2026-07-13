# SOP — Fluxo Operacional do Wizard de Captação até Geração da Campanha

## 1. Objetivo
Documentar, em linguagem de processo, como funciona o fluxo do Wizard de Captação: da escolha do local de prospecção até a lista de contatos minerados, criação da campanha e preparação do briefing do empreendimento.

Este SOP foi escrito para orientar o time de desenvolvimento a reaproveitar o formato do fluxo em outras telas ou novas versões do produto, sem depender de detalhes técnicos internos do sistema.

## 2. Escopo
Este documento cobre:

- fluxo guiado do Wizard de Captação;
- decisões que o usuário precisa tomar em cada etapa;
- comportamento esperado da interface;
- resultados esperados ao final de cada etapa;
- vínculo entre contatos minerados, listas e campanhas;
- continuação natural para geração/validação de briefing.

Este documento não cobre:

- endpoints, payloads, banco de dados ou arquitetura técnica;
- regras internas de scraper, integrações externas ou cache;
- lógica de IA em nível de prompt ou implementação.

## 3. Conceitos do fluxo

| Conceito | Significado operacional |
| --- | --- |
| Local de captação | Empreendimento, condomínio, bairro ou IPTU específico onde a busca será iniciada. |
| Unidade | Apartamento, casa, lote ou imóvel individual dentro do local selecionado. |
| IPTU/Inscrição | Identificador usado para localizar dados do imóvel/proprietário. |
| Proprietário | Pessoa ou empresa associada ao imóvel. |
| Contato minerado | Proprietário com telefone, WhatsApp ou e-mail acionável para prospecção. |
| Lista | Agrupamento salvo de contatos minerados. Pode ser usado em uma ou mais campanhas. |
| Campanha | Operação comercial de prospecção ativa para um empreendimento/local. |
| Briefing | Conhecimento estruturado do empreendimento usado para dar contexto às conversas comerciais. |
| Modo Turbo | Atalho operacional para automatizar avanço, salvamento e criação da campanha com menos cliques. |

Observação de governança: no produto, algumas telas podem usar o termo "lead minerado". Para padronização de processo, recomenda-se tratar essa etapa como "contatos/proprietários minerados". O lead comercial nasce depois, quando há qualificação e aceite do proprietário.

## 4. Fluxo macro

```text
[Iniciar Wizard de Captação]
        |
        v
[1. Escolher local]
        |
        v
[2. Selecionar unidades/imóveis]
        |
        v
[3. Processar captação]
        |
        v
[4. Salvar lista de contatos]
        |
        v
[Criar campanha automaticamente?]
        |                 |
       Sim               Não
        |                 |
        v                 v
[Campanha criada]   [Lista disponível para uso futuro]
        |
        v
[5. Concluir]
        |
        v
[Pesquisar/validar briefing do empreendimento]
        |
        v
[Campanha pronta para prospecção]
```

## 5. Etapa 1 — Escolher local de captação

### 5.1 Finalidade
Definir onde a captação será feita. Esta etapa responde à pergunta: "Onde queremos encontrar proprietários para prospectar?"

### 5.2 Opções de busca

| Opção | Quando usar | Ação do usuário | Resultado esperado |
| --- | --- | --- | --- |
| Empreendimentos | Quando o usuário sabe o nome do edifício ou condomínio. | Digitar o nome e buscar. | Lista de resultados compatíveis com nome, bairro e tipo. |
| Por bairro/condomínio | Quando a estratégia é minerar uma região ou condomínio horizontal. | Selecionar o bairro/condomínio na lista. | Carregamento dos imóveis daquela região. |
| Por IPTU | Quando existe uma inscrição específica. | Digitar o número do IPTU/inscrição. | Um imóvel específico carregado para captação unitária. |

### 5.3 Comportamento esperado da tela

1. O usuário acessa a página "Wizard de Captação".
2. A interface mostra um stepper com cinco etapas: Local, Selecionar, Processar, Salvar e Concluir.
3. A primeira pergunta exibida é "Onde você quer captar?".
4. O usuário escolhe uma das abas de busca.
5. Ao buscar por empreendimento, a tela exibe resultados com nome, bairro e tipo do local.
6. O usuário pode:
   - clicar em um único resultado para carregar imediatamente suas unidades;
   - selecionar múltiplos locais e processar todos em conjunto.
7. Ao buscar por bairro/condomínio, o usuário escolhe uma opção da lista e avança.
8. Ao buscar por IPTU, o usuário digita a inscrição e avança para tratar um imóvel específico.

### 5.4 Decisões importantes

- Se houver múltiplos resultados parecidos, o usuário deve escolher o local correto antes de seguir.
- Se a intenção for volume, selecionar múltiplos locais pode acelerar a formação de lista.
- Se a intenção for precisão, usar IPTU ou filtros específicos reduz ruído.
- A opção "Abrir Mapa da Prefeitura" deve ser tratada como apoio de conferência, não como etapa obrigatória.

### 5.5 Resultado da etapa
Ao concluir esta etapa, o sistema deve ter um local selecionado e uma lista de unidades/imóveis carregada para seleção.

## 6. Etapa 2 — Selecionar unidades ou imóveis

### 6.1 Finalidade
Permitir que o usuário escolha quais unidades entrarão na mineração. Esta etapa controla escopo, custo e qualidade da captação.

### 6.2 Comportamento esperado da tela

1. A tela mostra o nome do local selecionado.
2. A tela informa o total de unidades, casas ou imóveis carregados.
3. A tabela exibe dados suficientes para o usuário reconhecer cada item:
   - em edifícios: unidade/apartamento, endereço e IPTU;
   - em condomínios horizontais: quadra, lote, rua e IPTU.
4. O usuário pode selecionar ou desmarcar unidades individualmente.
5. O usuário pode selecionar ou desmarcar todas as unidades visíveis.
6. A tela mostra a contagem: "X de Y selecionadas".
7. O botão principal informa quantos itens serão minerados.

### 6.3 Filtros disponíveis

| Filtro | Uso operacional |
| --- | --- |
| Rua/Avenida | Encontrar imóveis por logradouro. |
| Número | Restringir busca por número de imóvel ou referência de endereço. |
| Apartamento/Unidade | Encontrar unidade específica dentro de edifício. |
| Quadra | Filtrar casas/lotes em condomínio horizontal. |
| Lote | Filtrar casas/lotes em condomínio horizontal. |

### 6.4 Regra sobre boxes/vagas
Unidades identificadas como box/vaga devem vir desmarcadas por padrão, porque normalmente pertencem ao mesmo proprietário do apartamento e podem gerar custo duplicado ou contatos repetidos.

### 6.5 Modo Turbo
O Modo Turbo é um atalho para usuários que querem executar o fluxo com menor intervenção. Quando ativado:

- o fluxo tende a avançar automaticamente após o processamento;
- a lista recebe um nome padrão;
- a campanha pode ser criada automaticamente;
- o usuário ainda deve poder cancelar o Turbo antes do salvamento final.

### 6.6 Resultado da etapa
Ao concluir esta etapa, existe uma seleção definida de imóveis/unidades que seguirá para identificação de proprietários e enriquecimento de contato.

## 7. Etapa 3 — Processar captação

### 7.1 Finalidade
Transformar imóveis selecionados em contatos acionáveis para campanha.

### 7.2 O que acontece do ponto de vista do usuário

1. O usuário clica para minerar os itens selecionados.
2. O wizard muda para a etapa "Processar".
3. A tela mostra que a mineração está rodando em segundo plano.
4. O progresso é apresentado em etapas visuais:
   - iniciando mineração;
   - identificando proprietários;
   - buscando informações de contato;
   - salvando contatos qualificados.
5. A tela apresenta indicadores como:
   - imóveis analisados;
   - proprietários identificados;
   - contatos com telefone;
   - contatos prontos para uso comercial.
6. O usuário pode cancelar o processamento durante a execução.
7. Ao final, a tela mostra quantos contatos foram encontrados e o tempo aproximado de processamento.

### 7.3 Estados esperados

| Estado | Significado | Ação disponível |
| --- | --- | --- |
| Processando | A mineração está em andamento. | Aguardar ou cancelar. |
| Concluído | A lista de contatos foi formada. | Avançar para salvar lista. |
| Erro recuperável | O processamento falhou, mas pode ser refeito. | Tentar novamente. |
| Créditos insuficientes | A operação exige mais créditos. | Exibir orientação de compra/recarga ou reduzir seleção. |
| Cancelado | O usuário interrompeu a execução. | Voltar, ajustar seleção ou reiniciar. |

### 7.4 Regra de comunicação
A tela deve evitar dar a impressão de que a campanha já está pronta apenas porque contatos foram encontrados. O resultado desta etapa é "contatos minerados prontos para lista", não campanha ativa.

### 7.5 Resultado da etapa
Ao concluir, o usuário tem uma base de contatos/proprietários com dados suficientes para salvar como lista e usar em campanha.

## 8. Etapa 4 — Salvar lista e decidir criação de campanha

### 8.1 Finalidade
Persistir o resultado da mineração como uma lista reutilizável e, opcionalmente, criar uma campanha automaticamente.

### 8.2 Comportamento esperado da tela

1. A tela apresenta o título "Salvar Lista de Contatos".
2. O usuário informa ou confirma o nome da lista.
3. A tela mostra uma opção marcada por padrão: "Criar campanha automaticamente".
4. Se essa opção estiver marcada, o usuário informa ou confirma o nome da campanha.
5. A tela exibe um resumo do que será salvo:
   - quantidade de contatos;
   - indicação de dados enriquecidos;
   - informação de que a lista ficará pronta para campanhas.
6. O usuário clica em "Salvar Lista".

### 8.3 Decisão: criar campanha automaticamente

| Escolha | Quando usar | Resultado |
| --- | --- | --- |
| Criar campanha automaticamente | Quando a captação já tem objetivo comercial definido. | A lista é salva e os contatos são vinculados a uma nova campanha. |
| Apenas salvar lista | Quando a equipe ainda vai revisar, segmentar ou usar depois. | A lista fica disponível para importação futura em uma campanha. |

### 8.4 Nomenclatura recomendada

- Lista: `Mineração [Nome do Empreendimento ou Região]`
- Campanha: `Captação [Nome do Empreendimento ou Região]`
- Em múltiplos locais: `Mineração [quantidade] locais` ou nome estratégico definido pelo usuário.

### 8.5 Modo Turbo nesta etapa
Se o Modo Turbo estiver ativo:

1. A tela informa que o salvamento será automático.
2. O nome padrão da lista/campanha é utilizado.
3. A tela mostra a quantidade de contatos que será salva.
4. O usuário pode cancelar o Turbo e editar manualmente antes da execução.
5. Após o salvamento, o fluxo avança para conclusão.

### 8.6 Resultado da etapa
Ao concluir, existe uma lista salva. Se a criação automática estiver ativa, também existe uma campanha criada com os contatos vinculados.

## 9. Etapa 5 — Concluir e preparar próximos passos

### 9.1 Finalidade
Confirmar a finalização da mineração e direcionar o usuário para a ação seguinte correta.

### 9.2 Comportamento esperado da tela

1. A tela mostra uma mensagem de conclusão.
2. O resumo confirma:
   - total de contatos minerados;
   - nome da lista salva;
   - disponibilidade para uso em campanhas.
3. A tela oferece ações principais:
   - ir para Campanhas;
   - ver a Lista;
   - iniciar nova mineração.
4. Quando houver campanha criada, a tela também deve incentivar a criação/validação do briefing do empreendimento.

### 9.3 Pesquisa inteligente e briefing
Após a lista/campanha, o próximo passo operacional é gerar ou validar o briefing do empreendimento.

O briefing pode ser criado de três formas:

| Forma | Quando usar | Resultado |
| --- | --- | --- |
| Pesquisa inteligente | Quando a equipe quer que a IA busque informações públicas do empreendimento. | Briefing estruturado para revisão humana. |
| Escrita manual | Quando o corretor já tem as informações. | Briefing preenchido diretamente pela equipe. |
| Reaproveitar briefing | Quando já existe campanha anterior semelhante. | Briefing copiado e ajustado. |

O briefing nunca deve ser tratado como definitivo sem validação humana. Ele é o material que dará autoridade para a abordagem comercial e para as respostas do agente.

### 9.4 Resultado final do wizard
O fluxo é considerado concluído quando:

- a lista foi salva;
- os contatos estão disponíveis;
- a campanha foi criada ou a lista ficou pronta para uso futuro;
- o usuário sabe qual é o próximo passo: revisar campanha, validar briefing ou iniciar nova mineração.

## 10. Caminho alternativo — Criar campanha primeiro

Além do Wizard de Captação, o produto também permite iniciar pelo módulo de Campanhas.

### 10.1 Quando usar
Use este caminho quando a equipe já sabe qual campanha deseja criar, mas ainda vai importar contatos depois.

### 10.2 Fluxo operacional

1. Usuário acessa "Campanhas".
2. Clica em "Nova Campanha".
3. Preenche dados da campanha:
   - nome;
   - nome do empreendimento;
   - endereço ou localização;
   - tipo/perfil do imóvel;
   - responsável principal;
   - corretor de fallback.
4. Ao salvar, o usuário é direcionado para os detalhes da campanha.
5. Na campanha, o usuário pode:
   - preencher briefing;
   - pesquisar dados do empreendimento;
   - importar uma lista de contatos minerados;
   - revisar contatos antes do disparo.

### 10.3 Importar lista para campanha
Quando a campanha já existe:

1. O usuário abre os detalhes da campanha.
2. Escolhe a ação de importar contatos de uma lista.
3. Seleciona uma lista disponível.
4. A interface mostra:
   - quantidade de contatos disponíveis;
   - quantidade com WhatsApp;
   - nome do empreendimento/lista.
5. O usuário confirma a importação.
6. Os contatos passam a compor a campanha.

## 11. Regras operacionais para reaproveitamento do fluxo

1. O wizard deve ser sempre progressivo: o usuário só avança quando a etapa atual tem dados suficientes.
2. O usuário precisa entender a consequência de cada ação antes de gerar custo ou criar campanha.
3. A seleção de unidades deve ser editável antes do processamento.
4. A criação de campanha deve ser opcional, mesmo quando sugerida.
5. Listas devem existir como entidade reutilizável, separadas da campanha.
6. Campanha sem briefing deve ser considerada incompleta para prospecção ativa.
7. Briefing gerado por IA precisa passar por revisão humana.
8. Contato minerado não deve ser confundido com lead qualificado.
9. O fluxo deve mostrar progresso claro em operações demoradas.
10. Erros devem indicar ação possível: tentar novamente, reduzir seleção, comprar créditos, cancelar ou voltar.
11. Contatos duplicados devem ser evitados dentro da mesma campanha.
12. O usuário deve conseguir iniciar nova mineração sem perder o resultado salvo.

## 12. Critérios de aceite para o time dev

Para considerar o reaproveitamento do fluxo correto, a implementação deve atender aos seguintes critérios:

- Existe um stepper claro com as etapas Local, Selecionar, Processar, Salvar e Concluir.
- A etapa Local oferece busca por empreendimento, bairro/condomínio e IPTU.
- O usuário consegue processar um local único ou múltiplos locais.
- A etapa Selecionar mostra unidades/imóveis com filtros operacionais.
- Boxes/vagas são desmarcados por padrão quando identificados.
- A etapa Processar mostra progresso, métricas e opção de cancelamento.
- A etapa Salvar permite nomear lista e decidir se cria campanha automaticamente.
- O Modo Turbo automatiza o fluxo, mas ainda permite cancelamento antes do salvamento manual.
- A conclusão oferece caminhos para Campanhas, Lista e nova mineração.
- O fluxo conduz naturalmente para criação/validação do briefing.
- A campanha só deve ser considerada pronta para prospecção quando tiver contatos e briefing validado.

## 13. Resumo executivo para devs

O formato a ser reaproveitado é um wizard de decisão progressiva:

1. escolher onde captar;
2. escolher o que minerar;
3. processar e mostrar progresso;
4. salvar como lista reutilizável;
5. criar campanha opcionalmente;
6. concluir com briefing como próximo passo.

A lógica central não é "criar campanha primeiro", mas sim formar uma base confiável de contatos, salvar essa base como lista e só então vincular a uma campanha com contexto comercial suficiente para abordagem.
