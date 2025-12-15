---
description: Implementação da Base Local de Imóveis (Portal Mapa)
---

# 🚀 Fluxo de Migração: Base Local de Imóveis

Este workflow detalha os passos para migrar os dados do `portalmapa.goiania.go.gov.br` para o banco de dados local do Elyon, eliminando a dependência da API para buscas de edifícios e unidades.

## 1. Atualização do Schema (Modelagem)

- [ ] Editar `/root/elyon/pacotes/backend/prisma/schema.prisma`
- [ ] Adicionar model `Bairro`
    - `codigo` (Int, unique)
    - `nome` (String)
- [ ] Adicionar model `Edificio`
    - `codigo` (Int, unique)
    - `nome` (String)
    - `bairro` (Relation)
- [ ] Atualizar model `Imovel`
    - Adicionar `codigoBairro` (Int)
    - Adicionar `codigoEdificio` (Int)
    - Adicionar índices para performance
- [ ] Criar e aplicar migration (`npx prisma migrate dev`)

## 2. Scripts de Carga (Crawler)

- [ ] Criar serviço de sincronização: `/root/elyon/pacotes/backend/src/servicos/sincronizacao-mapa.ts`
- [ ] Implementar método `sincronizarBairros()`
    - Busca todos os bairros da API
    - `upsert` no banco
- [ ] Implementar método `sincronizarEdificios()`
    - Itera sobre bairros
    - Busca edifícios do bairro
    - `upsert` no banco
- [ ] Implementar método `sincronizarUnidades()`
    - Itera sobre edifícios
    - Busca todas as unidades (paginação automática)
    - `upsert` na tabela `Imovel` em lotes (transação)

## 3. Adaptação do MapaService

- [ ] Alterar `/root/elyon/pacotes/backend/src/servicos/mapa.ts`
- [ ] Método `listarBairros()`: Ler do banco (se vazio, chama sync)
- [ ] Método `listarEdificiosPorBairro()`: Ler do banco
- [ ] Método `buscarUnidadesPorEdificio()`: Ler do banco
- [ ] Manter fallback para API apenas em caso de erro crítico ou flag de "forçar atualização"

## 4. Execução da Carga Inicial

- [ ] Criar rota administrativa para disparar a sincronização
- [ ] Monitorar logs de execução
- [ ] Validar contagem de registros (Total esperado: ~15k edifícios, ~800k imóveis)

## 5. Validação e Testes

- [ ] Comparar resultado da busca local vs API
- [ ] Verificar performance (latência)
- [ ] Validar integridade dos dados (joins Bairro -> Edifício -> Imóvel)
