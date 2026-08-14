# REDU Format - Documentação de Estrutura de Backend

Este documento descreve a estrutura de backend recomendada para o REDU Format a partir do estado atual do projeto.

Hoje o projeto é um site Next.js 16 com App Router, React 19 e TypeScript. A interface já está pronta para consumir funções assíncronas de servidor, mas os dados mutáveis ainda vivem em memória ou em cookies. A proposta aqui é transformar esses pontos em uma camada persistente, mantendo o máximo possível das páginas e Server Actions existentes.

## 0. Status desta migração

- **Fase 1 (banco e repositórios) - concluída.** `tournaments` e `registrations` persistem em banco; `lib/tournaments.ts` virou fachada fina sobre `lib/backend/services/tournament.service.ts`. Os call sites (páginas, Server Actions) não mudaram. Desvios do plano original ficam marcados **(implementado)** na seção 5.
- **Banco: MariaDB, não PostgreSQL.** O ambiente disponível é uma instância MariaDB já existente (sem servidor PostgreSQL dedicado), então a stack e a sintaxe deste documento foram adaptadas para MariaDB. Os pontos onde a sintaxe diverge do Postgres original (índice único parcial, `jsonb`, timezone de `NOW()`) estão anotados nas seções 3 e 5.
- **Rate limit: tabela MariaDB, não Redis.** Sem servidor Redis dedicado disponível, o rate limit de janela fixa foi implementado como tabela `rate_limits` no mesmo MariaDB (seção 5), cobrindo o mesmo requisito da Fase 4 (compartilhar entre instâncias) sem infraestrutura nova. `lib/rate-limit.ts` também virou fachada, e a função `rateLimit()` agora é assíncrona.
- **Bug de rate limit corrigido.** `login()` e `linkNexusToken()` usavam a mesma chave (`ip` puro) e por isso compartilhavam o mesmo balde; agora usam `login:{ip}` e `nexus-link:{ip}` respectivamente.
- **Fase 2 (auditoria persistente) - concluída.** `lib/audit-log.ts` virou fachada sobre `lib/backend/services/audit.service.ts`; `audit_logs` (criada na Fase 1) agora é a fonte real, sem limite de 1000 entradas. `/admin/logs` ganhou paginação e filtros por ator/ação/alvo. Login admin (`app/admin/callback/route.ts`) agora faz upsert em `admins`, então `audit_logs.actor_admin_id` liga de verdade a partir do primeiro login pós-migração (entradas antigas ficam com `actor_admin_id = NULL`, sem retrofit).
- **Lição de timezone se repetiu, generalizada.** O mesmo problema do rate limit (comparar timestamp UTC contra `NOW()` do servidor) se manifestou de novo, de outra forma: `audit_logs.at` gravado com precisão de segundo deixava duas entradas no mesmo segundo empatadas, e o desempate por `id` (UUID aleatório) embaralhava a ordem "mais recente primeiro". Corrigido do mesmo jeito que `rate_limits.reset_at` - `DATETIME(3)`, sempre calculado em JS (`toMysqlDatetimeMs`/`fromMysqlDatetimeMs`, extraídos para `lib/backend/db/datetime.ts` e reusados nos dois lugares). Migration `003_audit_logs_at_precision.sql`.
- **Hospedagem: Vercel, banco MariaDB gerenciado (LayerBase).** Decisão registrada - Vercel roda o app como funções serverless multi-instância, sem memória compartilhada entre invocações, e a `DATABASE_URL` de produção aponta pro MariaDB hospedado (não `localhost`, que só existe pra dev). Isso confirma que Fase 4 (cache fora do processo) é necessária de verdade, não hipotética - ver abaixo.
- **Pool de conexão dimensionado pro serverless.** `lib/backend/db/client.ts` cria um pool `mysql2` por processo; na Vercel, cada instância de função é um processo separado, cada um com seu próprio pool. Com o `connectionLimit` padrão do driver (10), muitas instâncias concorrentes multiplicam rápido e podem estourar o `max_connections` do banco. Reduzido pra `connectionLimit: 3` - uma requisição aqui é curta e I/O-bound, não precisa de muita concorrência por instância.
- **Fase 4 (cache de perfil Nexus fora do processo) - concluída.** Tabela `nexus_profile_cache` no mesmo MariaDB, mesma decisão que o rate limit já tinha tomado (seção 0 acima) - sem Redis. `fetchProfile()` em `lib/auth.ts` virou um cache de duas camadas: o `Map` em memória continua como L1 (grátis numa instância já quente), a tabela é L2 (compartilhada entre instâncias). `invalidateProfile()` (usada pelo botão "Refresh") agora é assíncrona e limpa as duas camadas.
- **Identidade Nexus (seção 14) - decidida.** Testado contra a API real: nenhum campo de ID estável existe (`success, name, contributor, avatar, ranking, deck`). Decisão do dono do produto: `sha256(token)` como `nexus_identity_key`, com reconciliação por `nexus_name` no login/registro/save quando o hash não bate com nenhum player existente - reduz o caso comum de token regenerado sem eliminar o risco por completo (nome também pode mudar). Isso desbloqueou a Fase 3.
- **Fase 3 (inscrições públicas no banco) - núcleo concluído.** `players` e `saved_tournaments` são tabelas novas; `registrations` ganhou `player_id`/`source`/`deck_id` e o valor `not_required` em `payment_status`. `signups`/`savedTournaments` saíram do cookie `redu_session` de vez - `register()`, `cancel()`, `saveTournamentAction()`, `unsaveTournamentAction()` e as páginas que liam a sessão (`/events`, `/events/[slug]`, `/events/[slug]/signup`, `/dashboard`) leem e escrevem no banco agora. `tournaments.taken` deixou de ser um campo editável e virou `COUNT(*)` real sobre `registrations` (admin manual + inscrição pública juntos) - a coluna física foi dropada (`004_players_and_signups.sql`), não só ignorada. Participantes públicos e manuais já aparecem juntos em `/admin/tournaments/[slug]/participants`, rotulados por origem - isso saiu de graça, o dado já estava unificado desde a Fase 1. **Deferido desta fase**, ver seção 11: `deck_snapshot`/`deck_validation` persistidos (decks continuam revalidados ao vivo contra a Nexus a cada leitura, igual sempre foi), `entry_type_snapshot` como coluna própria (hoje o `payment_status` inicial já é calculado a partir do `entry_type` do momento do registro, só não fica congelado numa coluna separada), lock transacional de capacidade (`SELECT ... FOR UPDATE` - o gate de "sold out" preexistente já não tinha isso, então não é uma regressão nova).
- Fases 5, 6 ainda não começaram.

## 1. Estado Atual Encontrado no Projeto

### Stack atual

- Next.js 16 com App Router.
- React 19.
- TypeScript em modo `strict`.
- Turbopack no fluxo de desenvolvimento/build do Next.
- Sem framework de UI; design system proprio em `app/globals.css`.
- Testes com `node --experimental-strip-types --test`, sem Jest/Vitest.
- MariaDB (`mysql2`) para a camada de backend que já existe (ver seção 0).

### Modulos que hoje funcionam como backend

| Area | Arquivo atual | Estado atual | O que vira no backend |
| --- | --- | --- | --- |
| Torneios admin | `lib/tournaments.ts` (fachada) | **Implementado:** tabela `tournaments` em MariaDB via `lib/backend/services/tournament.service.ts`, `taken` derivado de `registrations` | Feito para CRUD; falta status/lifecycle mais rico (seção 5) |
| Participantes admin | `lib/tournaments.ts` (fachada) | **Implementado:** tabela `registrations`, admin manual e inscrição pública unificados, rotulados por origem em `/admin/tournaments/[slug]/participants` | Feito |
| Auditoria admin | `lib/audit-log.ts` (fachada) | **Implementado:** tabela `audit_logs` em MariaDB, paginada e filtrável, sem limite de 1000 | Feito - falta só popular `metadata`/`target_type`/`target_slug`, que hoje ficam nulos porque nada ainda produz esses dados |
| Rate limit | `lib/rate-limit.ts` (fachada) | **Implementado:** tabela `rate_limits` em MariaDB, janela fixa | Feito - compartilha estado entre instâncias sem Redis |
| Login usuario Nexus | `lib/auth.ts` + `lib/backend/services/player.service.ts` | Token em cookie criptografado; perfil cacheado em duas camadas (memoria + tabela `nexus_profile_cache`); `players` upserted no login/refresh/registro | Feito |
| Inscricoes publicas | `app/events/[slug]/signup/actions.ts` + `lib/backend/services/registration.service.ts` | **Implementado:** tabela `registrations` (`source = public_signup`), vinculada a `players` | Feito - snapshot de deck/entry type ainda não persistido, ver seção 0 |
| Torneios salvos | `app/events/saved-actions.ts` + `lib/backend/services/registration.service.ts` | **Implementado:** tabela `saved_tournaments`, vinculada a `players` | Feito |
| Leaderboard | `lib/leaderboard.ts` | Lista mockada estatica | Consulta derivada de resultados reais (Fase 5) |
| Resultados/placing | `mockPlacement()` em `lib/events.ts` | Hash deterministico | Motor de rodadas, partidas e standings (Fase 5) |
| Cartas/banlist | `lib/cardLib.ts`, `lib/cards.ts`, `lib/banlist.ts`, `lib/validateDecks.ts` | Dataset estatico server-only | Continua estatico; nao precisa de banco inicialmente |

### Fluxos importantes

- Usuario publico autentica com token da Dueling Nexus.
- Admin autentica com Discord OAuth2 e precisa ter cargo de moderador na guild.
- Usuario e admin usam cookies separados e nao devem compartilhar estado de autenticacao.
- Admin pode linkar um token Nexus dentro da sessao admin, sem misturar isso com a sessao publica.
- Inscricao publica valida:
  - usuario logado via Nexus;
  - evento existente e futuro;
  - vaga disponivel;
  - deck escolhido pertence ao usuario;
  - deck respeita tamanho, pool REDU, banlist e errata.
- Admin gerencia torneios, participantes e confirmacao/contestacao de pagamento.
- Todas as acoes admin relevantes registram auditoria.
- Usuario logado pode salvar/remover qualquer torneio (futuro ou ja aberto para inscricao, com ou sem vaga; nao ha restricao de status), visivel numa secao "Salvos" no `/dashboard`. Nao precisa estar inscrito para salvar.

## 2. Objetivo do Backend Real

O backend deve resolver estes problemas sem reescrever a aplicacao:

1. Persistir torneios, participantes, inscricoes e pagamentos entre deploys. **(feito para torneios/participantes admin)**
2. Persistir auditoria sem limite artificial de 1000 entradas. **(feito)**
3. Unificar inscricoes publicas e participantes admin em uma fonte de verdade. **(feito)**
4. Permitir resultados reais de partidas, bracket e leaderboard. **(pendente - Fase 5)**
5. Compartilhar rate limit/cache entre multiplas instancias. **(feito - rate limit e cache de perfil Nexus, os dois via MariaDB, relevante de verdade agora que a hospedagem é Vercel/serverless)**
6. Manter as duas autenticacoes separadas. **(já era o caso, sem mudança)**
7. Preservar o dataset de cartas como server-only. **(já era o caso, sem mudança)**
8. Evitar processamento de pagamento; o site continua guardando somente status e URL de comprovante. **(já era o caso, sem mudança)**

## 3. Arquitetura Recomendada

### Decisao principal

O primeiro backend nao precisa ser um servico separado. O caminho mais simples e seguro para este projeto e um backend interno no proprio Next.js:

