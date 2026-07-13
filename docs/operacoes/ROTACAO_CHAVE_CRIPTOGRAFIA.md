# Rotação da chave de criptografia

O backend usa AES-256-GCM com envelope `v2` e identifica a chave que cifrou cada credencial. A aplicação não inicia sem `ENCRYPTION_KEY` e `ENCRYPTION_KEY_ID` válidas.

## Variáveis

- `ENCRYPTION_KEY`: chave ativa de 32 bytes em Base64 (`openssl rand -base64 32`).
- `ENCRYPTION_KEY_ID`: identificador operacional único da chave ativa.
- `ENCRYPTION_KEY_PREVIOUS` e `ENCRYPTION_KEY_PREVIOUS_ID`: par temporário para ler a versão imediatamente anterior.
- `ENCRYPTION_KEY_LEGACY`: compatibilidade temporária com cifras sem versão. Nunca deve permanecer configurada após a migração inicial.

Os valores das chaves não devem aparecer em logs, tickets, commits ou saída de terminal. O arquivo `.env` deve pertencer a `root:root` e usar permissão `600`.

## Migração inicial do formato legado

1. Faça backup consistente do PostgreSQL e confirme que a restauração é possível.
2. Configure a nova chave ativa e, temporariamente, `ENCRYPTION_KEY_LEGACY` com a chave histórica.
3. Faça deploy da versão que entende os dois formatos.
4. Confirme o health check e execute no container do backend:

   ```sh
   npm run crypto:inventory
   npm run crypto:rotate
   npm run crypto:verify
   ```

5. Remova `ENCRYPTION_KEY_LEGACY` da `.env`, recrie o backend e execute `npm run crypto:verify` novamente.
6. Valide leitura e teste das configurações LLM e CRM sem expor as credenciais.

`crypto:inventory` é somente leitura. `crypto:rotate` primeiro descriptografa todos os registros e só então os atualiza em uma transação com proteção contra escrita concorrente. Qualquer falha aborta a transação inteira.

## Rotações futuras

1. Mova a chave ativa atual para o par `PREVIOUS`.
2. Gere uma nova chave e um novo ID para o par ativo.
3. Recrie o backend e execute inventário, rotação e verificação.
4. Remova o par `PREVIOUS`, recrie o backend e verifique novamente.

## Rollback

Depois que `crypto:rotate` for aplicado, não faça rollback para uma imagem anterior ao suporte ao envelope `v2`: ela não consegue ler as novas cifras. Se um rollback desse tipo for inevitável, restaure também o backup do banco anterior à rotação. Imagens que já suportam `v2` podem ser revertidas normalmente, desde que as chaves exigidas continuem disponíveis.
