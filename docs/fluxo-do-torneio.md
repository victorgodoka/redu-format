# REDU Format - Fluxo Completo de um Torneio

Este documento descreve, passo a passo, tudo o que acontece num torneio do REDU Format - da criação até a colocação final no ranking. É um guia funcional: explica o que cada pessoa (staff/admin ou jogador) vê e faz em cada etapa, e as regras que governam cada decisão. Não entra em como isso é construído por trás - é sobre o que acontece, não sobre como o sistema faz acontecer.

## 1. Criação do torneio

Um membro da Staff cria o torneio preenchendo:

- **Nome e data/horário** de início.
- **Estrutura**: Suíço, Eliminação Simples ou Eliminação Dupla.
- **Número de rodadas** (só relevante pra Suíço - eliminação define isso sozinha pelo tamanho do campo).
- **Formato de partida**: Bo1 (melhor de 1) ou Bo3 (melhor de 3).
- **Prazo de rodada**: quantos dias uma rodada fica aberta antes de ser fechada automaticamente (padrão: 2 dias). Isso não é um cronômetro de duelo - é o tempo que os jogadores têm pra se organizar e duelar, já que ninguém joga no exato instante em que a rodada abre.
- **Engine**: onde os duelos acontecem. Hoje só existe a opção Dueling Nexus.
- **Vagas**: um número fixo ou "ilimitado".
- **Entrada**: grátis ou paga (com valor e moeda).
- **Host** e **link de inscrição externo** (opcional, decorativo).
- **Top cut**: se o torneio for Suíço, a Staff pode ativar um corte pra eliminação direta ao final das rodadas suíças. O tamanho do corte (Top 4, Top 8, Top 16...) é sugerido automaticamente pelo tamanho do campo e não pode ser digitado à mão - isso evita um corte maior que o razoável pra pouca gente ou menor que o ideal pra muita gente.

Depois de criado, o torneio aparece na lista pública de eventos e pode receber inscrições.

## 2. Inscrição do jogador

Um jogador se inscreve fazendo login com o token da Dueling Nexus e escolhendo um dos seus decks. Antes de confirmar a inscrição:

- O deck precisa estar **legal pro formato REDU** (banlist e pool de cartas do formato são checados automaticamente). Um deck ilegal não pode ser usado pra se inscrever.
- Se o torneio tem **vagas limitadas** e já lotou, a inscrição fica bloqueada - não existe lista de espera.
- Se o torneio já **começou** (a Staff já iniciou o bracket), a inscrição também fica bloqueada, mesmo que ainda haja vaga.

Se o jogador já estava inscrito e escolhe outro deck, isso **substitui** o deck anterior - não cria uma segunda inscrição.

### Pagamento

- Torneio grátis: a inscrição já entra pronta, sem nenhuma etapa de pagamento.
- Torneio pago: a inscrição entra como "pagamento pendente". O jogador (ou a Staff) anexa um comprovante, e um membro da Staff confirma, contesta ou mantém pendente o pagamento. Só depois de **confirmado** é que o pagamento conta como resolvido pra fins de regras de cancelamento (ver seção 4).

### Gerenciar inscrição

Enquanto o torneio não começou, o jogador pode voltar e trocar de deck a qualquer momento, ou cancelar a inscrição (ver seção 4). Um jogador também pode "salvar" um torneio pra acompanhar sem se inscrever ainda.

Depois que o torneio começa, o deck fica travado pro torneio inteiro - não existe troca de deck entre rodadas, nem side deck entre os duelos de uma partida Bo3. O mesmo deck vale do primeiro ao último duelo.

## 3. Fechamento das inscrições e início do bracket

Quando a Staff decide começar o torneio, ela inicia o bracket a partir da lista de inscritos naquele momento - **quem se inscreve depois já não entra mais**, e a inscrição pública fecha automaticamente pra esse torneio.

- É preciso um número mínimo de participantes pra começar (2 pra Suíço/Eliminação Simples, 4 pra Eliminação Dupla). Abaixo disso, o início é bloqueado.
- O sistema pareia a primeira rodada automaticamente.
- **O torneio pode começar antes do horário anunciado.** O sistema guarda os dois instantes separadamente: o horário planejado (o que foi anunciado na criação) e o horário real em que a Staff efetivamente iniciou o bracket. A partir desse início real, o torneio deixa de aparecer como "em breve" em qualquer lugar do site - na lista de eventos, na página do evento, na inscrição - mesmo que o horário anunciado ainda não tenha chegado. O horário anunciado continua sendo exibido como referência, mas quem manda pra fins de "já começou ou não" é o início real.
- **Campo com número ímpar de jogadores**: um jogador recebe um "bye" - uma vitória automática naquela rodada, sem duelo, sem nada pra reportar. Isso se repete em qualquer rodada suíça que fique ímpar.