- Server Components continuam lendo dados por funcoes `async`.
- Server Actions continuam sendo a interface das mutacoes.
- Route Handlers (`app/api/**`) entram apenas onde houver integracao externa, logout ou API publica.
- Uma camada `lib/backend/**` concentra banco, repositorios e services.

Se um dia o projeto precisar de app mobile, bots, webhooks externos ou multiplos clientes, essa camada pode virar uma API separada sem mudar as regras de negocio.

### Infra recomendada

- Banco: **MariaDB** (não PostgreSQL - ver seção 0), hospedado na LayerBase. Driver `mysql2`, sem ORM. Pool com `connectionLimit: 3` - ver seção 0, dimensionado pro padrão multi-instância do Vercel.
- Cache/rate limit: **tabela MariaDB** (`rate_limits`, `nexus_profile_cache`), não Redis - ver seção 5. Reavaliar Redis/Upstash apenas se o rate limit ou o cache de perfil se tornarem um gargalo real de performance (não é o caso hoje: são operações de poucas linhas, a latência extra de ida ao banco é irrelevante).
- Storage opcional: Cloudflare R2, S3 ou Supabase Storage, apenas se houver upload real de comprovante.
- Hospedagem: **Vercel** (decisão registrada, seção 0). Serverless/multi-instância - por isso rate limit e cache de perfil Nexus não podiam ficar só em memória de processo, e por isso o pool de conexão do banco foi dimensionado pequeno por instância.

### Estrutura de pastas alvo

```txt
lib/
  backend/
    db/
      client.ts          # pool mysql2, getPool()/resetPool() (implementado)
      migrate.ts          # runner de migrations, tabela _migrations (implementado)
      migrations/
        001_init.sql       # tournaments, registrations, admins, audit_logs (implementado)
        002_rate_limits.sql # rate_limits (implementado)
        003_audit_logs_at_precision.sql # audit_logs.at DATETIME(3) (implementado)
        004_players_and_signups.sql # players, saved_tournaments, registrations.player_id/source/deck_id, tournaments.taken dropado (implementado)
        005_nexus_profile_cache.sql # nexus_profile_cache (implementado)
      seed.ts              # popula tournaments a partir de lib/events.ts (implementado)
      datetime.ts          # conversao UTC <-> DATETIME do MariaDB, precisao de segundo e de milissegundo (implementado)
      test-setup.ts        # isola cada processo de teste em seu proprio banco (implementado)
      run-migrate.ts        # entrypoint do script db:migrate (implementado)
    repositories/
      tournaments.repository.ts     # implementado (taken via subquery derivada, nao coluna)
      registrations.repository.ts   # implementado (admin manual + inscricao publica)
      rate-limits.repository.ts     # implementado
      audit-log.repository.ts       # implementado
      admins.repository.ts          # implementado (upsert + lookup por discord_user_id)
      players.repository.ts         # implementado (upsert por identity key, lookup por nome pra reconciliacao)
      saved-tournaments.repository.ts # implementado
      nexus-profile-cache.repository.ts # implementado
      results.repository.ts         # pendente (Fase 5)
    services/
      tournament.service.ts    # implementado
      rate-limit.service.ts    # implementado
      audit.service.ts         # implementado
      admins.service.ts        # implementado (upsertAdmin, chamado no login)
      player.service.ts        # implementado (resolvePlayerId com reconciliacao, findPlayerIdByToken)
      registration.service.ts  # implementado (signup, cancel, save, unsave)
      nexus-cache.service.ts   # implementado (getCachedProfile/setCachedProfile/invalidateCachedProfile)
      payment.service.ts       # pendente
      leaderboard.service.ts   # pendente (Fase 5)
      results.service.ts       # pendente (Fase 5)
    auth/
      public-session.ts   # pendente
      admin-session.ts    # pendente
      nexus-client.ts     # pendente
      discord-client.ts   # pendente
    validators/
      tournament-input.ts  # pendente
      payment-input.ts     # pendente
      registration-input.ts # pendente
    errors.ts   # pendente
    types.ts    # pendente
```

Arquivos existentes podem permanecer como fachadas temporarias:

- `lib/tournaments.ts` passa a chamar `lib/backend/services/tournament.service.ts`. **(feito)**
- `lib/rate-limit.ts` passa a chamar `lib/backend/services/rate-limit.service.ts`. **(feito)**
- `lib/audit-log.ts` passa a chamar `lib/backend/services/audit.service.ts`. **(feito - `listAuditLog()` ganhou parâmetros de filtro/página e devolve `{items, page, pages, total}` em vez de um array simples; `recordAction()` não mudou de assinatura)**
- `lib/leaderboard.ts` passa a chamar `leaderboard.service.ts`. (pendente)
- `lib/auth.ts` pode continuar expondo `getSession()`, `fetchProfile()` e tipos publicos. **(feito - `Session.signups`/`Session.savedTournaments` foram removidos do tipo; o cookie só guarda mais `token`/`name`/`avatar`/`contributor`/`contributorTime`, na prática ficou menor com essa migração, não maior. O cache de perfil agora consulta `lib/backend/services/nexus-cache.service.ts` como L2, além do `Map` local como L1 - ver seção 0)**
- `player.service.ts` e `registration.service.ts` **não** têm fachada em `lib/` - não existia um `lib/registrations.ts` ou `lib/players.ts` prévio pra preservar, e páginas/actions já importam direto de `@/lib/backend/services/*`, mesmo padrão de `admins.service.ts` na Fase 2.

## 4. Principios de Design

### Preservar os contratos atuais

As paginas e Server Actions ja chamam funcoes como:

- `listTournaments()`
- `getTournament(slug)`
- `createTournament(draft)`
- `updateTournament(slug, draft)` - **(implementado, assinatura mudou: `draft` não carrega mais `taken` - virou derivado, ver seção 5. Único call site, `updateTournamentAction`, reescrito junto)**
- `deleteTournament(slug)`
- `listParticipants(slug)`
- `addParticipant(slug, input)`
- `removeParticipant(slug, id)`
- `setParticipantPayment(slug, id, update)`
- `slugify(name)`
- `recordAction(entry)` - **(implementado, mesma assinatura - os 5 call sites não mudaram)**
- `listAuditLog()` - **(implementado, mas com assinatura nova: `listAuditLog(query?)` devolve `{items, page, pages, total}` em vez de um array. Único call site é `/admin/logs`, reescrito junto - ver seção 7)**
- `rateLimit(key, limit?, windowMs?)` - **(implementado, agora assíncrona: os dois call sites já usam `await`)**

O backend deve primeiro trocar a implementacao dessas funcoes, nao os call sites. Isso reduz risco e deixa a migracao testavel por partes. Para `tournaments`/`registrations`/`rate_limits`/`audit_logs` isso já aconteceu: dos 13 arquivos que importam de `lib/tournaments`, só `app/admin/tournaments/actions.ts` mudou (parou de ler/validar `taken` do form) e `tournament-form.tsx` (campo virou texto read-only); os outros 11, os 2 que chamam `rateLimit` e os 5 que chamam `recordAction` não mudaram de assinatura. `listAuditLog()` e `updateTournament()` são as duas exceções deliberadas - a primeira porque paginação/filtros exigiam mudar o retorno (previsto desde a Fase 2), a segunda porque `taken` parou de ser um dado que o caller fornece.

A sessão pública (`Session` em `lib/auth.ts`) teve seu contrato genuinamente quebrado nesta fase - `signups`/`savedTournaments` saíram do cookie. Isso não é um desvio do princípio acima, é o próprio objetivo da Fase 3 ("Unificar inscricoes publicas e participantes admin em uma fonte de verdade" - não dá pra fazer isso mantendo o cookie como fonte de verdade em paralelo). Os 4 call sites que liam esses campos (`app/events/page.tsx`, `app/events/[slug]/page.tsx`, `app/events/[slug]/signup/page.tsx`, `app/dashboard/page.tsx`) e os 2 que escreviam (`app/events/[slug]/signup/actions.ts`, `app/events/saved-actions.ts`) foram todos reescritos junto.

### Mutacoes sempre passam por services

Repositorios devem fazer CRUD e queries. Regras ficam em services.

Exemplo:

- `registrations.repository.ts`: cria, lista, cancela, conta inscricoes, tanto admin-manual quanto inscrição pública. **(implementado)**
- `registration.service.ts`: **implementado, mas mais enxuto que o alvo original.** Cobre registrar/cancelar/salvar/remover e calcular o `payment_status` inicial a partir do `entry_type` do torneio. Validação de deck legal, evento aberto e "essa vaga ainda existe" continuam na Server Action (`app/events/[slug]/signup/actions.ts`), não no service - mesmo padrão de `readDraft()` em `app/admin/tournaments/actions.ts`, a Fase 1 já tinha estabelecido isso. Concorrência (duas inscrições simultâneas não estourarem `seat_cap`) não tem lock transacional ainda - ver seção 0.

### Auditoria nao e opcional para admin

Toda mutacao admin deve gravar auditoria na mesma transacao logica da acao principal quando possivel:

- criar/editar/deletar torneio;
- adicionar/remover participante;
- confirmar/contestar pagamento;
- login/logout admin;
- link/unlink de token Nexus;
- alteracoes futuras de resultado/bracket.

**Implementado.** `recordAction`/`listAuditLog` (via `lib/audit-log.ts`) gravam e leem a tabela `audit_logs` de verdade, chamados dos mesmos 5 pontos que já existiam (`admin.login`/`admin.logout`, `tournament.*`, `participant.*`, `payment.*`, `nexus.*`). O que ainda não acontece "na mesma transação lógica": cada `recordAction` é um INSERT separado da mutação principal, não envolto numa transação que garanta as duas ou nenhuma - aceitável hoje porque nenhuma dessas mutações é multi-tabela complexa o bastante para deixar o sistema inconsistente se só uma das duas gravar (pior caso: a ação aconteceu mas não ficou registrada, não o contrário).

### Capacidade deve ser transacional

Inscricao em torneio com limite de vagas precisa de controle de concorrencia. Duas pessoas clicando ao mesmo tempo nao podem ultrapassar o limite.

**Parcialmente implementado, sem lock ainda.** `taken` agora é `COUNT(*)` real sobre `registrations` (Fase 3, ver seção 5) - a parte "capacidade reflete inscrições reais" está feita. A parte "duas inscrições simultâneas não ultrapassam `seat_cap`" não: `register()` em `app/events/[slug]/signup/actions.ts` lê `seatsLeft(event)` e rejeita se já é 0, mas entre essa leitura e o `INSERT` não há lock nem transação - duas requisições na última vaga, na mesma fração de segundo, podem ambas passar pelo check e ambas inserir. Isso não é uma regressão desta migração: a versão em memória de antes tinha exatamente a mesma janela de corrida, só que dentro de um único processo Node em vez de duas conexões de banco. Vale endurecer com uma destas estrategias quando isso vier a incomodar de verdade (sem fila/waitlist como terceira opcao: o produto decidiu nao ter - ver secao 14):

- transacao com lock da linha do torneio (`SELECT ... FOR UPDATE`, suportado igual no MariaDB/InnoDB);
- contador derivado com constraint e transacao serializavel.

### Tokens nunca entram em log

Tokens Nexus e segredos OAuth nao devem aparecer em:

- auditoria;
- erros;
- logs de servidor;
- metadata JSON.

Se algum token for persistido fora do cookie, ele deve ser criptografado em repouso.

### Cuidado com o timezone e a precisão do servidor de banco

Duas licoes relacionadas, aprendidas implementando `rate_limits` e depois `audit_logs`:

