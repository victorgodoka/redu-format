# REDU Format

Site e sistema de torneios de Yu-Gi-Oh! para o formato REDU (retrô, banlist 2012.10 / Wind-Up), com suporte a torneios de outros formatos (hoje: TCG). Inscrição, validação de deck contra a banlist do evento, chaveamento, reporte de resultado pelos próprios jogadores, verificação automática de duelos na Dueling Nexus, ranking e premiação por código de resgate.

- **Stack:** Next.js 16 (App Router, Server Components e Server Actions), React 19, TypeScript, MariaDB/MySQL.
- **Sem API REST própria:** as páginas leem direto dos serviços no servidor e escrevem por Server Action. As poucas rotas HTTP que existem estão listadas em [Rotas HTTP](#rotas-http).
- **Identidade:** login por Discord (site e admin), identidade de jogo pela Dueling Nexus.

Documentação complementar: [estrutura de backend](docs/backend-structure.md) e [fluxo do torneio](docs/fluxo-do-torneio.md).

## Sumário

- [Requisitos](#requisitos)
- [Rodando local](#rodando-local)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Banco de dados](#banco-de-dados)
- [Deploy](#deploy)
- [Autenticação e sessões](#autenticação-e-sessões)
- [Área administrativa](#área-administrativa)
- [Site público](#site-público)
- [Rotas HTTP](#rotas-http)
- [Integrações externas](#integrações-externas)
- [Validação de deck](#validação-de-deck)
- [Premiação (prizing)](#premiação-prizing)
- [Mensagens para jogadores](#mensagens-para-jogadores)
- [Testes](#testes)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Débito técnico](#débito-técnico)

---

## Requisitos

| Item | Versão / detalhe | Por quê |
|---|---|---|
| Node.js | **22 ou superior** | Next 16 exige ≥ 20.9; os testes usam `--experimental-strip-types` (Node 22.6+) para rodar TypeScript direto. |
| pnpm | 9+ | O lockfile do repositório é `pnpm-lock.yaml`. `npm`/`yarn` funcionam mas ignoram o lock. |
| MariaDB ou MySQL | MariaDB 10.6+ / MySQL 8+ | Usa `JSON`, `DATETIME(3)`, `INSERT ... ON DUPLICATE KEY UPDATE` e `INSERT IGNORE`. Em MariaDB, `JSON` é alias de `LONGTEXT` — o código já trata as duas formas de retorno do driver. |
| Aplicação Discord | com bot no servidor | Login (OAuth2 `identify`) e leitura de cargo do membro para autorizar admins. |
| Saída HTTPS | `duelingnexus.com`, `discord.com` | Perfil/decks/replays da Nexus e API do Discord. Ambiente sem saída externa não funciona. |

Não é necessário Redis (rate limit é tabela), nem storage de arquivos (banners de torneio são gravados como `MEDIUMBLOB` no banco), nem serviço de e-mail (as mensagens ao jogador são entregues na caixa de entrada interna do site).

## Rodando local

```bash
pnpm install
```

Crie um `.env.local` na raiz com as variáveis da seção seguinte, e então:

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

O site sobe em `http://localhost:3000`.

Outros scripts:

| Script | O que faz |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento (Turbopack). |
| `pnpm build` | Build de produção. |
| `pnpm start` | Sobe o build de produção. Requer `pnpm build` antes. |
| `pnpm lint` | ESLint (config `eslint-config-next`). |
| `pnpm test` | Suíte de testes em `node:test`. Parte dos testes toca o banco — veja [Testes](#testes). |
| `pnpm db:migrate` | Aplica as migrations pendentes. Idempotente. |
| `pnpm db:seed` | Hoje só chama as migrations; não existe massa de dados de exemplo. |

> `db:migrate`, `db:seed` e `test` leem `--env-file=.env.local`. Em CI, ou você gera esse arquivo, ou roda o script equivalente com as variáveis já exportadas no ambiente.

## Variáveis de ambiente

**Nenhuma variável do projeto é prefixada com `NEXT_PUBLIC_`**, ou seja, nada é embutido no bundle do navegador. Todas são lidas apenas no servidor. Ainda assim, a coluna "sensível" abaixo separa o que é segredo de verdade (vaza = comprometimento) do que é apenas configuração (aparece na URL de OAuth, no HTML ou é público por natureza).

### Segredos — nunca versionar, nunca logar

| Variável | Sensível | Descrição |
|---|---|---|
| `DATABASE_URL` | **Sim** | `mysql://usuario:senha@host:porta/banco`. Credencial completa do banco. |
| `AUTH_SECRET` | **Sim** | Chave HMAC (HS256) que assina o JWT da sessão de admin. Trocar invalida todas as sessões de admin. |
| `SESSION_SECRET` | **Sim** | Chave de criptografia da sessão do jogador (iron-session). **Mínimo de 32 caracteres** — o app lança erro em runtime se for menor. Trocar desloga todo mundo. Gere com `openssl rand -base64 32`. |
| `DISCORD_CLIENT_SECRET` | **Sim** | Client secret da aplicação Discord, usado na troca do `code` por token. |
| `DISCORD_BOT_TOKEN` | **Sim** | Token do bot. Usado para ler o cargo do membro no servidor (autorização de admin). |
| `CRON_SECRET` | **Sim** | Bearer que autoriza `GET /api/cron/round-deadlines`. Sem ele definido, a rota responde 401 para todo mundo. |

### Configuração — não são segredos

| Variável | Sensível | Descrição |
|---|---|---|
| `DISCORD_CLIENT_ID` | Não | ID da aplicação Discord. Aparece na URL de autorização. |
| `DISCORD_OAUTH_URL` | Não | Endpoint de autorização, normalmente `https://discord.com/api/oauth2/authorize`. |
| `DISCORD_API_URL` | Não | Base da API, normalmente `https://discord.com/api/v10`. |
| `DISCORD_GUILD_ID` | Não | Servidor onde o cargo de moderação é verificado. |
| `DISCORD_MOD_ROLE_ID` | Não | Cargo que dá acesso ao `/admin`. Não é segredo, mas não há motivo para publicar. |
| `DISCORD_REDIRECT_URI` | Não | Callback **do admin**: `https://SEU_DOMINIO/admin/callback`. Precisa estar cadastrado na aplicação Discord. |
| `DISCORD_PLAYER_REDIRECT_URI` | Não | Callback **do jogador**. Opcional: se ausente, é derivado como `/login/callback` na mesma origem do `DISCORD_REDIRECT_URI`. **Também precisa estar cadastrado na aplicação Discord.** |
| `DISCORD_BOT_PUBLIC_KEY` | Não | Chave pública da aplicação, usada para verificar a assinatura das interações do bot. É pública por definição. |

Exemplo de `.env.local`:

```bash
DATABASE_URL=mysql://redu:senha@localhost:3306/redu
AUTH_SECRET=troque-isto
SESSION_SECRET=troque-isto-por-32-caracteres-ou-mais
CRON_SECRET=troque-isto

DISCORD_CLIENT_ID=000000000000000000
DISCORD_CLIENT_SECRET=xxxxx
DISCORD_BOT_TOKEN=xxxxx
DISCORD_BOT_PUBLIC_KEY=xxxxx
DISCORD_GUILD_ID=000000000000000000
DISCORD_MOD_ROLE_ID=000000000000000000
DISCORD_OAUTH_URL=https://discord.com/api/oauth2/authorize
DISCORD_API_URL=https://discord.com/api/v10
DISCORD_REDIRECT_URI=http://localhost:3000/admin/callback
DISCORD_PLAYER_REDIRECT_URI=http://localhost:3000/login/callback
```

As variáveis do Discord são lidas de forma estrita (`requiredEnv`): faltando qualquer uma, a request que precisar dela lança erro — o build passa, o runtime não.

## Banco de dados

Migrations são arquivos `.sql` numerados em `lib/backend/db/migrations/`, aplicados em ordem de nome pelo runner em `lib/backend/db/migrate.ts`, que registra o que já rodou na tabela `_migrations`. O runner remove comentários `--` e quebra o arquivo por `;`, então **evite `;` dentro de literais** e não use `DELIMITER`/procedures.

Para criar uma migration: adicione `NNN_descricao.sql` com o próximo número e rode `pnpm db:migrate`. Não edite uma migration já aplicada — crie a próxima.

### Mapa das tabelas

**Torneios e inscrição**

| Tabela | Conteúdo |
|---|---|
| `tournaments` | O evento: nome, descrição (markdown), banner (bytes + mime), início, estrutura, rounds, top cut, formato de partida, engine, **banlist**, vagas, inscrição (grátis/paga), host, status (`scheduled`/`running`/`finished`/`cancelled`), `has_prizing`, `prizes_sent_at`. |
| `registrations` | Uma linha por inscrito: nome exibido, deck (uuid + nome), snapshot da lista no cadastro e a travada no início, pagamento, origem (`public_signup`/`admin_manual`), drop, desqualificação, faltas. |
| `saved_tournaments` | "Salvar evento" do jogador. Guardado por slug, não por FK — funciona também para eventos estáticos. |
| `tournament_prizes` | Códigos de resgate: tier, código, para quem foi e quando. |

**Resultados**

| Tabela | Conteúdo |
|---|---|
| `tournament_brackets` | O estado do chaveamento serializado pela lib `tournament-organizer`, um blob JSON por torneio. É a fonte de verdade do bracket. |
| `tournament_placings` | Colocação final congelada no encerramento: lugar, pontos, ranking points e o retrospecto (`wins`/`losses`/`draws`). É o read model do leaderboard. |
| `match_reports` | Auto-reporte dos jogadores. As linhas somem quando a partida resolve; duas linhas divergentes = partida contestada. |
| `match_deadlines` | Relógio próprio das partidas (a engine não tem noção de tempo). |
| `match_flags` | No-show e contestação em aberto. |
| `redo_requests` | Pedido de refazer duelo caído por desconexão. |

**Jogadores e identidade**

| Tabela | Conteúdo |
|---|---|
| `players` | Conta do jogador: chave de identidade Nexus (sha256 do token), user id e nome Nexus, avatar, contributor, `discord_user_id` e o `nexus_token` vinculado. |
| `discord_accounts` | O que o Discord informou no login: username, display name, avatar, primeiro acesso e último login. Registro apenas — nada no site exibe esses dados. |
| `admins` | Admins que já logaram, com o token Nexus vinculado por eles. |
| `audit_logs` | Toda ação administrativa: quem, o quê, alvo, detalhe, quando. |

**Comunicação**

| Tabela | Conteúdo |
|---|---|
| `notifications` | Caixa de entrada do site (jogador e admin). `player_id` nulo = aviso global daquele público. `fingerprint` único evita reenvio do mesmo alerta. |
| `notification_reads` | Leitura por leitor — um aviso global lido por um admin continua não lido para os outros. |

**Cache e infraestrutura**

| Tabela | Conteúdo |
|---|---|
| `nexus_profile_cache` | Cache compartilhado do perfil Nexus (o cache em memória não atravessa instâncias serverless). |
| `nexus_replay_cache` | Replays já vistos, para não refetchar. |
| `nexus_fetch_log` | Cache + lock das chamadas à Nexus: duas requisições concorrentes nunca chamam a API duas vezes. |
| `duel_slots` / `duel_attempts` | Cada game dentro de uma partida e as tentativas de casá-lo com um replay real. |
| `deck_snapshots` | Histórico de listas por round. |
| `rate_limits` | Janela fixa por chave (`login:IP`, `nexus-link:IP`). Substitui Redis. |

## Deploy

O projeto é um app Next.js **com servidor** (Server Components, Server Actions, `after()`, acesso a banco). Não dá para exportar como site estático e não roda só no edge.

### O que o servidor precisa ter

1. **Runtime Node.js 22+** capaz de rodar `next start` (ou o adaptador da sua plataforma).
2. **Banco MariaDB/MySQL alcançável** pela aplicação, com as migrations aplicadas.
3. **Saída HTTPS** para `duelingnexus.com` e `discord.com`.
4. **Origem HTTPS estável e pública** — os dois callbacks de OAuth precisam estar cadastrados na aplicação Discord (`/admin/callback` e `/login/callback`).
5. **~512 MB de memória** por instância, no mínimo. O validador de TCG carrega `lib/cardinfo.json` (24 MB) uma vez por processo, sob demanda, e reduz para um índice pequeno — o pico de parsing é o que dita esse número. Torneios só REDU nunca pagam esse custo.
6. **Agendador** capaz de bater em `GET /api/cron/round-deadlines` com o header `Authorization: Bearer $CRON_SECRET`. Pode ser cron da plataforma, cron do sistema com `curl`, ou qualquer scheduler externo.
7. **O arquivo `lib/cardinfo.json` presente ao lado do build.** Ele é lido em runtime via `fs`, não importado. Em `next build` + `next start` no mesmo diretório do repositório isso já acontece; em plataformas que fazem *file tracing* e sobem só o necessário (Vercel, `output: standalone`), o `next.config.ts` já declara `outputFileTracingIncludes` para incluí-lo.

### Passos

```bash
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

Coloque a aplicação atrás de HTTPS. Em produção (`NODE_ENV=production`) os cookies são emitidos com `secure: true` — sob HTTP puro o navegador os descarta e o login não completa.

### Notas por plataforma

- **Vercel:** o `vercel.json` já declara o cron (`0 12 * * *`) e a Vercel injeta o `Authorization` a partir do `CRON_SECRET`. O plano Hobby limita a um disparo diário — o suficiente porque o cron é *backstop*, não o relógio principal (ver [Rounds e prazos](#rounds-e-prazos)).
- **Docker / VPS / Node gerenciado:** funciona com `next start` atrás de um proxy reverso. Se usar `output: "standalone"`, confirme que `lib/cardinfo.json` foi copiado junto. Configure o cron do sistema para o endpoint acima.
- **Escalonamento horizontal:** é seguro. Não existe estado em memória de processo que precise ser compartilhado — cache de perfil, rate limit e lock de fetch já vivem no banco. O pool de conexões é pequeno de propósito (3 por instância) justamente por causa de muitas instâncias concorrentes.

## Autenticação e sessões

São **duas sessões independentes**, com cookies e regras diferentes. Uma não desloga a outra.

### Sessão do jogador — cookie `redu_session`

- Criptografada com iron-session (`SESSION_SECRET`), `httpOnly`, `sameSite=lax`, TTL de 7 dias.
- Guarda: identidade Discord (`userId`, `username`, `displayName`, `avatar`), o **token Nexus**, e um snapshot de nome/avatar/contributor usado como fallback de render.
- O token Nexus fica dentro do cookie criptografado porque é a única credencial que lê os decks do jogador. O cliente recebe apenas o texto cifrado.

**Fluxo:**

1. `/login` → botão **Continue with Discord** → `/login/discord` monta a URL de autorização (`scope=identify`) e grava dois cookies temporários (`player_oauth_state`, `player_next`, escopo `/login`, 10 min).
2. Discord redireciona para `/login/callback`. O `state` é conferido, o `code` é trocado por token e o perfil é lido.
3. **Nenhum cargo ou servidor é verificado** — qualquer conta Discord válida entra.
4. Os dados do Discord são gravados em `discord_accounts` (upsert a cada login).
5. Se aquela conta Discord já tem um token Nexus vinculado (`players.nexus_token`) e ele ainda funciona, a sessão é completada e o jogador cai onde queria ir. Se o token foi revogado, ele é apagado do banco ali mesmo.
6. Sem token válido, o jogador vai para `/login/nexus`, cola o token, e ele é validado contra a Nexus, vinculado ao Discord e guardado para os próximos logins.

**O portão da área logada é o token Nexus.** Toda página logada checa `session.token`; sem ele, redireciona para `/login`, que por sua vez manda para `/login/nexus` quando já existe sessão Discord. Ou seja: logar no Discord identifica, mas não abre nada até existir um token Nexus válido.

Se a Nexus rejeitar o token depois (revogado, conta apagada), o `SiteHeader` detecta na primeira renderização seguinte e o overlay `SessionExpiredRedirect` destrói a sessão e devolve o jogador ao login.

### Sessão de admin — cookie `admin_session`

- JWT HS256 assinado com `AUTH_SECRET` (`jose`), `httpOnly`, `sameSite=lax`, TTL de 1 dia.
- Guarda: `userId`, `username`, `displayName` do Discord e, se houver, o token Nexus vinculado pelo admin.

**Fluxo:** `/admin` → `/admin/login` → Discord → `/admin/callback`, que exige **cargo `DISCORD_MOD_ROLE_ID` no servidor `DISCORD_GUILD_ID`** (lido com o bot). Sem o cargo, volta para a home sem sessão. Com o cargo: upsert em `admins`, criação do JWT, e — se o admin já vinculou um token Nexus — a sessão pública é criada junto, com a mesma identidade Discord.

**Proteção das rotas:** `proxy.ts` (o middleware do Next 16) intercepta `/admin/:path*`. Só `/admin`, `/admin/login`, `/admin/callback` e `/admin/logout` passam sem sessão; qualquer outra rota exige JWT válido. Assim uma página admin nova nasce protegida, e a request rejeitada nunca chega a renderizar markup protegido. O destino original viaja no `next` para o retorno pós-login.

## Área administrativa

Tudo abaixo de `/admin` renderiza dentro do `AdminShell` e roda atrás do middleware. Toda ação relevante grava em `audit_logs` via `recordAction` — quem fez, em qual alvo e o quê.

### `/admin/dashboard`

- **Lê:** `tournaments` (próximos eventos), perfil Nexus do admin (via cache), `notifications` (contagem de não lidos).
- **Escreve:** vínculo do token Nexus do admin.
- **Ações:** `linkNexusToken` (valida o token na Nexus, grava em `admins.nexus_token` e cria também a sessão de jogador), `unlinkNexusToken`.
- **Por que existe:** a verificação automática de duelos precisa de *algum* token válido para consultar a Nexus. É esse token compartilhado que ela usa.

### `/admin/tournaments` e `/admin/tournaments/new`

- **Lê:** `tournaments`.
- **Escreve:** `tournaments` (incluindo os bytes do banner).
- **Espera do formulário:** nome, descrição em markdown, banner (arquivo ≤ 5 MB, imagem), data/hora + timezone (convertidos para UTC na gravação), **banlist**, estrutura, rounds, top cut, vagas, formato de partida, engine, modo de duração, relógios de round, inscrição (grátis/paga com valor e moeda), host, URL de inscrição e a flag de premiação.
- **Regras que o servidor aplica** (não confie no formulário): rounds só valem para Swiss; o tamanho do top cut é **derivado** do número de vagas, nunca digitado; cada modo de duração lê só o relógio que usa; o slug é único, gerado a partir do nome.
- **Ações:** `createTournamentAction`, `updateTournamentAction`, `cancelTournamentAction` (mantém histórico, não gera placings nem pontua), `deleteTournamentAction`.

### `/admin/tournaments/[slug]`

Edição do torneio, painel de premiação (quando ligada) e as ações destrutivas.

- **Lê:** `tournaments`, `tournament_prizes`.
- **Escreve:** `tournaments`, `tournament_prizes`, `notifications` (no envio da premiação).
- **Ações:** as de edição acima, mais `addPrizesAction`, `removePrizeAction` e `sendPrizesAction`.

### `/admin/tournaments/[slug]/participants`

- **Lê:** `registrations` (join com `tournaments`), estado do bracket.
- **Escreve:** `registrations`, `notifications`, `audit_logs`.
- **Ações:** adicionar participante manual (nome + uuid do deck), trocar/forçar deck, confirmar ou contestar pagamento, remover, desqualificar (notifica o jogador) e reinstaurar.
- **Detalhe:** inscrição manual não tem conta vinculada — não recebe notificação nem código de premiação, porque não há caixa de entrada para onde enviar.

### `/admin/tournaments/[slug]/bracket`

- **Lê:** `tournament_brackets`, `registrations`, `match_deadlines`, `match_flags`, `match_reports`.
- **Escreve:** as mesmas, mais `tournament_placings` e `deck_snapshots` no encerramento.
- **Ações:** `startBracketAction` (fecha inscrições, trava as listas de deck, gera o round 1), `enterResultAction` (override do moderador), `dismissNoShowAdminAction`, `nextRoundAction`, `extendRoundAction`, `updateBracketStatusAction` (força a verificação na Nexus agora), `completeBracketAction` (congela colocações, retrospecto e ranking points; marca o torneio como `finished`).

### `/admin/messages`

- **Lê:** `tournaments` (para o seletor) e `players` (nomes Nexus para o autocomplete, 500 mais recentes).
- **Escreve:** `notifications`.
- **Espera:** título, corpo em markdown e o público — todos os jogadores, o grid de um torneio, ou jogadores específicos escolhidos por nome Nexus.
- **Envia:** para "todos", **uma** notificação global; para os demais, uma por jogador. Toda mensagem sai assinada com o nome do admin remetente. Nomes que não casam com nenhuma conta voltam listados na resposta em vez de derrubar o envio inteiro.

### `/admin/inbox`

Feed de alertas do sistema para a moderação: deck alterado durante torneio, desqualificação automática, no-show, resultado contestado. Lê `notifications` + `notification_reads`; abrir a mensagem é o que marca como lida.

### `/admin/logs`

Auditoria completa com filtro por ator, ação e alvo, paginada de 25 em 25. Lê `audit_logs` e `admins`.

## Site público

### `/` — home

Estática: o que é o formato, FAQ, evento em destaque. Não consulta banco.

### `/events` — lista de torneios

- **Consome:** `tournaments`, e, se logado, as inscrições e os salvos do jogador.
- **Efeito colateral:** dispara a verificação de duelos ativos em background (`after()`), respeitando o cache/lock de 5 minutos por torneio.
- Filtros de estrutura, data e vagas, com paginação.

### `/events/[slug]` — página do torneio

Renderiza em três variantes conforme o status: **próximo**, **em andamento** e **encerrado**.

- **Consome:** `tournaments`, `registrations`, `tournament_brackets`, `tournament_placings`, `match_*`, `redo_requests`, `saved_tournaments` e o perfil Nexus do visitante.
- **O jogador logado vê e faz:** seu round atual, sala/hash do duelo, reportar resultado, contestar, chamar no-show, pedir/aceitar/recusar refazer duelo caído.
- **Efeitos colaterais:** fecha partidas vencidas e roda a verificação de duelos, ambos em background.
- Mostra a banlist do evento junto dos outros dados.

### `/events/[slug]/signup` — inscrição

- **Consome:** `tournaments`, `registrations` e os decks do perfil Nexus.
- **Valida:** tamanho do deck e a legalidade **contra a banlist daquele torneio**. Decks ilegais aparecem desabilitados no seletor, com o motivo escrito.
- **Grava:** `registrations` com o snapshot da lista no momento da inscrição — é esse snapshot que a checagem de deck alterado compara depois.
- Exige login: sem sessão, vai para o login e volta.

### `/dashboard` — painel do jogador

- **Consome:** perfil e decks da Nexus, `tournaments`, `registrations`, `tournament_placings`, `notifications`, round atual.
- Lista os decks **sempre validados pela banlist REDU** (a escolha de formato é por torneio, não do painel), inscrições, histórico de colocações e o round em andamento.
- **Ações:** atualizar perfil (refetch forçado na Nexus), sair, desfazer "salvar evento".

### `/inbox` — caixa de entrada do jogador

Mensagens dirigidas a ele mais os avisos globais. Corpo renderizado como markdown. Abrir marca como lida (por leitor).

### `/leaderboard`

Tabela paginada de 20 em 20 com rank, avatar, nome, pontos, número de eventos, W/L total e melhor colocação. Lê `tournament_placings` agregado por jogador — sem reconstruir bracket nenhum, porque o retrospecto é congelado no encerramento do torneio.

### `/banlist`, `/rulings`

Conteúdo estático do formato REDU, servido de `lib/`.

### `/login`, `/login/nexus`

Ver [Autenticação e sessões](#autenticação-e-sessões).

### O que é guardado sobre o jogador

| Dado | Onde | Observação |
|---|---|---|
| Token Nexus | cookie criptografado + `players.nexus_token` | Credencial. Nunca renderizado, nunca enviado ao cliente em claro, nunca incluído em notificação. |
| Nome, avatar, contributor da Nexus | `players` + snapshot na sessão | É a identidade exibida em todo o site. |
| Username, display name e avatar do Discord | `discord_accounts` | Registro apenas — nada player-facing lê essa tabela. |
| Listas de deck | `registrations.deck_snapshot`, `deck_snapshots` | Base da checagem de deck alterado durante o torneio. |
| Resultados | `tournament_placings`, `tournament_brackets` | Histórico permanente. |

## Rotas HTTP

| Rota | Método | Autenticação | Função |
|---|---|---|---|
| `/api/cron/round-deadlines` | GET | `Bearer $CRON_SECRET` | Fecha partidas vencidas e resolve no-shows em todos os torneios. |
| `/api/auth/logout` | GET | sessão | Destrói a sessão do jogador. |
| `/api/discord/interactions` | POST | assinatura Ed25519 (`DISCORD_BOT_PUBLIC_KEY`) | Webhook de interações do bot (ping + slash commands). |
| `/events/[slug]/banner` | GET | pública | Serve os bytes do banner direto do banco. |
| `/login/discord`, `/login/callback` | GET | — | OAuth do jogador. |
| `/admin/login`, `/admin/callback` | GET | — | OAuth do admin. |
| `/admin/logout` | POST | sessão de admin | Destrói a sessão de admin (é um form, não um link). |

## Integrações externas

### Dueling Nexus

Não há API oficial nem chave: as leituras usam o token do próprio jogador (ou o token compartilhado vinculado por um admin) contra os endpoints públicos.

- **Perfil e decks** (`get-info.php`): a Nexus responde HTTP 200 mesmo com token inválido, então só o corpo (`success: true`) decide. Cache em dois níveis: memória do processo (1 min) e tabela `nexus_profile_cache`.
- **Replays** (`get-replay-info.php`): usados para verificar automaticamente o resultado dos duelos. Cada torneio tem um cache/lock de 5 minutos em `nexus_fetch_log` — duas requisições simultâneas nunca disparam duas chamadas.
- **Deck lock:** a lista registrada é congelada no início do torneio; a cada visita, round e login, o deck é comparado com o que está na Nexus. Deck editado durante o torneio gera desqualificação automática e notifica jogador e moderação.

### Discord

- **OAuth2** (`identify`) para os dois logins.
- **Bot** para ler o cargo do membro e autorizar admins.
- **Webhook de interações** em `/api/discord/interactions`, com verificação de assinatura.

### Rounds e prazos

O relógio do round é calculado a partir de prazos persistidos (`match_deadlines`), não de um timer em memória. Isso significa que o round fecha na hora certa mesmo que nada tenha "varrido" o banco ainda. A varredura acontece em três lugares: no cron diário, sempre que alguém abre uma página de torneio ativo, e a cada reporte de jogador.

## Validação de deck

Cada torneio declara sua banlist e é ela que decide a validação na inscrição. O painel do jogador é sempre REDU.

**REDU (2012.10 / Wind-Up)** — `lib/validateDecks.ts`, sobre a biblioteca congelada em `lib/cardLib.ts`:

- pool de cartas do formato (carta fora do pool é ilegal);
- banlist do formato, com todas as impressões de uma carta contando juntas;
- errata: cartas com errata só valem na impressão pré-errata.

**TCG (2026.05)** — `lib/tcg-decks.ts`, sobre `lib/cardinfo.json`:

- rarity removida do id (`id % 100000000000`) — vale para os dois validadores;
- carta legal se `misc_info[0].formats` contém `TCG` **ou** `misc_info[0].tcg_date` é uma data válida;
- cópias limitadas por `banlist_info.ban_tcg` (forbidden 0, limited 1, semi-limited 2, resto 3);
- id não encontrado: tenta de novo decrementando 1, até 5 vezes (artes alternativas ficam alguns ids acima da impressão);
- ids que continuam sem match aparecem juntos numa linha só, pedindo para o jogador revisar artes alternativas e avisar a moderação;
- carta que existe mas nunca saiu no TCG é apontada pelo nome, não como id desconhecido.

## Premiação (prizing)

Ligada por torneio (`has_prizing`). Os códigos são cadastrados em lote — uma linha `[código] [tipo]` por vez, `+` adiciona outra e um "Save codes" grava todas — enquanto o torneio está agendado ou em andamento, e congelam quando ele encerra.

**Faixas:** Winner = 1º; Runner-up = 2º; Top 4 = 3º–4º; Top 8 = 5º–8º; Top 16 = 9º–16º; Top 32 = 17º–32º; Participação = todo o resto que terminou.

**Envio** (botão *Send prizing*, só com o torneio encerrado): cada jogador recebe **um** código — o da sua faixa, se ainda houver, senão um de participação. Código de faixa nunca vaza para fora dela; os de participação são sorteados. Drops e desqualificados não recebem nada, nem participação. Inscrição manual sem conta também não, por não ter caixa de entrada. O envio é único: um clique duplo não manda duas vezes, porque a operação é reivindicada em `prizes_sent_at` antes de qualquer entrega.

## Mensagens para jogadores

Entrega interna, pela caixa de entrada do site (`/inbox`) — **não há envio de e-mail**. O corpo aceita markdown, renderizado da mesma forma que a descrição do torneio.

Segurança do markdown: HTML cru na origem é escapado antes da conversão, e links com esquema executável são neutralizados. Isso vale para todas as caixas de entrada porque os alertas do sistema citam nomes de deck e de jogador — texto que o próprio jogador escolhe.

## Testes

```bash
pnpm test
```

Roda `node:test` direto sobre os arquivos TypeScript. **Parte da suíte precisa de banco** (`lib/tournaments.test.ts`, `lib/results.test.ts`, `lib/player.test.ts`, `lib/registration.test.ts`, entre outros): eles usam a `DATABASE_URL` do `.env.local` e limpam as tabelas que tocam. Aponte para um banco descartável, nunca para produção.

Os testes puros — sem banco — podem rodar isolados:

```bash
node --experimental-strip-types --test lib/prizing.test.ts lib/tcg-decks.test.ts lib/validateDecks.test.ts lib/rounds.test.ts lib/cards.test.ts
```

## Estrutura de pastas

```
app/                      rotas (App Router), páginas e Server Actions
  admin/(protected)/      área administrativa, atrás do middleware
  api/                    rotas HTTP (cron, logout, webhook do Discord)
  events/                 lista, página do torneio e inscrição
  login/                  OAuth do jogador e vínculo do token Nexus
components/
  admin/                  componentes da área administrativa
  site/                   componentes do site público
  ui/                     primitivos compartilhados (Button, Panel, Markdown...)
lib/
  auth.ts                 sessão do jogador, perfil Nexus, cache
  auth/                   sessão de admin (JWT) e estado de OAuth
  backend/
    db/                   pool, migrations, runner
    repositories/         acesso a tabelas, SQL fica aqui
    services/             regras de negócio, orquestram repositórios
  events.ts               tipos e helpers do domínio de torneio
  validateDecks.ts        validação REDU
  tcg-decks.ts            validação TCG
  prizing.ts              faixas de premiação e distribuição de códigos
  cardLib.ts              biblioteca de cartas do formato REDU (gerada)
  cardinfo.json           dump completo de cartas, fonte de verdade do TCG
docs/                     documentação de arquitetura e fluxo do torneio
proxy.ts                  middleware do Next 16, protege /admin
```

A regra de camadas: **página/action → serviço → repositório → banco**. SQL só existe em `lib/backend/repositories`. Páginas não falam com repositório direto.

---

## Débito técnico

Itens conhecidos, em aberto, em ordem de impacto estrutural.

### 1. Tornar o projeto agnóstico ao produto ("white label")

Hoje o REDU está soldado em tudo: nome, textos, banlist padrão, home, FAQ, página de banlist, regras de pontuação e até o vocabulário do domínio. Deveria ser possível rodar a mesma base para qualquer comunidade ou jogo, trocando tema, conteúdo e regras de formato por configuração — com o núcleo de torneio (inscrição, chaveamento, resultado, ranking) sem saber de que jogo se trata.

### 2. Melhorar o cadastro de torneios e validar melhor a estrutura

O formulário aceita combinações que não deveriam existir e valida campo a campo, não o conjunto. Falta validação de estrutura de verdade: coerência entre estrutura, rounds, top cut e número de vagas; janelas de inscrição; pré-visualização do que será gerado; e regras próprias por tipo de evento. Também falta separar "rascunho" de "publicado".

### 3. Backend agnóstico a banco de dados

O SQL está isolado nos repositórios, o que já ajuda, mas é MariaDB/MySQL explícito (`INSERT IGNORE`, `ON DUPLICATE KEY UPDATE`, tipos `JSON` que voltam como texto). Trocar de banco hoje significa reescrever todo o diretório de repositórios. O caminho é uma interface de persistência com implementações por banco, ou uma camada de query que absorva essas diferenças.

### 4. Novos formatos sem depender do JSON gigante

`lib/cardinfo.json` tem 24 MB e é carregado inteiro para virar um índice pequeno. Funciona, mas não escala para vários formatos: cada novo formato tenderia a trazer o seu próprio dump. O ideal é uma fonte de dados de cartas indexada (banco ou índice compacto gerado em build), com formatos declarados como dados — pool + banlist + erratas — em vez de código.

### 5. Melhorar a UI do site de modo geral

Consistência de espaçamento e tipografia, hierarquia das páginas de torneio, densidade das tabelas, estados vazios, responsividade das telas mais pesadas (bracket, participantes) e acessibilidade. Falta também um passe de design system: hoje há CSS global, módulos e classes utilitárias convivendo.

### 6. Melhorar o tratamento de erros

Qualquer erro de backend hoje vira a tela genérica do Next ("this page couldn't load"), sem explicação nem caminho de saída. Falta: `error.tsx` por rota com mensagem útil e ação de retry, distinção entre falha nossa e indisponibilidade da Nexus/Discord, mensagens de Server Action padronizadas na interface, e log estruturado do lado do servidor para o mesmo incidente ser rastreável.

### Outros pontos menores já identificados

- O registro de auditoria do login de admin (`admin.login`) está comentado em `app/admin/callback/route.ts` — logins não aparecem no log.
- Não existe fluxo de "trocar token Nexus" para o jogador fora do momento em que o token quebra.
- `pnpm db:seed` não gera massa de exemplo, o que torna o onboarding local mais lento do que precisaria.
- Os testes que tocam banco não têm isolamento próprio: rodam contra a `DATABASE_URL` configurada e limpam tabelas.
