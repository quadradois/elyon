## Plan: Busca de Empreendimento por Código

Adicionar busca por código no sistema de mineração de leads do Elyon, sem alterar o fluxo principal do wizard. A solução cobre código de empreendimento (`cdedificio`) e condomínio horizontal (`cdbairro`), com entrada explícita no passo 1 via novo modo “Por código”. O backend deve estender a busca existente para receber código e retornar tipo encontrado, preservando compatibilidade das etapas 2–5. Quando não houver resultado, a interface pergunta se o usuário deseja tentar por nome (sem fallback automático), mantendo experiência guiada e baixo risco.

**Steps**
1. Mapear contrato atual do passo 1 em [pacotes/frontend/src/paginas/Captacao.tsx](pacotes/frontend/src/paginas/Captacao.tsx), especialmente `modoBusca`, `buscarImoveis`, `termoBusca` e render de resultados.
2. Estender [pacotes/backend/src/rotas/mineracao/busca.rotas.ts](pacotes/backend/src/rotas/mineracao/busca.rotas.ts) para aceitar parâmetro opcional `codigo` em `GET /buscar-imoveis`, mantendo comportamento atual por `termo`.
3. Definir resposta padronizada da API com tipo do match (`empreendimento` para `cdedificio`, `condominio` para `cdbairro`) e payload compatível com a lista já usada no frontend.
4. Adaptar [pacotes/backend/src/servicos/mapa.ts](pacotes/backend/src/servicos/mapa.ts) para busca exata por código com deduplicação e prioridade de match exato, sem quebrar busca por nome.
5. Aplicar validação de formato no backend (código inválido) com erro funcional amigável e sem alterar semântica dos endpoints legados.
6. Incluir novo toggle/tab “Por código” no passo 1 em [pacotes/frontend/src/paginas/Captacao.tsx](pacotes/frontend/src/paginas/Captacao.tsx), preservando “Empreendimentos” e “Por IPTU”.
7. No modo “Por código”, enviar `codigo` na chamada de busca e reutilizar o mesmo componente de resultado para evitar impacto nas etapas seguintes.
8. Implementar UX de não encontrado com pergunta explícita de fallback para nome (CTA para tentar por nome + opção de permanecer no modo código).
9. Validar compatibilidade do pipeline 2–5 (seleção, processamento, salvar, concluir), incluindo integração com [pacotes/frontend/src/componentes/ModalProcessamento.tsx](pacotes/frontend/src/componentes/ModalProcessamento.tsx).
10. Registrar regras e comportamento no plano técnico em [docs/PLAN.md](docs/PLAN.md) ou documento dedicado de produto.

**Verification**
- Testar busca por nome sem regressão em [pacotes/frontend/src/paginas/Captacao.tsx](pacotes/frontend/src/paginas/Captacao.tsx).
- Testar busca por IPTU sem regressão no mesmo fluxo.
- Testar busca por código válido `cdedificio`.
- Testar busca por código válido `cdbairro`.
- Testar código inválido (erro funcional + UX clara).
- Testar código inexistente (pergunta “Deseja tentar por nome?”).
- Confirmar etapas 2–5 intactas após resultado vindo de código.
- Validar build e tipagem backend/frontend após alteração de contrato.

**Decisions**
- Escopo inclui `cdedificio` e `cdbairro`.
- Entrada será explícita por novo toggle/tab “Por código”.
- Não encontrado pergunta ao usuário se deseja tentar por nome.
- Objetivo é baixo impacto, reaproveitando arquitetura atual.