1. **Nunca compare um timestamp calculado em JS (sempre UTC via `toISOString()`) contra `NOW()` do MariaDB.** `NOW()` lê o timezone configurado no *servidor* de banco, não necessariamente UTC - num servidor configurado para UTC-3, por exemplo, `NOW()` fica permanentemente "3 horas atrás" de um valor UTC gravado pelo app, e uma comparação `coluna < NOW()` nunca fica verdadeira. A correção é sempre passar o "agora" como parâmetro calculado em JS (mesma fonte de verdade usada para gravar), nunca deixar o SQL decidir "agora" sozinho.
2. **Colunas `DATETIME` comuns (precisão de segundo) empatam fácil.** Qualquer coisa que grave múltiplas linhas em rajada - vários hits de rate limit, várias ações de auditoria em sequência - pode gravar duas linhas no mesmo segundo. Se a ordem relativa entre elas importa (ex.: "mais recente primeiro"), um `ORDER BY` que empata cai de volta pra outra coluna (como um `id` aleatório), embaralhando a ordem real. A correção é `DATETIME(3)` (milissegundo) nessas colunas, não `DATETIME` simples.

Os dois helpers ficam em `lib/backend/db/datetime.ts`: `toMysqlDatetime`/`fromMysqlDatetime` (precisão de segundo, usados em `tournaments.starts_at`, onde nem timezone do SQL nem empate por segundo importam) e `toMysqlDatetimeMs`/`fromMysqlDatetimeMs` (milissegundo, usados em `rate_limits.reset_at` e `audit_logs.at`, onde os dois problemas acima já morderam de verdade).

## 5. Modelo de Dados

### Diagrama de entidades

```mermaid
erDiagram
  players ||--o{ registrations : has
  tournaments ||--o{ registrations : receives
  registrations ||--o{ payment_events : records
  admins ||--o{ audit_logs : writes
  admins ||--o{ payment_events : confirms
  tournaments ||--o{ tournament_rounds : has
  tournament_rounds ||--o{ matches : has
  matches ||--o{ match_players : has
  registrations ||--o{ match_players : plays
  tournaments ||--o{ standings_snapshots : produces
  players ||--o{ saved_tournaments : bookmarks
  tournaments ||--o{ saved_tournaments : saved_by
```

### `players`

**Implementado** (`lib/backend/db/migrations/004_players_and_signups.sql`, `lib/backend/repositories/players.repository.ts`, `lib/backend/services/player.service.ts`). Representa um jogador autenticado pela Dueling Nexus.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | CHAR(36) PK | Identidade interna |
| `nexus_identity_key` | CHAR(64) unique | `sha256(token)` hex. Confirmado contra a API real (seção 0/14): não existe campo de ID estável, então isso é a decisão final, não um placeholder |
| `nexus_name` | VARCHAR(255), indexado | Nome exibido pela Nexus - também a chave de reconciliação, ver abaixo |
| `avatar_url` | VARCHAR(2048) nullable | URL externa já sanitizada |
| `contributor` | TINYINT(1) | Snapshot do perfil |
| `contributor_time` | BIGINT nullable | Mantido sem renderização, como hoje |
| `last_seen_at` | DATETIME | Último login/refresh/registro/save |
| `created_at` | DATETIME | Criação |
| `updated_at` | DATETIME | Atualização |

**Reconciliação por nome, para sobreviver a um token regenerado.** `resolvePlayerId(token, profile)` primeiro busca por `nexus_identity_key`; se não achar, busca por `nexus_name` antes de criar uma linha nova - se achar, atualiza a `nexus_identity_key` daquele player para a nova, em vez de criar um segundo jogador. Decisão registrada na seção 0: reduz o caso comum (token perdido/trocado de dispositivo/regenerado por segurança) sem ser perfeita (um jogador que troca de nome na Nexus *e* regenera o token no mesmo intervalo ainda forka). Chamado em `login()`/`refresh()` (`app/login/actions.ts`) e em `register()`/`saveTournamentAction()` (que já tinham o profile em mãos ou precisavam buscá-lo de qualquer forma) - existir em múltiplos pontos, não só no login, cobre sessões que já existiam antes desta migração e nunca mais passaram por login/refresh.

Notas:

- O token Nexus continua só no cookie criptografado - `players` não guarda token, criptografado ou não.
- `id` do player **não** é cacheado no cookie de sessão (`Session` em `lib/auth.ts` não tem campo `playerId`). Toda leitura resolve de novo via `findPlayerIdByToken(token)` (lookup puro por hash, sem chamar a API da Nexus) - ver seção 4, "Preservar contratos atuais", pra por que isso foi preferido a um campo de sessão que podia ficar dessincronizado.
- `player_sessions` (token criptografado, pra buscar decks em background) continua não implementado - nada hoje precisa disso.

### `admins`

Representa um admin validado via Discord. **Implementado.** Tabela criada na Fase 1 (`001_init.sql`); populada a partir da Fase 2 via `lib/backend/repositories/admins.repository.ts` (`upsert`, chamado em `app/admin/callback/route.ts` a cada login) e `findIdByDiscordUserId` (usado por `audit.service.ts` pra resolver `audit_logs.actor_admin_id`). Login admin continua baseado no cookie JWT (`admin_session`) - esta tabela não autentica ninguém, só dá um id interno estável pra linkar auditoria.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | UUID PK (CHAR(36)) | Identidade interna |
| `discord_user_id` | VARCHAR(32) unique | Snowflake estavel |
| `username` | VARCHAR(255) | Snapshot do handle |
| `display_name` | VARCHAR(255) | Snapshot do global name ou username |
| `last_role_check_at` | DATETIME nullable | Ultima verificacao do cargo |
| `created_at` | DATETIME | Criacao |
| `updated_at` | DATETIME | Atualizacao |

Nao e necessario persistir access token/refresh token do Discord, porque o app usa o OAuth somente para login e depois checa o cargo pela API com bot token.

### `admin_nexus_links`

Opcional, ainda não criada. Hoje o token Nexus linkado fica dentro do JWT admin. Se quiser revogacao, auditoria mais rica ou sessao server-side, mova para banco.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `admin_id` | UUID FK | Admin dono do link |
| `token_ciphertext` | text | Token criptografado |
| `nexus_name` | text | Snapshot para exibicao |
| `linked_at` | timestamptz | Quando foi linkado |
| `updated_at` | timestamptz | Ultima atualizacao |

### `tournaments`

**Implementado** (`lib/backend/db/migrations/001_init.sql`, `lib/backend/repositories/tournaments.repository.ts`). Fonte persistente dos eventos editaveis.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | CHAR(36) PK | Identidade interna |
| `slug` | VARCHAR(255) | Mantem URLs atuais; unico so entre linhas vivas via `slug_active`, ver nota abaixo |
| `name` | VARCHAR(255) | Nome |
| `starts_at` | DATETIME | Sempre armazenado em UTC (o app converte, nunca confia no timezone do servidor - ver seção 4) |
| `structure` | ENUM | `swiss`, `single-elim`, `double-elim` |
| `rounds` | INT | Rodadas planejadas |
| `top_cut` | INT nullable | Tamanho do corte |
| `match_format` | ENUM | `Bo1`, `Bo3` |
| `time_limit_minutes` | INT | Timer antes do procedimento final |
| `seat_cap` | INT nullable | `null` = ilimitado |
| `taken` | INT | **Desvio do plano original: continua um campo editável pelo admin, não derivado de `registrations`.** Ver "Contador `taken`" abaixo. |
| `entry_type` | ENUM | `free`, `paid` |
| `entry_amount_minor` | INT nullable | Valor em centavos/unidade menor, convertido na borda pelo repositorio |
| `entry_currency` | CHAR(3) nullable | ISO 4217 |
| `host` | VARCHAR(255) | Ex.: Dueling Nexus |
| `signup_url` | VARCHAR(2048) | Mantem campo atual |
| `created_at` | DATETIME | Criacao |
| `updated_at` | DATETIME | Atualizacao |
| `deleted_at` | DATETIME nullable | Coluna existe, mas **não usada** - delete continua hard delete (ver nota abaixo) |

MariaDB não tem índice único parcial (`WHERE deleted_at IS NULL`) como o Postgres. A implementação usa uma coluna gerada:

```sql
slug_active VARCHAR(255) AS (IF(deleted_at IS NULL, slug, NULL)) STORED,
UNIQUE KEY uq_tournaments_slug_active (slug_active)
```

MariaDB trata cada `NULL` como distinto num índice único, então uma linha com `deleted_at` preenchido libera o slug automaticamente para reuso, sem travar a constraint - o mesmo comportamento que `uniqueSlug()` já tinha com hard delete.

**Desvio: delete continua hard delete, não soft delete.** O plano original recomendava soft delete para preservar auditoria; a implementação da Fase 1 manteve hard delete porque é o que os testes existentes (`lib/tournaments.test.ts`) e o contrato atual (`deleteTournament()` retornando `boolean`, `getTournament()` retornando `null` depois) já esperavam. A Fase 2 (auditoria persistente) veio e não precisou disso: `audit_logs` é uma tabela separada, o registro `tournament.delete` sobrevive independente do que acontece com a linha em `tournaments` - "preservar auditoria" não dependia de soft delete, só de auditoria persistente, que já está feita. Soft delete continua útil só se um dia importar reter o *torneio em si* (não só o log da ação) depois de deletado - ex.: pra reabrir por engano, ou mostrar resultados de um evento cancelado. A coluna `deleted_at`/`slug_active` já está pronta pra isso - a mudança seria só trocar `DELETE` por `UPDATE ... SET deleted_at = NOW()` no repositorio, sem migration nova.

**Contador `taken` - resolvido na Fase 3, agora derivado.** A Fase 1 tinha mantido `taken` como coluna editável pelo admin, deliberadamente, porque na época `registrations` só tinha participantes manuais sem relação nenhuma com esse número (ver histórico abaixo). Isso deixou de ser verdade com inscrição pública real: a coluna física `taken` foi **dropada** (`004_players_and_signups.sql`) e `TournamentsRepository.findAll()`/`findBySlug()` agora computam `(SELECT COUNT(*) FROM registrations r WHERE r.tournament_id = t.id) AS taken` - toda linha em `registrations` ocupa uma vaga, admin manual ou inscrição pública, pago ou não. `updateTournament()` não aceita mais `taken` no draft; `tournament-form.tsx` mostra o valor como texto, não como campo editável.

<details>
<summary>Raciocínio original da Fase 1 (histórico, já não se aplica)</summary>

O plano original queria `taken` derivado de `COUNT(*)` em `registrations` desde o início. A Fase 1 manteve `taken` como coluna editável porque `registrations` só recebia participantes manuais do admin, sem nenhuma relação definida com o número que o admin digitava em "seats taken" - inscrição pública, que tornaria `taken` um dado real de negócio, só existia a partir da Fase 3. Derivar `taken` naquele momento teria sido construir para um requisito que ainda não existia.

</details>

Notas adicionais:

- `top_cut` deve continuar derivado por `recommendedTopCut()` quando aplicavel (feito, na Server Action, não mudou).
- `pastEvents` de `lib/events.ts` **não foi migrado** - o seed (`lib/backend/db/seed.ts`) só popula a partir de `events` (os torneios editáveis pelo admin), replicando o que o mock em memória já fazia. `pastEvents`/`YCS Providence 2012` continuam como conteúdo estático (ver seção 14, "Eventos historicos").
- **Decisao: `status` e lifecycle manual/admin, gravado, nao derivado** (ainda não implementado - a tabela não tem coluna `status` hoje, só existe implicitamente via `deleted_at`/existência da linha). `draft -> open -> locked -> running -> completed`, com `cancelled` alcancavel de qualquer estado nao-terminal, continua o design alvo para quando o admin precisar travar/rodar eventos manualmente; não foi necessário para a Fase 1 porque nenhuma tela ainda depende desse campo. `isPast(event, now)` continua existindo em `lib/events.ts`, inalterado.

