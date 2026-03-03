# Plano de Refatoração: Desacoplamento de Ferramentas (Tooling) da IA

## Objetivo
Refatorar o arquivo `sdr-tools-agents.ts` que atualmente concentra definição de Schemas (Zod), injeção de prompt e regras de negócio rígidas (Prisma ORM). A meta é transferir a lógica de negócio para uma camada de *Use Cases* independente, limpa e testável, aderindo aos princípios SOLID.

## Abordagem Arquitetural (TO-BE)
1. **Camada de Schemas / Interface (Tools):**
   - O arquivo `sdr-tools-agents.ts` conterá APENAS a definição do `z.object` (regras e descrições para a OpenAI) e injetará a chamada para a classe/função de *Use Case*.
   - Todo tratamento de erros (`try/catch`) na camada de Tool deverá apenas repassar falhas amigáveis para o LLM.

2. **Camada de Casos de Uso (Business Logic):**
   - Criação do diretório `/root/elyon/pacotes/backend/src/casos-de-uso/agentes/`.
   - Criação de classes/funções especialistas. Exemplos priorizados:
     - `ConverterParaLeadUseCase`
     - `AgendarAvaliacaoUseCase`
     - `MoverParaFaseUseCase`
     - `SalvarDadosImovelUseCase`
   - O acesso ao banco de dados (`prisma`) será isolado dentro destas funções.

3. **Injeção de Dependências:**
   - As dependências (ex: `prisma`, `CRMService`) deverão ser importadas/injetadas dentro do UseCase, mantendo os contratos estritos de TypeScript.

## Etapas da Implementação (Fase 2)
As tarefas serão paralelizadas entre os agentes:
- **[database-architect] / [backend-specialist]**: Mapear os contratos atuais do Prisma requeridos pelas tools de conversão e agendamento. Criar a estrutura base da pasta de `casos-de-uso`.
- **[frontend-specialist]** (Atuando no frontend do código/interface de IA): Refatorar a casca do SDK `@openai/agents` no `sdr-tools-agents.ts` para que receba unicamente a validação Zod e chame o UseCase.
- **[test-engineer] / [lint-and-validate]**: Rodar verificações de segurança e build do typescript para garantir que nenhuma refatoração quebrou os tipos estritos de `.nullable()`.

## Estado Final Esperado
- Ferramentas limpas (menos de 20 linhas de execução real).
- Lógica de negócio 100% conteinerizada e pronta para testes com mocks de banco de dados.

## Etapas da Implementação (Fase 5 - Governança e Linter)
A fase 5 atuará sobre a estabilidade do repositório através das ferramentas do TIER 0, além de validar os wrappers da inteligência artificial.
1. **[lint-and-validate]**: Instalar e Configurar o `@eslint/config` no diretório raiz do backend.
2. **[security-auditor]**: Rastrear a fundo e eliminar hardcoded keys e vazarments expostos nos scanners anteriores.
3. **[backend-specialist]**: Mapear o atual wrapper de Inteligência Artificial (`@openai/agents` usado pelo arquivo `sdr-agent.ts`) e decidir pela otimização ou conversão para um framework unificado de multi-agentes (se necessário de acordo com a escalabilidade do sistema).