## 4. Saindo do torneio (drop)

O jogador tem um botão pra sair do torneio a qualquer momento, mas o que acontece depende de quando ele usa:

| Situação | O que acontece |
| --- | --- |
| Torneio ainda não começou, e é grátis | Sai na hora, sem restrição. Pode se inscrever de novo depois, normalmente. |
| Torneio ainda não começou, é pago, mas o pagamento **não** foi confirmado | Mesma coisa - sai livre, pode voltar a se inscrever. |
| Torneio ainda não começou, é pago, e o pagamento **já foi confirmado** | O botão fica bloqueado. A mensagem orienta o jogador a falar com um membro da Staff pra resolver isso manualmente. |
| Torneio já começou | Aparece um aviso antes de confirmar, deixando claro que: (1) dropar conta como uma **derrota automática** na rodada atual; (2) isso **prejudica o tiebreaker** de quem continua no torneio (porque o desempenho dos adversários entra no cálculo de quem eles enfrentaram); (3) se o torneio for pago, **não há reembolso**. Só depois dessa confirmação o drop é efetivado. |

Um jogador que dropa depois do início do torneio some dos próximos pareamentos, mas o histórico dele (pontos, partidas já jogadas) continua contando pro cálculo de tiebreaker de quem ele enfrentou.

### Ausência automática

Um jogador que **não reporta resultado em 2 rodadas seguidas** é automaticamente removido do torneio, do mesmo jeito que um drop manual - com a derrota da rodada atual contabilizada normalmente. Reportar (ou ter o resultado decidido a tempo por qualquer via) numa rodada zera essa contagem.

## 5. A rodada, na prática

Cada rodada, para cada dupla pareada:

1. Uma **sala de duelo é criada automaticamente** assim que o pareamento acontece, com as configurações padrão do formato REDU já pré-configuradas (banlist, formato, pontos de vida, mão inicial, etc. - o jogador não escolhe nada disso, só entra na sala). O link da sala aparece na área do jogador.
2. Os dois jogadores combinam entre si quando vão duelar, dentro do prazo da rodada (o prazo configurado no torneio, contado a partir do momento em que o pareamento foi feito).
3. Depois do duelo, **cada jogador reporta o próprio resultado** (Venci / Perdi / Empate) na área do evento. Ninguém reporta pelo outro.
4. **Quando os dois lados concordam** (um diz "venci", o outro diz "perdi"; ou os dois dizem "empate"), o resultado é confirmado automaticamente e a rodada segue.
5. **Quando os dois lados discordam** (os dois dizem "venci", os dois dizem "perdi", ou um diz "empate" e o outro não), a partida fica marcada como **disputada**. Ninguém mais precisa fazer nada além de esperar - um membro da Staff vai revisar e definir o resultado correto manualmente. Enquanto uma partida estiver disputada, **a próxima rodada não começa** até ela ser resolvida (as outras partidas da rodada podem já ter terminado normalmente).
6. A Staff também pode entrar ou corrigir manualmente o resultado de qualquer partida - inclusive uma que já tinha sido reportada pelos dois jogadores, se precisar corrigir um erro. Isso só vale **enquanto a rodada daquela partida ainda for a rodada corrente** - assim que a próxima rodada é gerada, o resultado fica trancado e não pode mais ser alterado (evita recálculo retroativo de pareamentos e tiebreakers já usados por rodadas seguintes). Toda correção manual - primeira entrada ou alteração - fica registrada no audit log da Staff.

### Quando o prazo da rodada vence

Se o prazo (em dias) da rodada terminar antes de uma partida ser resolvida:

- Se **só um jogador reportou**, o resultado que ele reportou é aceito como está - o outro lado teve a chance e não reportou.
- Se **nenhum dos dois reportou** (ou os dois reportaram algo que nunca bateu), o sistema resolve automaticamente pra não travar o torneio; esse é um caso raro e sempre pode ser corrigido depois por um membro da Staff.

Assim que todas as partidas de uma rodada suíça estiverem decididas (por report, por decisão da Staff, ou por prazo vencido), a próxima rodada é gerada automaticamente.

## 6. Byes, novamente