### `registrations`

**Implementado** (`001_init.sql` + `004_players_and_signups.sql`, `lib/backend/repositories/registrations.repository.ts`). Cobre admin manual **e** inscrição pública na mesma tabela, unificados desde a escrita - `listParticipants()`/`/admin/tournaments/[slug]/participants` não filtram por origem, então as duas fontes já aparecem juntas.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | CHAR(36) PK | Identidade interna |
| `tournament_id` | CHAR(36) FK -> `tournaments.id`, `ON DELETE CASCADE` | Torneio |
| `player_id` | CHAR(36) FK nullable -> `players.id`, `ON DELETE SET NULL` | Nulo para participante manual |
| `source` | ENUM(`public_signup`,`admin_manual`), default `admin_manual` | De onde veio a inscrição |
| `display_name` | VARCHAR(255) | Nome exibido no torneio - nome da Nexus no momento da inscrição para `public_signup`, texto livre para `admin_manual` |
| `deck_name` | VARCHAR(255) | Nome do deck no momento da inscrição |
| `deck_id` | VARCHAR(64) nullable | ID do deck na Nexus, só para `public_signup` - é o que permite trocar de deck sem duplicar linha (ver `upsertPublicSignup` abaixo) |
| `payment_status` | ENUM(`pending`,`confirmed`,`contested`,`not_required`) | `not_required` para inscrição pública num torneio grátis; admin manual continua sempre nascendo `pending` mesmo em torneio grátis - ver nota abaixo |
| `proof_url` | VARCHAR(2048) nullable | URL externa do comprovante |
| `payment_by` | VARCHAR(255) nullable | Nome de exibição de quem confirmou/contestou por último (texto solto, não FK) |
| `payment_at` | DATETIME nullable | Quando o status foi alterado, gravado em JS/UTC (não `NOW()` - ver seção 4) |
| `created_at` | DATETIME | Criacao |

`ON DELETE CASCADE` em `tournament_id` cobre o comportamento que o teste `"delete removes the tournament and its participants"` já exigia. `UNIQUE (tournament_id, player_id)` impede duas inscrições ativas do mesmo jogador no mesmo torneio - como toda linha `admin_manual` tem `player_id = NULL`, e o MariaDB trata cada `NULL` como distinto num índice único, várias linhas manuais no mesmo torneio continuam permitidas sem precisar da técnica de coluna gerada usada em `tournaments.slug_active`.

**Assimetria conhecida e deliberada:** `addParticipant()` (fluxo admin manual) sempre grava `pending`, mesmo num torneio grátis - esse comportamento já existia desde a Fase 1 e os testes de `lib/tournaments.test.ts` esperam exatamente isso. Só o fluxo novo (`registerSignup()`, público) calcula `not_required`/`pending` a partir do `entry_type` do torneio. Corrigir a assimetria (fazer `addParticipant` também respeitar `entry_type`) fica pra quando alguém mexer nesse fluxo por outro motivo - mudar agora só pra "ficar mais certo" quebraria um teste existente sem nenhum requisito pedindo isso.

`upsertPublicSignup` (registrar, ou trocar de deck se já inscrito) usa `INSERT ... ON DUPLICATE KEY UPDATE` sobre esse mesmo `UNIQUE (tournament_id, player_id)` - reaproveita a constraint em vez de fazer um `SELECT` antes pra decidir entre `INSERT`/`UPDATE`. Nunca toca `payment_status` na atualização: trocar de deck depois de ter o pagamento confirmado não deve resetar a confirmação.

**Ainda não implementado** (modelo-alvo original, não bloqueia nada hoje):

| Campo (alvo) | Tipo | Observacao |
| --- | --- | --- |
| `status` | enum | `registered`, `cancelled`, `dropped`, `disqualified` — sem `waitlisted`, ver secao 14. Hoje é implícito: linha existe = registrado, `DELETE` = cancelado, igual sempre foi (Fase 1 e o mock antigo também não tinham `status`) |
| `deck_snapshot` | jsonb nullable (`JSON` no MariaDB) | Lista validada no momento da inscricao. Hoje o deck continua sendo revalidado ao vivo contra a Nexus a cada leitura, igual sempre foi - não é uma regressão, só não ganhou o congelamento histórico que o plano original queria |
| `deck_validation` | jsonb nullable (`JSON` no MariaDB) | Resultado/erros da validacao, mesma razão acima |
| `entry_type_snapshot` | enum | O `payment_status` inicial já é calculado a partir do `entry_type` do momento da inscrição (mesmo efeito prático), só não fica congelado numa coluna própria - se o admin mudar `entry_type` depois, registros antigos não têm como provar retroativamente qual era o valor original |
| `payment_by_admin_id` | UUID FK nullable | Ultimo admin que alterou pagamento (hoje é `payment_by` texto solto, sem FK - `admins` existe mas nada aqui liga a ela ainda) |
| `created_by_admin_id` | UUID FK nullable | Para participante manual |
| `cancelled_at` | timestamptz nullable | Cancelamento - N/A enquanto cancelar for `DELETE` em vez de soft-cancel |

Gap conhecido, sem constraint que resolva sozinha:

- A unique key só vale enquanto uma inscrição `admin_manual` tem `player_id = NULL`. Um jogador que o admin cadastrou manualmente e depois se inscreve pela própria conta Nexus fica com duas linhas em `registrations` para o mesmo torneio, sem nenhum jeito automático de perceber. Se isso importar, o fluxo de "linkar" um `registration.admin_manual` a um `player_id` precisa ser uma acao explicita do admin (nao uma constraint), e vale registrar em auditoria quando acontecer.

Decisao: `payment_status = pending` ocupa vaga.

- `pending` conta para `taken`/`seat_cap` assim que a inscricao e criada, do mesmo jeito que o app mockado (e agora o real) sempre fez: `register()` grava o signup na hora, sem nenhuma etapa de pagamento no meio, porque o pagamento sempre acontece fora do site (PIX, Discord etc.) e so aparece no sistema quando o admin confirma depois. Nao existe checkout embutido pra justificar segurar a vaga separada.
- Isso significa que uma vaga pode ficar presa indefinidamente com alguem que nunca paga. Nao ha expiracao automatica: liberar a vaga e responsabilidade do admin, cancelando a `registration` manualmente (o que ja aparece em auditoria via `participant.remove`/equivalente). Automatizar isso fica pra quando isso incomodar de verdade — nao adianta construir um job de expiracao para um problema que ainda nao apareceu.
- Capacidade (`seatsLeft(event) === 0` bloqueia `register()`) conta toda linha de `registrations`, `pending` incluso, mesmo sabendo que parte pode nunca confirmar. Sem lock transacional ainda - ver seção 4, "Capacidade deve ser transacional".

Observacao importante:

- **Resolvido: sem waitlist.** A UI e o codigo foram ajustados pra parar de prometer fila de espera — o botao no `/events` e o `/events/[slug]` agora mostram "Sold out" (nao "Waitlist"/"Join the waitlist"), e nenhum CTA de inscricao aparece quando `seats_left = 0`. O enum de status-alvo (tabela acima) nao tem `waitlisted` — nao e so "sem uso", foi tirado do modelo, porque manter um valor de enum que nenhum fluxo produz e confusao futura, nao completude.

### `saved_tournaments`

**Implementado** (`004_players_and_signups.sql`, `lib/backend/repositories/saved-tournaments.repository.ts`). Bookmark simples: usuario logado salva um torneio (futuro ou ja aberto pra inscricao, com ou sem vaga, registrado ou nao) pra achar depois na aba "Salvos" do `/dashboard`. Saiu do cookie `redu_session` (`session.savedTournaments`) de vez.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | CHAR(36) PK | Identidade interna |
| `player_id` | CHAR(36) FK -> `players.id`, `ON DELETE CASCADE` | Quem salvou |
| `tournament_slug` | VARCHAR(255) | **Desvio do plano original:** slug, não `tournament_id` FK. `saveTournamentAction()` já permitia salvar o `FEATURED_EVENT` e qualquer `pastEvents` (`isKnownTournament()` em `app/events/saved-actions.ts`) - nenhum dos dois é uma linha em `tournaments`, então uma FK não teria como apontar pra eles. Slug é o único identificador que existe tanto pra torneios persistidos quanto pra conteúdo estático |
| `created_at` | DATETIME | Quando foi salvo |

Constraint: `UNIQUE (player_id, tournament_slug)` — salvar de novo o que ja esta salvo e no-op (`INSERT IGNORE`), nao duplicata nem erro. Sem `payment_status`, sem `deck_id`, sem nada que `registrations` tem: e so um bookmark, nao uma inscricao. Nao conta pra `taken`/capacidade do torneio.

### `payment_events`

Ainda não implementado. Historico granular de pagamento. Ajuda a responder quem confirmou, contestou e quando, mesmo que `registrations` guarde o ultimo estado.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | UUID PK | Identidade |
| `registration_id` | UUID FK | Inscricao |
| `admin_id` | UUID FK | Admin que alterou |
| `from_status` | enum nullable | Estado anterior |
| `to_status` | enum | Novo estado |
| `proof_url` | text nullable | URL usada |
| `note` | text nullable | Motivo opcional futuro |
| `created_at` | timestamptz | Criacao |

Hoje esse histórico simplesmente não existe: `setParticipantPayment()` sobrescreve `payment_status`/`proof_url`/`payment_by`/`payment_at` na própria linha de `registrations`, perdendo o estado anterior - igual o mock em memória sempre fez. Só passa a importar quando alguém precisar responder "quem confirmou antes de ser contestado".

### `audit_logs`

**Implementado.** Tabela criada na Fase 1 (`001_init.sql`), precisão de `at` corrigida na Fase 2 (`003_audit_logs_at_precision.sql`, ver seção 4). `lib/audit-log.ts` (fachada) -> `lib/backend/services/audit.service.ts` -> `lib/backend/repositories/audit-log.repository.ts` é a fonte real agora; nada mais lê/escreve em memória, sem limite de 1000. Registro append-only de accountability entre admins.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | CHAR(36) PK | Identidade |
| `at` | **DATETIME(3)**, indexado | Momento. Precisão de milissegundo - ver seção 4, mesma razão que `rate_limits.reset_at` |
| `actor_admin_id` | CHAR(36) FK nullable -> `admins.id`, `ON DELETE SET NULL` | Resolvido em `recordAction()` via `admins.findIdByDiscordUserId()`; `NULL` para entradas anteriores à Fase 2 ou de admins que nunca logaram depois dela (sem retrofit) |
| `actor_discord_user_id` | VARCHAR(32) | Snapshot estavel |
| `actor_username` | VARCHAR(255) | Snapshot |
| `actor_display_name` | VARCHAR(255) | Snapshot |
| `action` | VARCHAR(64), indexado | Ex.: `tournament.create` |
| `target_type` | VARCHAR(32) nullable | **Não populado.** Nenhum call site distingue tipo de alvo hoje - todo `target` que os 5 pontos de chamada de `recordAction()` mandam já é um valor único (slug de torneio, id de participante) |
| `target_id` | VARCHAR(255) nullable | UUID ou slug - é a única das três colunas de alvo realmente usada (mapeia direto de `AuditLogEntry.target`) |
| `target_slug` | VARCHAR(255) nullable | **Não populado**, mesma razão que `target_type` |
| `detail` | TEXT | Linha humana exibida na tela |
| `metadata` | JSON nullable | **Não populado.** Nenhum call site hoje monta um objeto estruturado pra auditoria - a "Auditoria não é opcional" da seção 4 já cobre o essencial com `detail` texto. Fica pronto pra quando algo precisar (era `jsonb` no plano original - MariaDB usa `JSON`, texto validado em vez de binário indexável, sem diferença prática aqui) |
| `request_id` | VARCHAR(64) nullable | **Não populado** - nenhum call site gera/propaga um id de correlação de request hoje |

