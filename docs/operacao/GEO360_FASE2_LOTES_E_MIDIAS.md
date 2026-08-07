# GEO360 — fase 2: lotes, empreendimentos e mídias

## Objetivo

Complementar as unidades já existentes em `imoveis_rancho` com informações oficiais
compartilhadas pelo lote: nome do condomínio, endereço, ocupação, áreas, geometria,
centroide e metadados das fotos públicas.

Para cada inscrição imobiliária, a fase também atualiza colunas separadas com
endereço oficial, ocupação, tipo de edificação e área construída informados pelo
Portal ICAD. Os valores antigos são preservados em suas colunas originais para
auditoria e comparação.

Os dados são gravados uma única vez por `(cidade, id_lote)` em `geo360_lotes`. As
unidades continuam individualizadas em `imoveis_rancho` e se relacionam ao lote sem
duplicar consultas ao portal.

## Fontes

- Cadastro e geometria: API Cadastro GEO360.
- Caracterização: `openrest.geo360.com.br/rest/rpc/portal_info_lote`.
- Mídias de Goiânia: `plataforma.geo360.com.br/django/municipio/midia/search2/params/`.
- Arquivo da foto: URL pública informada no campo `link`; o sincronizador armazena o
  metadado e não copia o JPEG para o banco.

Os tokens são públicos, anônimos, temporários e obtidos pelo leitor específico de
cada município. Nenhum token é persistido no banco ou em log.

## Execução segura

Aplicar primeiro as migrações. Validar um lote conhecido antes de iniciar lotes em
lote:

```bash
npm run geo360:lotes --workspace @elyon/backend -- --cidade=goiania --id-lote=76693
```

Carga incremental padrão (até 1.000 lotes com múltiplas unidades):

```bash
npm run geo360:lotes --workspace @elyon/backend -- --cidade=goiania --limite=1000 --concorrencia=3
npm run geo360:lotes --workspace @elyon/backend -- --cidade=aparecidadegoiania --limite=1000 --concorrencia=3
```

Por padrão, mídias são consultadas em Goiânia. Em Aparecida, a caracterização está
habilitada, mas a mídia fica desativada porque o leitor público atualmente recebe
HTTP 401 nesse serviço. Isso pode ser retestado de forma explícita com
`--com-midias`; uma falha de mídia preserva os dados cadastrais já obtidos.

Opções operacionais:

- `--todos-os-lotes`: inclui lotes com uma única unidade;
- `--sem-midias`: ignora o serviço de fotos;
- `--com-midias`: força a tentativa de fotos;
- `--pausa-ms=250`: intervalo entre lotes de trabalho;
- `--deadline-minutos=30`: encerra de forma retomável no prazo definido.

Estados concluídos não são reconsultados. `PENDENTE`, `ERRO` e falhas parciais de
mídia podem ser retomados sem perder caracterizações válidas.
