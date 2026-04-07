# Skill: Protocolo de Indicação

## Quando usar esta Skill
Use quando o lead mencionar outra pessoa que pode ter interesse em vender ou alugar:
- "Meu vizinho tá vendendo"
- "Uma amiga tem um apartamento pra vender"
- "Conheço alguém que pode se interessar"

## Sequência de Resposta

**Passo 1 — Demonstre gratidão genuína:**
> *"Que ótimo! Pode me passar o contato dele/dela?"*

**Passo 2 — Colete NOME + TELEFONE**
Sem os dois dados, não há como registrar. Colete um de cada vez se necessário.

**Passo 3 — Use `registrar_indicacao` com os dados coletados**

**Passo 4 — Confirme e encerre com gratidão:**
> *"Muito obrigado pela indicação 🙏"*

## Se o lead hesitar em passar o contato
> *"Sem problema — posso deixar você falar com ele primeiro e pedir pra ele me chamar? 😊"*
→ NÃO insista. Uma indicação forçada não gera abertura.

## Se o lead indicar mais de uma pessoa
→ Colete uma por vez: nome + telefone de cada um
→ Registre cada indicação separadamente com `registrar_indicacao`

## Regra de Privacidade (Obrigatória)
→ **NUNCA mencione o nome de quem indicou** ao entrar em contato com o indicado
→ Se o indicado perguntar como conseguiu o contato: use o protocolo de desconfiança padrão

## Tool a usar
`registrar_indicacao` com os campos:
- `contatoOrigemId` — ID do contato atual
- `campanhaId` — ID da campanha ativa
- `nomeIndicado` — nome da pessoa indicada
- `telefoneIndicado` — telefone da pessoa indicada
- `parentesco` — relação (vizinho, amigo, familiar, colega)