`ip_hash` e `user_agent` do plano original ficaram de fora da tabela criada - são opcionais no design original e nenhum código ainda os produziria; adicionar depois é só uma coluna nova, sem quebra.

Indices criados:

- `(at)`
- `(actor_discord_user_id, at)`
- `(action, at)`
- `(target_type, target_id, at)` - hoje efetivamente filtra só por `target_id`, já que `target_type` é sempre `NULL`

(O plano original sugeria `DESC` nesses índices; removido por simplicidade - InnoDB varre um índice em qualquer direção sem custo extra relevante nesta escala.)

Filtros implementados em `/admin/logs` (ator, ação, alvo) e paginação (25 por página) usam exatamente essas colunas - `WHERE actor_discord_user_id = ? AND action = ? AND target_id = ?`, condições adicionadas dinamicamente só quando o filtro correspondente vem preenchido, mais `COUNT(*)` com o mesmo `WHERE` pra saber o total de páginas.

### `rate_limits`

**Implementado** (`lib/backend/db/migrations/002_rate_limits.sql`, `lib/backend/repositories/rate-limits.repository.ts`, `lib/backend/services/rate-limit.service.ts`). Substitui o `Map` em memória de `lib/rate-limit.ts` sem precisar de Redis - decisão registrada na seção 0.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `rl_key` | VARCHAR(191) PK | Chave prefixada por uso: `login:{ip}`, `nexus-link:{ip}` etc. (`key` é palavra reservada em SQL, daí `rl_key`) |
| `count` | INT | Contagem na janela atual |
| `reset_at` | **DATETIME(3)** | Fim da janela atual, em UTC. Precisão de milissegundo é necessária aqui (diferente de `starts_at` em `tournaments`) porque a janela pode ser bem menor que 1 segundo em teste; um `DATETIME` comum arredondaria a janela inteira pra zero. |

Uma única linha por chave, atualizada atomicamente via `INSERT ... ON DUPLICATE KEY UPDATE`:

```sql
INSERT INTO rate_limits (rl_key, count, reset_at) VALUES (?, 1, ?)
ON DUPLICATE KEY UPDATE
  count = IF(reset_at < ?, 1, count + 1),
  reset_at = IF(reset_at < ?, VALUES(reset_at), reset_at)
```

O lock de linha do InnoDB nessa única statement garante a mesma atomicidade que um `INCR` do Redis daria - sem condição de corrida entre duas requisições concorrentes na mesma chave. O "agora" e o "reset_at" são calculados em JS (UTC) e passados como parâmetro, nunca via `NOW()` do MariaDB - ver a nota de timezone na seção 4; essa foi a causa raiz de uma falha real durante a implementação (o servidor MariaDB usado não está em UTC, e `NOW()` comparado contra um valor UTC nunca "expirava").

Não há limpeza periódica: uma linha expirada (janela vencida) simplesmente vira `count = 1` com uma janela nova na próxima vez que a chave for usada, em vez de ser deletada. Uma chave que nunca mais é usada fica com uma linha "morta" no banco para sempre - aceitável no volume aqui (uma linha por IP que já tentou logar/linkar, nunca por request), não vale o código extra de um job de limpeza.

Chaves em uso hoje:

- `login:{ip}` (`app/login/actions.ts`)
- `nexus-link:{ip}` (`app/admin/dashboard/actions.ts`)

Padrao:

- fixed window: 8 tentativas por 60 segundos (parâmetros default de `rateLimit()`, iguais ao comportamento anterior em memória).

**Bug corrigido nesta migração:** antes, `login()` (`app/login/actions.ts`) e `linkNexusToken()` (`app/admin/dashboard/actions.ts`) chamavam `rateLimit(ip)` com a mesma chave nua (so o IP, sem prefixo). Como `lib/rate-limit.ts` guardava tudo num unico `Map`/tabela global, login publico e link de token admin *compartilhavam o mesmo balde* quando vinham do mesmo IP: um admin testando o link de Nexus 8 vezes podia bloquear o login publico daquele IP por um minuto, e vice-versa. Corrigido prefixando a chave em cada call site (`rateLimit(\`login:${ip}\`)`, `rateLimit(\`nexus-link:${ip}\`)`).

### `nexus_profile_cache`

**Implementado** (`lib/backend/db/migrations/005_nexus_profile_cache.sql`, `lib/backend/repositories/nexus-profile-cache.repository.ts`, `lib/backend/services/nexus-cache.service.ts`). Fase 4 - substitui o `Map` em memória de `lib/auth.ts` como camada compartilhada entre instâncias, mesma decisão de "MariaDB em vez de Redis" do `rate_limits` (seção 0).

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `token_hash` | CHAR(64) PK | `sha256(token)` hex - mesma função de hash que `cacheKey()` em `lib/auth.ts` já usava pro `Map`, só que agora também é a chave da linha |
| `profile_json` | JSON | O `NexusProfile` inteiro (nome, avatar, contributor, decks, deck lists) serializado. Sempre `JSON.stringify()` na escrita; na leitura, mysql2 ora devolve já parseado, ora como texto puro (variou entre driver/versão observado) - o service normaliza os dois casos em vez de assumir um |
| `expires_at` | DATETIME | Fim da janela de 60s, em UTC, calculado em JS - checado em JS na leitura também (`expiresAt <= Date.now()`), nunca via `NOW()` do SQL (seção 4) |
| `created_at` | DATETIME | Criacao |

Cache de duas camadas em `fetchProfile()`: o `Map` em memória (`lib/auth.ts`) continua sendo a L1 - grátis numa instância já quente, mas não compartilhado entre instâncias da Vercel. Esta tabela é a L2. Uma leitura checa L1 primeiro; num miss, checa L2 (e, se achar, repovoa a L1 com o `expiresAt` *real* da linha, não um TTL novo - do contrário uma instância lendo repetidamente um item quase expirado ia empurrar seu próprio relógio pra frente toda vez, e o cache nunca expiraria de verdade sob tráfego constante); só num miss duplo é que a API da Nexus é chamada, e o resultado grava nas duas camadas. `invalidateProfile()` (usada pelo botão "Refresh") ficou assíncrona pra poder limpar as duas.

Sem limpeza periódica de linhas expiradas, mesma lógica do `rate_limits`: um token que nunca mais aparece deixa uma linha "morta" pra sempre, aceitável no volume aqui.

### `tournament_rounds`, `matches`, `match_players`

Ainda não implementado. Essas tabelas entram quando o projeto sair do `mockPlacement()` (Fase 5).

`tournament_rounds`:

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | UUID PK | Identidade |
| `tournament_id` | UUID FK | Torneio |
| `number` | integer | Rodada |
| `kind` | enum | `swiss`, `top_cut`, `single-elim`, `double-elim` |
| `status` | enum | `pending`, `pairing`, `active`, `completed` |
| `created_at` | timestamptz | Criacao |
| `completed_at` | timestamptz nullable | Fim |

`matches`:

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | UUID PK | Identidade |
| `round_id` | UUID FK | Rodada |
| `table_number` | integer nullable | Mesa |
| `status` | enum | `pending`, `active`, `reported`, `confirmed`, `void` |
| `winner_registration_id` | UUID FK nullable | Vencedor |
| `draw` | boolean | Empate |
| `score` | jsonb nullable (`JSON` no MariaDB) | Ex.: `{ "a": 2, "b": 1 }` |
| `reported_by_admin_id` | UUID FK nullable | Quem reportou |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Atualizacao |

`match_players`:

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `match_id` | UUID FK | Partida |
| `registration_id` | UUID FK | Jogador |
| `seat` | enum | `A`, `B` |
| `result` | enum | `win`, `loss`, `draw`, `bye` |

### `standings_snapshots`

Ainda não implementado. Opcional, mas util para congelar standings no fim de cada rodada.

| Campo | Tipo | Observacao |
| --- | --- | --- |
| `id` | UUID PK | Identidade |
| `tournament_id` | UUID FK | Torneio |
| `round_number` | integer nullable | `null` para final |
| `payload` | jsonb (`JSON` no MariaDB) | Lista rankeada |
| `created_at` | timestamptz | Criacao |

Leaderboard global pode ser calculado a partir de `matches` + `registrations` ou materializado em uma view.

## 6. Services Recomendados

### `tournament.service.ts`

**Implementado** (`lib/backend/services/tournament.service.ts`). Responsabilidades cobertas hoje:

- listar/buscar torneios (`listTournaments`, `getTournament`);
- criar slug unico (`slugify` + verificação contra o banco);
- criar/editar/deletar torneio;
- listar/adicionar/remover participante e alterar status de pagamento.

Ainda pendente:

- filtros equivalentes a `queryEvents()` no banco (hoje `queryEvents()` continua rodando em memória sobre o array retornado por `listTournaments()`, sem mudança - funciona, só não empurra o filtro pro banco);
- validar entrada do formulario admin no service (continua só na Server Action, `readDraft()` em `app/admin/tournaments/actions.ts` - não duplicado);
- calcular `seats_left`, `fill_ratio`, status textual (continuam funções puras em `lib/events.ts`, operando sobre o `TournamentEvent` já lido do banco);
- chamar auditoria em mutacoes admin (já acontecia via `recordAction()` na Server Action, antes e depois da migração - não mudou).

Regras:

- `starts_at` sempre UTC (feito, ver `lib/backend/db/datetime.ts`).
- `top_cut` deve continuar derivado por `recommendedTopCut()` quando aplicavel (feito, na Server Action).
- `entry_amount_minor` deve ser inteiro. Converter o valor decimal do formulario na borda (feito, em `lib/backend/repositories/tournaments.repository.ts`).
- delete preferencialmente soft delete para preservar auditoria e resultados. **Desvio: continua hard delete** - ver nota na seção 5.

### `rate-limit.service.ts`

**Implementado** (`lib/backend/services/rate-limit.service.ts`), não estava no plano original (que previa Redis via `rate-limit.service.ts` só na Fase 4 - a implementação chegou mais cedo, direto em MariaDB). Responsabilidades:

- `rateLimit(key, limit?, windowMs?)`: incrementa o contador da janela fixa e resolve `true`/`false`;
- `resetRateLimits()`: seam de teste, limpa a tabela.

### `nexus-cache.service.ts`

**Implementado** (`lib/backend/services/nexus-cache.service.ts`), Fase 4. Responsabilidades:

- `getCachedProfile<T>(tokenHash)`: lê a linha, checa expiração em JS, devolve `{value, expiresAt}` ou `null`;
- `setCachedProfile(tokenHash, value, ttlMs)`: grava/atualiza, sempre `JSON.stringify()` antes;
- `invalidateCachedProfile(tokenHash)`: apaga a linha;
- `clearProfileCache()`: seam de teste, limpa a tabela inteira.

