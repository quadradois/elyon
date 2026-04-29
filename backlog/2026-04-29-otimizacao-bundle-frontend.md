# Otimização de Bundle Frontend

## Contexto
Durante a validação final de qualidade (lint/build) do frontend, o Vite reportou chunks grandes após minificação e um aviso de `INEFFECTIVE_DYNAMIC_IMPORT` no `ChatModal`.

## Problema
O bundle principal está acima do ideal para carregamento inicial, com risco de piorar tempo de first load em redes lentas e dispositivos móveis.

## Escopo futuro
- Medir baseline de performance (bundle analyzer + Lighthouse).
- Corrigir import dinâmico inefetivo do `ChatModal` (evitar import estático concorrente no mesmo módulo).
- Revisar pontos de code-splitting por rota/tela crítica.
- Avaliar divisão de chunks pesados (`dialog`, páginas administrativas e cockpit).
- Revalidar build e comparar métricas antes/depois.

## Impactos
- Redução de tempo de carregamento inicial.
- Melhor experiência em conexões móveis.
- Menor risco de regressão de performance com crescimento do frontend.

## Critério de pronto futuro
- Warning de `INEFFECTIVE_DYNAMIC_IMPORT` eliminado.
- Redução mensurável de tamanho do chunk principal (meta definida após baseline).
- Evidência de melhoria em pelo menos 1 métrica objetiva (ex.: LCP/TBT ou tamanho gzip do entry).
- Build de produção sem novos warnings de chunk introduzidos pela mudança.

## Prioridade
`P2`

## Status
`Pendente`
