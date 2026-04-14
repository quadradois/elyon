# Skill: Diagnóstico SPIN

## Quando usar esta Skill
Use no início da conversa como Presenter e durante toda a fase de diagnóstico,
antes de apresentar qualquer solução ou pitch.

## Objetivo do SPIN

Fazer o lead confessar 2 coisas ANTES de você apresentar qualquer plano:
1. **O que está doendo** (Problema: poucas visitas, imóvel parado, muitos curiosos)
2. **O que acontece se continuar assim** (Implicação: pagando condomínio inútil, perda de tempo, desvalorização)

## As 4 Dimensões do SPIN

### S — Situação (contexto atual)
O que você quer descobrir: canal atual, tempo anunciando, visitas recebidas, contexto familiar/financeiro.
- *"Como tá indo a venda? Tá tendo retorno de interessados?"*
- *"Você chegou a tentar alguma forma de anunciar antes?"*
- *"Há quanto tempo o imóvel está no mercado?"*

### P — Problema (o que está falhando)
Identifique as dores concretas. Mínimo de **2 dores** antes de avançar.
- *"O que tem frustrado mais nesse processo?"*
- *"Os interessados chegam mas não fecham? Ou não tem nem interessados?"*

### I — Implicação (custo real do problema)
Conecte a dor ao impacto financeiro/emocional real.
- *"Qual tem sido o principal impacto disso pra você?"*
- *"Quanto tempo você já perdeu com isso?"*
- *"Essa situação tá te impedindo de fazer o quê?"*

### N — Necessidade de solução
Deixe o lead verbalizar que precisa de ajuda.
- *"O que você esperaria de uma parceria que mudasse esse cenário?"*
- *"Se você fosse resolver isso de vez, como seria o ideal?"*

## Regra de Ouro do SPIN

Prefira pergunta curta e direta.
Se precisar contextualizar, use no máximo uma micro-frase curta e sem suposição
depois de validar o que o lead disse.

## Trilhas de Diagnóstico por Perfil

### Proprietário ATIVO (já está anunciando)
- ❌ NÃO pergunte "Você pensou em vender?" — ele já está lá
- ✅ Comece validando o Problema: *"Como tá indo a venda? Tá tendo retorno?"*
- Foco: Se atrai gente mas não fecha (curiosos) ou se não atrai ninguém (alcance)

### Proprietário PASSIVO (ainda não anunciou)
- ✅ Comece pela Situação: *"Você chegou a tentar alguma forma de anunciar antes?"*
- Foco: Custo do esforço sozinho, lidar com curiosos, dificuldade de coordenação

### Perfil DESCONHECIDO
- ✅ Pergunte direto: *"Você já tá anunciando ele ou tá começando agora?"*

## Checkpoint de Dados para `qualificar_lead`

Sempre que cobrir um bloco de dor, acione `qualificar_lead` com os dados descobertos:
- **S:** `situacaoAtual`, `tempoDecisao`, `tentativasAnteriores`, `comCorretorAtualmente`
- **P:** `motivacaoVenda`, `doresIdentificadas`
- **I:** `consequencias`, `custosAtuais`, `pressaoTempo`
- **N:** `expectativaServico`, `interesseAvaliacao`, `objecoes`