Genérico o bastante pra cachear qualquer JSON serializável por uma chave de texto - hoje só `lib/auth.ts` usa, pro `NexusProfile`, mas nada aqui é específico de perfil Nexus além do nome da tabela.

### `registration.service.ts`

**Implementado** (`lib/backend/services/registration.service.ts`), mais enxuto que o desenho original - a lista de responsabilidades abaixo mostra o que ficou em qual camada.

- registrar jogador publico em evento; **(feito - `registerSignup()`)**
- cancelar inscricao publica; **(feito - `cancelSignup()`)**
- adicionar participante manual via admin; **(feito, sem mudança - continua `addParticipant()` em `tournament.service.ts`, Fase 1)**
- remover/cancelar participante via admin; **(feito, sem mudança - `removeParticipant()`, Fase 1)**
- impedir duplicidade ativa por jogador; **(feito - `UNIQUE (tournament_id, player_id)`, seção 5, não uma checagem em código)**
- validar capacidade de forma transacional; **(parcial - capacidade é checada, mas sem lock; ver seção 4)**
- persistir snapshot do deck validado; **(não implementado - deck revalidado ao vivo a cada leitura, ver seção 5)**
- salvar/remover torneio em `saved_tournaments`. **(feito - `saveTournament()`/`unsaveTournament()`, upsert idempotente via `INSERT IGNORE`, sem regra de negócio própria como o plano original já previa)**

Fluxo de inscricao publica implementado (`register()` em `app/events/[slug]/signup/actions.ts` + `registerSignup()` no service):

1. Ler sessao publica (`redu_session`). **(feito)**
2. Buscar perfil/decks na Nexus. **(feito)**
3. Confirmar que o deck pertence ao usuario. **(feito)**
4. Validar tamanho e regras REDU com `validateDeck()`. **(feito)**
5. ~~Abrir transacao no banco.~~ **Não implementado** - sem lock, ver seção 4.
6. ~~Buscar torneio com lock.~~ **Não implementado**, mesma razão.
7. Revalidar capacidade (`seatsLeft(event) === 0` bloqueia). **(feito, sem lock)**. Status de lifecycle (`tournaments.status`) não existe ainda - o gate hoje é só `startsAt` no futuro, igual desde a Fase 1.
8. Upsert/criar `player`. **(feito - `resolvePlayerId()`)**
9. ~~Copiar `tournaments.entry_type` para `registration.entry_type_snapshot`.~~ **Não implementado como coluna** - o `entry_type` do momento é lido direto de `tournament.entry` (já em mãos, veio do `getTournament()` que validou o evento) e usado ali mesmo pro passo 11, sem persistir separado. Ver seção 5, "entry_type_snapshot".
10. Criar ou atualizar `registration`. **(feito - `upsertPublicSignup()`, um único `INSERT ... ON DUPLICATE KEY UPDATE`)**
11. Definir `payment_status`: **(feito)**
    - `not_required` para `free`;
    - `pending` para `paid`.
12. ~~Commit.~~ N/A sem transação explícita - cada passo é uma statement autocommitada.
13. Revalidar rotas Next. **(feito)**

### `payment.service.ts`

Ainda não implementado. Hoje `setParticipantPayment()` no repositorio cobre a versão simplificada (sem `payment_events`, sem admin FK real). Responsabilidades do alvo:

- confirmar pagamento de inscricao paga;
- contestar pagamento confirmado;
- manter `proof_url` quando contestado;
- criar `payment_events`;
- criar `audit_logs`.

Regras:

- Aceitar somente URLs `http`/`https` (já feito hoje, na Server Action).
- Nao processar transacao financeira.
- Nao armazenar imagem local enquanto a decisao do produto for "URL externa".

### `audit.service.ts`

**Implementado** (`lib/backend/services/audit.service.ts`). Responsabilidades cobertas:

- gravar auditoria append-only (`recordAction`, resolve `actor_admin_id` via `admins.findIdByDiscordUserId`);
- listar auditoria paginada (`listAuditLog`, 25 por página);
- filtrar por ator, acao e alvo (`listAuditLog({actor, action, target})`);
- expor a lista de atores distintos já registrados, pro dropdown de filtro (`listAuditActors`).

Não implementado, porque nada ainda produz esse dado (ver seção 5): filtro por período, `metadata` estruturada, sanitização de segredos em `metadata` (não há o que sanitizar - a coluna está sempre `NULL`). A API real ficou mais simples que a sugerida no plano original, porque `recordAction()` manteve a assinatura que os 5 call sites já usavam (`Omit<AuditLogEntry, "id"|"at">`), em vez de introduzir um formato novo `{actor, target: {type, id, slug}, metadata}`:

```ts
await recordAction({
  actorId: session.userId,
  actorUsername: session.username,
  actorDisplayName: session.displayName,
  action: "tournament.update",
  target: tournament.slug,
  detail: 'Updated tournament "Wind-Up Cup XI"',
});
```

### `admins.service.ts`

**Implementado** (`lib/backend/services/admins.service.ts`), não estava no plano original como service próprio. Responsabilidade única: `upsertAdmin({discordUserId, username, displayName})`, chamado em `app/admin/callback/route.ts` a cada login bem-sucedido, antes de `recordAction()` - assim até a auditoria do próprio login já resolve `actor_admin_id`.

### `leaderboard.service.ts`

Ainda não implementado (Fase 5). Responsabilidades:

- substituir `lib/leaderboard.ts`;
- calcular pontos por resultado real;
- rankear por criterios definidos;
- expor top N para a pagina `/leaderboard`.

Decisoes pendentes:

- formula de pontos por vitoria, empate, top cut e campeao;
- peso por tamanho do torneio;
- criterio de desempate;
- se eventos historicos entram como seed manual.

### `results.service.ts`

Ainda não implementado. Responsabilidades futuras:

- gerar pairings;
- registrar resultado;
- confirmar resultado;
- calcular standings;
- gerar bracket single/double elimination;
- congelar standings por rodada.

Recomendacao:

- Nao escrever motor complexo do zero se existir biblioteca confiavel que atenda Swiss/brackets.
- Se nao houver biblioteca adequada, manter algoritmo isolado e bem testado.

## 7. Endpoints e Server Actions

O projeto pode continuar usando Server Actions. Endpoints REST so sao necessarios para integracoes externas ou consumo por outro cliente.

### Server Actions atuais que devem chamar services

Publico:

- `app/login/actions.ts`
  - `login()` **(feito - chama `rateLimit()` assíncrona e `resolvePlayerId()`)**
  - `refresh()` **(feito - também chama `resolvePlayerId()`, mesma razão)**
  - `logout()`
- `app/events/[slug]/signup/actions.ts`
  - `register()` **(feito - chama `resolvePlayerId()` + `registerSignup()`)**
  - `cancel()` **(feito - chama `findPlayerIdByToken()` + `cancelSignup()`)**
- `app/events/saved-actions.ts`
  - `saveTournamentAction()` **(feito - `findPlayerIdByToken()` + `saveTournament()`, sem buscar profile na Nexus - ver seção 5, "players")**
  - `unsaveTournamentAction()` **(feito, mesmo padrão)**

Admin:

- `app/admin/tournaments/actions.ts`
  - `createTournamentAction()` **(feito, chama o service via `lib/tournaments.ts`)**
  - `updateTournamentAction()` **(feito)**
  - `deleteTournamentAction()` **(feito)**
- `app/admin/tournaments/[slug]/participants/actions.ts`
  - `addParticipantAction()` **(feito)**
  - `confirmPaymentAction()` **(feito)**
  - `contestPaymentAction()` **(feito)**
  - `removeParticipantAction()` **(feito)**
- `app/admin/dashboard/actions.ts`
  - `linkNexusToken()` **(chama `rateLimit()`, agora assíncrona - feito)**
  - `unlinkNexusToken()`

### Route Handlers atuais

- `GET /admin/login`
- `GET /admin/callback` **(feito - além de `createAdminSession()` e `recordAction("admin.login")`, agora também chama `upsertAdmin()`)**
- `POST /admin/logout` **(feito - `recordAction("admin.logout")` grava na tabela real)**
- `GET /api/auth/logout`

### API REST opcional futura

Se for necessario expor API:

| Metodo | Rota | Auth | Uso |
| --- | --- | --- | --- |
| `GET` | `/api/tournaments` | Publica | Lista eventos |
| `GET` | `/api/tournaments/:slug` | Publica | Detalhe do evento |
| `POST` | `/api/tournaments` | Admin | Criar torneio |
| `PATCH` | `/api/tournaments/:id` | Admin | Editar torneio |
| `DELETE` | `/api/tournaments/:id` | Admin | Cancelar/soft delete |
| `POST` | `/api/tournaments/:slug/registrations` | Usuario | Inscrever |
| `DELETE` | `/api/registrations/:id` | Usuario/Admin | Cancelar/remover |
| `GET` | `/api/tournaments/:slug/registrations` | Admin | Participantes |
| `POST` | `/api/registrations/:id/payment/confirm` | Admin | Confirmar pagamento |
| `POST` | `/api/registrations/:id/payment/contest` | Admin | Contestar pagamento |
| `GET` | `/api/admin/audit-logs` | Admin | Auditoria paginada |
| `GET` | `/api/leaderboard` | Publica | Ranking |

## 8. Autenticacao e Sessoes

### Usuario publico

Estado atual (sem mudanca nesta migracao):

- Cookie `redu_session` via `iron-session`.
- TTL de 7 dias.
- Armazena token Nexus, nome, avatar, contributor, inscricoes mockadas (`signups`) e torneios salvos mockados (`savedTournaments`).
- Perfil Nexus cacheado em memoria por 60s (`Map` local) - continua assim; só migraria se/quando a hospedagem virar multi-instância (ver seção 0 e Fase 4).

Alvo (Fase 3):

- Manter `redu_session` para nao quebrar UX. **(sem mudança)**
- Remover `signups` e `savedTournaments` do cookie e buscar ambos no banco. **(feito)**
- Continuar usando token Nexus no cookie criptografado para ler decks sob demanda. **(sem mudança)**
- Cachear perfil Nexus em tabela MariaDB por 60s, usando hash do token como chave. **(feito - tabela `nexus_profile_cache`, ver seção 5. Era condicional a virar multi-instância; virou, a hospedagem é Vercel)**
- Criar/atualizar `players` em login/refresh. **(feito - também em `register()`/`saveTournamentAction()`, ver seção 5)**

Alternativa mais forte:

- Cookie guarda somente `session_id`.
- Tabela `public_sessions` guarda token Nexus criptografado.
- Permite revogacao server-side, mas aumenta complexidade.

### Admin

Estado atual (sem mudanca nesta migracao):

- Discord OAuth2.
- Checa cargo `DISCORD_MOD_ROLE_ID` na guild `DISCORD_GUILD_ID`.
- Cookie `admin_session` com JWT `jose`.
- TTL de 8h.
- Middleware protege `/admin/tournaments/**` e `/admin/logs/**`; outras paginas admin rechecam dentro do componente/route.
- Tentativas de login e de link de token Nexus agora usam rate limit compartilhado via `rate_limits` (feito), com chaves separadas (`login:{ip}` / `nexus-link:{ip}`).

Alvo recomendado:

- Manter cookie separado `admin_session`. **(sem mudança)**
- Ao login, upsert em `admins`. **(feito - `upsertAdmin()` em `app/admin/callback/route.ts`)**
- Continuar checando cargo no callback. **(sem mudança)**
- Para maior seguranca, revalidar cargo periodicamente ou em cada nova sessao. (pendente, sem prazo definido)
- Registrar `admin.login` e `admin.logout` em auditoria persistente. **(feito)**
- Considerar tabela `admin_sessions` se precisar revogar sessoes antes de 8h. (pendente, sem prazo definido)