Vale repetir: um bye (quando o número de jogadores ativos numa rodada é ímpar) não é uma partida de verdade. Não há sala, não há nada pra reportar - o jogador que recebe o bye simplesmente ganha os pontos de uma vitória naquela rodada e segue pra próxima.

## 7. Pontuação

Cada partida vale, pro placar geral do torneio:

- **Vitória**: 3 pontos.
- **Empate**: 1 ponto.
- **Derrota**: 0 pontos.
- **Bye**: conta como uma vitória (3 pontos), sem custo pro adversário (porque não existe adversário naquela rodada).

Se o torneio tem **top cut** (corte pra mata-mata depois da fase suíça), cada vitória dentro do top cut soma **+5 pontos extras** no total final do jogador, além dos pontos normais da partida.

## 8. Desempate (quando duas pessoas empatam em pontos)

Esse é o tiebreaker oficial usado nos torneios presenciais da Konami (KDE-US Tournament Policy, seção V.C), adotado aqui pra manter a colocação do REDU o mais fiel possível ao que um jogador competitivo já conhece. Quando dois ou mais jogadores terminam com a mesma pontuação, a colocação entre eles é decidida, nessa ordem:

1. **Força do calendário dos adversários (OMW%)**: a média de aproveitamento dos adversários que o jogador enfrentou - quem joga contra gente que, em média, venceu mais partidas fica na frente. Cada adversário individual tem um piso de 1/3 nesse cálculo, pra um adversário que caiu cedo (bye, drop) não puxar ninguém pra baixo além do que uma derrota normal puxaria.
2. **Força do calendário dos adversários dos adversários (OOMW%)**: se ainda empatado, olha um nível mais fundo - a média do OMW% de cada adversário do jogador.
3. **Em que rodadas as derrotas aconteceram**: soma o quadrado do número de cada rodada em que o jogador perdeu de verdade (empate não conta aqui). Perder mais tarde pesa mais que perder cedo. Como último critério, praticamente nunca chega a decidir nada na prática.
4. **Ordem alfabética pelo nome** cadastrado, no caso (extremamente raro) de dois jogadores terminarem absolutamente empatados em tudo - mesmo critério que a Konami usa no desempate final.

Empate conta como derrota só pra efeito desse cálculo de "força do calendário" (não pra pontuação do próprio jogador, que continua valendo 1 ponto normalmente).

Esse mesmo cálculo também decide o seed do Top Cut (quem pega quem no mata-mata, tipo 1º contra o 8º, 2º contra o 7º etc.) - com uma ressalva: o motor que monta o bracket do mata-mata usa uma aproximação dos dois primeiros critérios (força do calendário, força do calendário dos adversários) pra decidir a ordem, sem o piso de 1/3 nem o terceiro critério (rodada da derrota). Isso só importa no caso raríssimo de dois jogadores empatados em pontos **e** nos dois primeiros critérios exatamente no corte do Top Cut - a colocação final exibida pro jogador sempre usa a fórmula completa e correta, é só o seed do bracket que pode, nesse cenário específico, não bater 100% com ela.

## 9. Encerramento do torneio

Quando não há mais rodadas ou partidas de top cut pra jogar, a Staff encerra o torneio manualmente. Nesse momento:

- A colocação final de todo mundo é calculada e **congelada** - vira o resultado oficial e definitivo daquele torneio, exibido na página do evento.
- Cada jogador vê sua colocação final e a pontuação total (incluindo o bônus de top cut, se houve).
- O torneio some da lista de partidas em aberto e passa a aparecer como "resultado finalizado" na página do evento e no histórico de cada jogador.

Esse encerramento é um instante diferente do início do torneio (seção 3) - um torneio pode estar "começado" (bracket rodando, inscrição fechada) por dias sem estar "encerrado". Só depois desse encerramento é que a página do evento troca de "Torneio" pra "Resultados" e mostra o link de colocação; enquanto o bracket só está em andamento, o jogador vê o card normal do torneio com a partida atual dele.

## 10. Depois do torneio

- A colocação de cada jogador entra no **ranking geral (leaderboard)** do REDU Format, que soma pontos de todos os torneios em que aquele jogador participou vinculado à sua conta.
- No painel pessoal, cada jogador vê seus eventos passados com a colocação obtida ("Colocado em #N") e pode revisitar o histórico rodada a rodada daquele torneio específico (contra quem jogou, resultado de cada duelo).
- Um jogador que nunca vinculou a inscrição a uma conta (inscrição feita manualmente pela Staff, sem login) não aparece no ranking geral - só quem joga com conta vinculada acumula pontos entre torneios.