### Separacao obrigatoria

Continuar permitindo:

- usuario logado sem admin;
- admin logado sem usuario;
- ambos ao mesmo tempo;
- admin com token Nexus linkado so na sessao admin.

Nao reutilizar cookie publico para admin. Nao inferir permissao admin por token Nexus.

## 9. Integracoes Externas

### Dueling Nexus

Uso atual:

- `https://duelingnexus.com/api/get-info.php?token=...`
- Responde HTTP 200 mesmo quando `success: false`; o body e a fonte de verdade.
- Decks e decklists sao lidos em tempo real.

Backend alvo:

- Centralizar em `lib/backend/auth/nexus-client.ts` (pendente).
- Timeout de 8s como hoje.
- Cache de 60s por hash do token. **(feito - duas camadas, memória + `nexus_profile_cache`, ver seção 5)**
- Nunca logar token.
- Persistir snapshot do deck no momento da inscricao para que alteracoes futuras no deck da Nexus nao mudem o registro historico do torneio (Fase 3).

### Discord

Uso atual:

- OAuth `identify`.
- Bot token para buscar membro da guild e checar role.

Backend alvo:

- Centralizar em `lib/backend/auth/discord-client.ts` (pendente).
- Nao persistir access token do OAuth se nao houver necessidade.
- Guardar snapshot de `username` e `display_name` em `admins` e `audit_logs`. **(feito)**

### Imagens

Uso atual:

- Avatar: URL externa Nexus/ygopro.
- Arte de carta: yugi.wiki/ygopro.
- Comprovante de pagamento: URL externa informada pelo admin.

Backend alvo:

- Continuar sem upload por enquanto.
- Validar protocolo `http`/`https` para comprovante (já feito, na Server Action).
- Se houver upload futuro:
  - usar bucket;
  - gerar URL assinada;
  - salvar metadata em `payment_proofs`;
  - nao servir arquivos pelo processo Next.

## 10. Variaveis de Ambiente

Ja usadas:

```env
SESSION_SECRET=...
AUTH_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_BOT_TOKEN=...
DISCORD_GUILD_ID=...
DISCORD_MOD_ROLE_ID=...
DISCORD_REDIRECT_URI=...
DISCORD_OAUTH_URL=...
DISCORD_API_URL=...
```

Adicionadas nesta migracao:

```env
DATABASE_URL=mysql://user:pass@host:3306/dbname
```

`db:migrate` e `db:seed` (scripts do `package.json`) e o script de testes (`pnpm test`) leem `.env.local` via `--env-file`. Testes usam um banco isolado por processo, derivado automaticamente de `DATABASE_URL` (ver `lib/backend/db/test-setup.ts`) - não precisa de uma segunda variável de ambiente pra isso.

**Em produção (Vercel):** `DATABASE_URL` é configurada direto nas env vars do projeto no painel do Vercel, apontando pro MariaDB hospedado na LayerBase - não pra `localhost`, que só existe no `.env.local` de dev. Rodar `pnpm db:migrate` contra o banco de produção continua manual (não faz parte do build do Vercel) - migration nova precisa ser aplicada à mão apontando `DATABASE_URL` pra produção antes/depois do deploy que a introduz.

Removidas do plano original (nao ha mais Redis nesta arquitetura):

```env
# REDIS_URL=...   -- não usado; rate limit vive em MariaDB (seção 5)
```

Ainda nao necessarias (dependem de fases futuras):

```env
APP_ENCRYPTION_KEY=... # se tokens forem persistidos no banco (Fase 3+)
STORAGE_BUCKET=...     # opcional, upload de comprovante
STORAGE_REGION=...     # opcional
STORAGE_ACCESS_KEY=... # opcional
STORAGE_SECRET_KEY=... # opcional
```

## 11. Migracao Incremental

### Fase 1 - Banco e repositorios sem mudar UI — **concluída**

1. ~~Adicionar PostgreSQL e migrations.~~ Adicionado MariaDB (`mysql2`) e migrations. **(feito)**
2. Criar tabelas `tournaments`, `registrations`, `admins`, `audit_logs`. **(feito - `001_init.sql`)**
3. Criar seed a partir de `lib/events.ts`. **(feito - `lib/backend/db/seed.ts`, só a partir de `events`, não `pastEvents`)**
4. Trocar internamente `lib/tournaments.ts` para consultar banco. **(feito)**
5. Manter assinaturas publicas iguais. **(feito - os 13 arquivos que importam `lib/tournaments` não mudaram)**
6. Adaptar testes de `lib/tournaments.test.ts` para rodar contra repositorio isolado ou banco de teste. **(feito - cada processo de teste usa seu próprio banco throwaway, `lib/backend/db/test-setup.ts`)**

Desvios registrados na seção 5: `taken` não é derivado, delete é hard delete, `registrations` só tem as colunas que o fluxo admin-manual usa.

Resultado alcançado:

- Torneios criados pelo admin sobrevivem restart/deploy.
- Participantes admin sobrevivem restart/deploy.

### Fase 1.5 - Rate limit compartilhado — **concluída** (adiantada da Fase 4, sem Redis)

1. Criar tabela `rate_limits` em MariaDB. **(feito - `002_rate_limits.sql`)**
2. Trocar `lib/rate-limit.ts` para usar a tabela via `lib/backend/services/rate-limit.service.ts`. **(feito - `rateLimit()` agora é assíncrona)**
3. Corrigir bug de chave compartilhada entre `login()` e `linkNexusToken()`. **(feito - `login:{ip}` / `nexus-link:{ip}`)**
4. Adaptar `lib/rate-limit.test.ts` para rodar contra banco de teste. **(feito)**

Resultado alcançado:

- Rate limit funciona entre instâncias, sem depender de servidor Redis dedicado.

### Fase 2 - Auditoria persistente — **concluída**

1. Trocar `lib/audit-log.ts` para tabela `audit_logs` (tabela já existia, criada na Fase 1). **(feito)**
2. Paginar `/admin/logs`. **(feito - 25 por página, mesmo padrão de `pageHref`/`pager` já usado em `/events`)**
3. Remover limite de 1000 entradas. **(feito)**
4. Adicionar filtros por ator, acao e alvo. **(feito - GET form, mesmo padrão de `/events`; dropdown de ator vem de `listAuditActors()`, dropdown de ação vem da constante `ADMIN_ACTIONS`, alvo é texto livre com match exato)**
5. Popular `admins` no login admin (upsert), para que `audit_logs.actor_admin_id` tenha um link real. **(feito - `upsertAdmin()` roda antes de `recordAction()` no callback, então até o audit log do próprio login já linka)**

Desvio descoberto durante a implementação, corrigido na mesma fase: `audit_logs.at` precisava de precisão de milissegundo pelo mesmo motivo que `rate_limits.reset_at` (seção 4) - migration `003_audit_logs_at_precision.sql`.

Resultado alcançado:

- Log admin permanece completo e auditavel, sem truncar em 1000 entradas.
- Admin consegue filtrar o histórico por quem fez, o que fez e o que foi afetado.

### Fase 3 - Inscricoes publicas no banco — **núcleo concluído**

**Bloqueio resolvido:** "Identidade Nexus" (secao 14) foi testada contra a API real e decidida com o dono do produto - `sha256(token)` com reconciliação por nome, ver seção 0.

1. Remover `signups` e `savedTournaments` do cookie publico. **(feito)**
2. Criar/atualizar `players` no login/refresh. **(feito - também em `register()`/`saveTournamentAction()`)**
3. Fazer `register()` criar `registrations`. **(feito, com um subconjunto do modelo-alvo: `player_id`, `source`, `deck_id`. `status`, `deck_snapshot`, `entry_type_snapshot` ficaram de fora - ver seção 5 pra cada um)**
4. Fazer `cancel()` cancelar `registrations`. **(feito - `DELETE`, não soft-cancel, mesmo padrão de hard delete que `deleteTournament()` já usava desde a Fase 1)**
5. Fazer `saveTournamentAction()`/`unsaveTournamentAction()` gravarem em `saved_tournaments` (tabela nova). **(feito)**
6. Fazer paginas `/events`, `/events/[slug]` e `/dashboard` lerem inscricoes e salvos do banco. **(feito, mais `/events/[slug]/signup` que a lista original não citava explicitamente)**
7. Unificar participantes admin e inscritos publicos. **(feito - saiu de graça: `registrations` já era uma tabela só desde a Fase 1, então unificar a escrita foi suficiente pra unificar a leitura também. `/admin/tournaments/[slug]/participants` rotula a origem de cada linha)**
8. Trocar `tournaments.taken` de coluna editável para `COUNT(*)` derivado de `registrations`. **(feito - coluna física dropada, não só ignorada)**

Deliberadamente fora desta fase (seção 0 tem o porquê de cada um): `deck_snapshot`/`deck_validation` persistidos, `entry_type_snapshot` como coluna própria, lock transacional de capacidade.

Resultado alcançado:

- Inscricao aparece para admin, junto com as manuais, rotulada por origem.
- O mesmo usuario ve sua inscricao (e seus torneios salvos) em outro navegador depois de logar.
- Capacidade do evento reflete inscricoes reais (sem lock contra corrida - ver seção 4).

### Fase 4 - Cache de perfil Nexus multi-instância — **concluída**

Rate limit já não dependia desta fase (ver Fase 1.5). Hospedagem decidida como Vercel (seção 0), então o resto deixou de ser condicional:

1. Trocar o cache de perfil Nexus em memoria (`Map` local, 60s) por uma tabela MariaDB. **(feito - `nexus_profile_cache`, mantendo o `Map` como L1 na frente da tabela, não substituindo - ver seção 5)**
2. Manter `React.cache()` para dedup por request. **(sem mudança - `fetchProfile` continua envolto em `cache()`)**

Resultado alcançado:

- Perfil Nexus cacheado fora do processo, correto pro modelo serverless multi-instância do Vercel.
- Pool de conexão do banco dimensionado (`connectionLimit: 3`) pra não estourar `max_connections` com múltiplas instâncias concorrentes cada uma com seu próprio pool.

### Fase 5 - Resultados e leaderboard

1. Criar tabelas de rounds, matches e match players.
2. Implementar registro de resultado.
3. Calcular standings por evento.
4. Substituir `mockPlacement()`.
5. Substituir `lib/leaderboard.ts` por query real.

Resultado esperado:

- Eventos passados exibem colocacao real.
- Leaderboard deixa de ser mock.

### Fase 6 - Storage opcional

Somente se o produto decidir aceitar upload de comprovantes:

1. Criar bucket.
2. Adicionar endpoint de URL assinada.
3. Criar tabela `payment_proofs`.
4. Salvar metadata do arquivo.
5. Atualizar UI admin para upload.

## 12. Queries e Casos de Uso Criticos

### Lista publica de eventos

Precisa devolver:

- dados do torneio;
- `taken` derivado de inscricoes ativas. **(feito)**
- `seats_left`;
- filtros por estrutura, data e vagas;
- ordenacao: proximos primeiro para futuros, recentes primeiro para passados.

### Detalhe do evento

Precisa devolver:

- dados do torneio;
- estado de inscricao do usuario atual, se logado; **(feito - `findSignupDeckId()`)**
- deck registrado; **(feito - cruzado com o profile ao vivo da Nexus, não um snapshot)**
- status de pagamento quando aplicavel;
- resultados reais quando `status = completed`. (pendente - Fase 5, `status` nem existe ainda)

### Dashboard do usuario

Precisa devolver:

- perfil Nexus ao vivo/cacheado;
- decks validaveis;
- inscricoes futuras e passadas; **(feito - `listSignupsForPlayer()`)**
- placings reais para eventos finalizados; (pendente - Fase 5, continua `mockPlacement()`)
- torneios salvos (futuros e passados, com o mesmo split que inscricoes ja usa). **(feito - `listSavedSlugsForPlayer()`)**

### Admin dashboard

Precisa devolver:

- quantidade de torneios;
- vagas preenchidas;
- proximos eventos;
- status do token Nexus linkado;
- links de gestao.

### Admin participantes

Precisa devolver:

- participantes/inscricoes do torneio; **(feito, unificado)**
- deck; **(feito)**
- origem (`public_signup` ou `admin_manual`); **(feito - rotulado como "Public signup"/"Added by admin")**
- status de pagamento; **(feito)**
- comprovante; **(feito)**
- ultimo admin que alterou pagamento. **(feito - `payment_by`, texto solto, ver "Ainda não implementado" na seção 5)**

## 13. Testes Recomendados

Manter o runner nativo do Node.

Testes de dominio que continuam puros:

- `validateDecks.test.ts`
- `events.test.ts`
- `safe-next.test.ts`
- `nexus-parse.test.ts`
- `cards.test.ts`

Testes de backend:

- slug unico em banco. **(feito - `lib/tournaments.test.ts`)**
- create/update/delete de torneio. **(feito)**
- ~~soft delete preserva auditoria~~ hard delete remove torneio e participantes (`ON DELETE CASCADE`). **(feito, ajustado ao desvio da seção 5)**
- rate limit permite ate o limite e bloqueia depois, chaves independentes, janela expira. **(feito - `lib/rate-limit.test.ts`)**
- inscricao publica bloqueia quando `tournament.status` nao permite inscricao (`locked`, `running`, `completed`, `cancelled`); um torneio com `starts_at` no passado mas `status = open` continua aceitando inscricao; (pendente - depende da coluna `status`, que ainda não existe, ver seção 5)
- inscricao publica bloqueia sold out sem criar waitlist (decisao fechada: nao ha waitlist); **(feito - `register()` já checava isso desde antes da Fase 3, `seatsLeft(event) === 0` bloqueia)**
- duas inscricoes concorrentes nao ultrapassam `seat_cap`; (pendente - sem lock transacional ainda, ver seção 4)
- usuario nao pode registrar deck que nao pertence ao proprio perfil; **(feito, sem mudança - `register()` já validava isso contra `profile.decks`, cobrindo pré e pós Fase 3)**
- participante manual aparece na lista admin; **(feito, cobre o fluxo atual)**
- pagamento confirmado exige comprovante quando nao ha comprovante anterior; **(feito, na Server Action - `confirmPaymentAction`)**
- contestacao mantem comprovante visivel; **(feito - `lib/tournaments.test.ts`)**
- salvar um torneio ja salvo e no-op, nao duplicata; **(feito - `lib/registration.test.ts`)**
- remover um torneio nao salvo nao gera erro; **(feito - `lib/registration.test.ts`)**
- registrar cria a inscrição, registrar de novo troca o deck em vez de duplicar linha, cancelar remove; **(feito - `lib/registration.test.ts`)**
- inscrição pública num torneio grátis nasce `not_required`, num pago nasce `pending`; **(feito - `lib/registration.test.ts`)**
- mesmo token sempre resolve pro mesmo player; token novo com nome já visto reconcilia em vez de duplicar; nome novo com token novo cria player de verdade; **(feito - `lib/player.test.ts`)**
- auditoria nao registra tokens; **satisfeito por construção, sem teste dedicado** - nenhum call site de `recordAction()` jamais recebe um token Nexus/Discord (o comentário em `linkNexusToken()` já dizia isso antes da migração: "Never log the raw token"), então não há caminho de código que vaze um token pro log. Um teste que afirmasse isso só re-testaria a ausência de um parâmetro, não uma regra de negócio.
- rate limit compartilha estado entre instâncias. **(feito - via tabela real, testável sem double/fake)**
- gravar e listar auditoria, com paginação e filtros por ator/ação/alvo. **(feito - `lib/audit-log.test.ts`)**
- `taken` reflete registrations reais e não se move sozinho quando outros campos do torneio mudam. **(feito - `lib/tournaments.test.ts`)**
- cache de perfil: miss vira null, set+get faz round-trip, entrada expirada vira miss, invalidar limpa, chaves diferentes não colidem. **(feito - `lib/nexus-cache.test.ts`)**

Nota de infraestrutura de teste: cada arquivo de teste que toca o banco (`lib/tournaments.test.ts`, `lib/rate-limit.test.ts`, `lib/audit-log.test.ts`, `lib/player.test.ts`, `lib/registration.test.ts`, `lib/nexus-cache.test.ts`) importa `lib/backend/db/test-setup.ts` como primeiro import. Isso cria um banco throwaway exclusivo para aquele processo (`{db}_test_{pid}`), roda as migrations nele e o derruba em `test.after()`. Isso existe porque o runner do Node roda cada arquivo de teste em um processo separado e concorrente - um banco de teste único e compartilhado entre arquivos causou testes flaky reais durante a implementação (um arquivo truncando tabelas enquanto outro ainda escrevia nelas).

## 14. Riscos e Decisoes Pendentes

### Identidade Nexus (resolvido, decisão registrada)

Testado contra a API real (`GET get-info.php?token=...`, com um token de conta de verdade): a resposta e `{success, name, contributor, avatar, ranking, deck}` — nenhum campo de ID. `ranking` veio `null` na conta testada. `name` e o unico identificador textual e nada garante que e imutavel. Isso e diferente do Discord, onde o app ja tem um snowflake estavel (`discord_user_id`) pra admin.

**Decisão do dono do produto:** `sha256(token)` como `nexus_identity_key`, sabendo do risco (token regenerado sem mitigação = "jogador novo" silencioso), mitigado com reconciliação por `nexus_name` - se o hash não bate com nenhum player existente, tenta achar por nome antes de criar um novo (`resolvePlayerId()` em `lib/backend/services/player.service.ts`, ver seção 5). Não elimina o risco por completo (um jogador que troca de nome *e* regenera o token no mesmo intervalo ainda forka), só reduz o caso comum. A alternativa de pedir um campo estável pra Dueling Nexus fica em aberto para o futuro, sem bloquear o que já foi implementado.

### Waitlist (resolvido: nao tera)

Decisao de produto: o site nao implementa fila de espera. Sold out bloqueia inscricao, ponto — sem `status = waitlisted`, sem promessa de "avisamos quando abrir vaga". A interface ja foi corrigida pra parar de sugerir o contrario (`app/events/page.tsx` e `app/events/[slug]/page.tsx` mostram "Sold out" em vez de "Waitlist"/"Join the waitlist", e nenhum CTA de inscricao aparece quando a vaga acabou). O enum `registrations.status` (secao 5, modelo-alvo) nem tem mais `waitlisted` — foi removido do modelo, nao so deixado sem uso. Se esse produto um dia quiser fila de espera de verdade, e uma feature nova pra desenhar do zero, nao um valor de enum que ja estava esperando.

### Redis (resolvido: nao havera servidor dedicado)

Decisao registrada na secao 0: sem servidor Redis dedicado disponivel. O unico consumidor concreto ate agora (rate limit) foi resolvido com uma tabela MariaDB, sem perda de propriedade relevante (atomicidade via lock de linha do InnoDB, equivalente ao `INCR` do Redis). Se o cache de perfil Nexus precisar sair de memoria (Fase 4, só relevante em hospedagem multi-instância), a mesma tecnica (tabela com `expires_at`) resolve sem introduzir Redis. Reavaliar Redis/Upstash apenas se aparecer um caso de uso onde a latencia de ida ao banco (poucos ms) realmente importe - nao e o caso de um gate de login ou um cache de 60s.

### Valor de entrada paga

O formulario usa numero decimal. Banco deve armazenar inteiro em unidade menor (`entry_amount_minor`) para evitar problemas de ponto flutuante. **(feito - `lib/backend/repositories/tournaments.repository.ts` converte na borda)**

### Eventos historicos

`pastEvents` e `YCS Providence 2012` misturam arquivo estatico com eventos. **Decisao tomada para a Fase 1: manter conteudo historico estatico** (o seed só migrou `events`, não `pastEvents`). Revisitar se algum dia fizer sentido:

- migrar todos os eventos para banco;
- migrar somente eventos REDU futuros/recentes.

### Motor de torneio

Swiss, top cut e double elimination podem ficar complexos. Isolar isso em service proprio e preferir biblioteca confiavel quando possivel.

### Timezone do servidor de banco (novo, descoberto na Fase 1.5)

O servidor MariaDB usado em desenvolvimento não está configurado para UTC. Qualquer código futuro que compare um valor calculado em JS contra `NOW()`/`CURRENT_TIMESTAMP` do SQL vai herdar o mesmo bug que `rate_limits` teve (ver seção 4) se não tomar o mesmo cuidado. Não há necessidade de forçar o servidor para UTC - é mais simples e mais portátil (funciona igual em qualquer servidor, independente de como ele foi configurado) sempre passar timestamps calculados em JS como parâmetro em vez de confiar em funções de tempo do SQL.

## 15. Criterios de Aceite do Backend

Um backend real para este projeto deve ser considerado pronto quando:

- Torneios criados/editados/deletados pelo admin persistem apos restart/deploy. **(feito)**
- Participantes e status de pagamento persistem apos restart/deploy. **(feito)**
- Inscricoes publicas saem do cookie e aparecem para admin. **(feito)**
- Contagem de vagas vem de inscricoes reais. **(feito)**
- Auditoria admin nao perde dados e nao e truncada. **(feito)**
- Rate limit funciona entre instancias. **(feito - via MariaDB, sem Redis)**
- Perfil Nexus e cacheado fora do processo local. **(feito)**
- Tokens Nexus nunca aparecem em logs/auditoria. **(já era o caso, sem mudança)**
- Dashboard do usuario mostra inscricoes persistentes. **(feito)**
- Leaderboard e resultados deixam de depender de mocks quando a fase de partidas for implementada. (pendente - Fase 5)

## 16. Sequencia Recomendada de Implementacao

1. ~~Criar `lib/backend` com client DB, repositorios e services.~~ **(feito)**
2. ~~Adicionar migrations de `tournaments`, `registrations`, `admins`, `audit_logs`.~~ **(feito)**
3. ~~Criar seed com os eventos atuais.~~ **(feito)**
4. ~~Trocar `lib/tournaments.ts` para usar o service novo.~~ **(feito)**
5. ~~Trocar `lib/audit-log.ts` para usar o service novo.~~ **(feito)**
6. ~~Persistir inscricoes publicas em `registrations`.~~ **(feito)**
7. ~~Remover `signups` do cookie publico.~~ **(feito - `savedTournaments` também saiu junto)**
8. ~~Adicionar Redis para rate limit e cache Nexus.~~ **Adicionar tabela MariaDB para rate limit compartilhado - feito.** Cache Nexus continua em memoria (só migra se a hospedagem virar multi-instância, Fase 4).
9. Implementar resultados reais. (Fase 5)
10. Substituir leaderboard mockado. (Fase 5)

Essa ordem entrega valor cedo e evita uma reescrita grande. O front atual foi escrito de um jeito favoravel a essa troca: as funcoes ja sao assíncronas e a maior parte da logica mutavel esta concentrada em poucos modulos.
