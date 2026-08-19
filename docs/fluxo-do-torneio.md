# REDU Format - Fluxo Completo de um Torneio

Este documento descreve, passo a passo, tudo o que acontece num torneio do REDU Format - da criação até a colocação final no ranking. É um guia funcional: explica o que cada pessoa (staff/admin ou jogador) vê e faz em cada etapa, e as regras que governam cada decisão. Não entra em como isso é construído por trás - é sobre o que acontece, não sobre como o sistema faz acontecer.

## 1. Criação do torneio

Um membro da Staff cria o torneio preenchendo:

- **Nome e data/horário** de início.
- **Estrutura**: Suíço, Eliminação Simples ou Eliminação Dupla.
- **Número de rodadas** (só relevante pra Suíço - eliminação define isso sozinha pelo tamanho do campo).
- **Formato de partida**: Bo1 (melhor de 1) ou Bo3 (melhor de 3). Vale pra todas as rodadas do torneio, incluindo Eliminação Simples/Dupla e o Top Cut - não existe uma configuração separada só pra final.
- **Duração**: define como uma rodada termina. São dois modos:
  - **Padrão (mesmo dia)** - o modo default de todo torneio novo. Cada rodada dura um tempo fixo em minutos (padrão: 50). Quando esse tempo acaba, a rodada é **trancada** (ninguém reporta mais nada nela) e começa um período de limpeza de X minutos (padrão: 10) pra Staff corrigir o que precisar. Acabada a limpeza, a próxima rodada é gerada sozinha - e a Staff pode adiantar isso a qualquer momento depois do tranco.
  - **Longa duração (vários dias)** - pra torneios em que pode passar um ou mais dias entre rodadas. A rodada tranca quando todos reportam ou quando o **prazo de rodada** (em dias, padrão: 2) vence, e aí o torneio **espera**: a próxima rodada só existe quando um moderador gerar. Nunca é automático.
- **Prazo de rodada**: só no modo de longa duração - quantos dias uma rodada fica aberta antes de ser fechada automaticamente (padrão: 2 dias). Isso não é um cronômetro de duelo - é o tempo que os jogadores têm pra se organizar e duelar, já que ninguém joga no exato instante em que a rodada abre.
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
- Torneio pago: a inscrição entra como "pagamento pendente". O jogador (ou a Staff) anexa um comprovante, e um membro da Staff confirma, contesta ou mantém pendente o pagamento. Só depois de **confirmado** é que o pagamento conta como resolvido pra fins de regras de cancelamento de inscrição (ver seção 6).

### Gerenciar inscrição

Enquanto o torneio não começou, o jogador pode voltar e trocar de deck a qualquer momento, ou cancelar a inscrição (ver seção 6). Um jogador também pode "salvar" um torneio pra acompanhar sem se inscrever ainda.

Depois que o torneio começa, o deck fica travado pro torneio inteiro - não existe troca de deck entre rodadas, nem side deck entre os duelos de uma partida Bo3. O mesmo deck vale do primeiro ao último duelo.

### Deck travado e desclassificação

Mudar o deck **antes** do torneio começar é livre e não gera aviso nenhum. No instante em que a Staff inicia o bracket, a lista que cada jogador tem naquele momento é congelada - é essa lista, e só ela, que vale pro torneio inteiro.

- Enquanto o jogador tiver torneio em andamento, cada visita ao site checa o deck dele na Dueling Nexus contra a lista congelada (no máximo uma checagem a cada 30 minutos por inscrição, e sempre lendo o registro do torneio e a Nexus - nunca nada que venha do navegador).
- Qualquer diferença é **desclassificação imediata** (DQ). Não existe aviso prévio nem prazo pra desfazer: detectou, desclassificou.
- O jogador recebe um alerta dizendo que foi desclassificado e por quê, o DQ fica registrado na inscrição, e ele aparece como **Desclassificado** na lista de participantes e no painel da Staff.
- A checagem vale pra todos os torneios em andamento do jogador ao mesmo tempo, cada um contra a própria lista congelada.

A única exceção é a Staff corrigir manualmente o deck de um jogador - por exemplo, se a inscrição foi feita com o deck errado por engano. Isso é uma ação excepcional, feita à mão pela Staff, e fica registrada no audit log.

## 3. Fechamento das inscrições e início do bracket

Quando a Staff decide começar o torneio, ela inicia o bracket a partir da lista de inscritos naquele momento - **quem se inscreve depois já não entra mais**, e a inscrição pública fecha automaticamente pra esse torneio.

- É preciso um número mínimo de participantes pra começar (2 pra Suíço/Eliminação Simples, 4 pra Eliminação Dupla). Abaixo disso, o início é bloqueado.
- O sistema pareia a primeira rodada automaticamente.
- **O torneio pode começar antes do horário anunciado.** O sistema guarda os dois instantes separadamente: o horário planejado (o que foi anunciado na criação) e o horário real em que a Staff efetivamente iniciou o bracket. A partir desse início real, o torneio deixa de aparecer como "em breve" em qualquer lugar do site - na lista de eventos, na página do evento, na inscrição - mesmo que o horário anunciado ainda não tenha chegado. O horário anunciado continua sendo exibido como referência, mas quem manda pra fins de "já começou ou não" é o início real.
- **Campo com número ímpar de jogadores**: um jogador recebe um "bye" - uma vitória automática naquela rodada, sem duelo, sem nada pra reportar. Isso se repete em qualquer rodada suíça que fique ímpar (ver seção 8 - o bye funciona diferente em Eliminação Simples/Dupla).

O restante deste documento - rodadas, prazos, pontuação, desempate - descreve principalmente o **Suíço**, que é a estrutura mais comum. As duas seções seguintes descrevem especificamente a Eliminação Simples e a Eliminação Dupla, que têm um fluxo de bracket bem diferente do Suíço.

## 4. Eliminação Simples

Quando o torneio inteiro é Eliminação Simples (não o Top Cut depois de um Suíço - isso é a seção 11), o fluxo de "uma rodada de cada vez" das seções 7 e 8 não se aplica da mesma forma. Em vez disso:

- **Criação do bracket**: o chaveamento inteiro é montado de uma vez, assim que a Staff inicia o torneio - não existe "próxima rodada gerada depois que a anterior termina" como no Suíço. Quem enfrenta quem em cada fase, até a final, já está definido desde o início.
- **Seed inicial**: hoje os confrontos da primeira rodada são sorteados aleatoriamente entre os inscritos - não existe ranking prévio nessa fase pra basear um seed do tipo 1º×8º (esse tipo de seed só existe no Top Cut, que vem depois de rodadas suíças - ver seção 11).
- **Byes**: se o número de inscritos não for uma potência de 2 (não for 4, 8, 16, 32...), alguns jogadores recebem um bye já na primeira rodada, pra que a rodada seguinte já tenha um número "redondo" de jogadores. Quem recebe esse bye é decidido pelo sorteio inicial - diferente do bye do Suíço, não se repete adaptativamente rodada a rodada, é decidido uma única vez.
- **Avanço do vencedor**: quem vence uma partida avança automaticamente pra próxima fase do bracket, sem nenhuma ação manual da Staff - assim que o resultado é confirmado (report dos dois lados, ou correção da Staff), o vencedor já aparece pareado na fase seguinte.
- **Eliminação do perdedor**: quem perde está fora do torneio. Não existe disputa de 3º lugar hoje.
- **Campeão**: quem vencer a última partida (a final) é o campeão do torneio.
- Cada fase usa o mesmo formato Bo1/Bo3 configurado na criação do torneio (seção 1), e o mesmo mecanismo de prazo por rodada (seção 1 e 7) - cada fase do bracket tem seu próprio prazo, contado a partir do momento em que aquele confronto foi pareado.
- Mínimo de 2 participantes pra começar.

## 5. Eliminação Dupla

- Criação do bracket e seed inicial funcionam igual à Eliminação Simples (sorteio aleatório entre os inscritos, sem ranking prévio).
- Dois brackets rodam em paralelo: o **Upper Bracket** (chave principal) e o **Lower Bracket** (a "segunda chance").
- Todo mundo começa no Upper Bracket. Quem perde uma partida lá **não é eliminado ainda** - cai pro Lower Bracket, numa posição decidida automaticamente pelo sistema, que também evita, quando dá, que os mesmos dois jogadores se reencontrem cedo demais dentro do Lower Bracket.
- Quem perde uma partida já estando no Lower Bracket **é eliminado de verdade** - é a segunda derrota, não tem mais pra onde cair.
- **Grand Final**: quando só sobra um jogador no Upper Bracket e um no Lower Bracket, os dois se enfrentam numa partida final.
- **Reset da Grand Final**: existe. Se quem veio do Lower Bracket vencer a Grand Final, o finalista invicto leva sua primeira derrota - os dois passam a ter uma derrota cada, e o sistema cria automaticamente uma segunda partida ("Grand Final Reset"). Quem vencer essa é o campeão.
- **Nomes das rodadas**: a chave inteira é montada de uma vez e cada partida sabe a que metade pertence, então ela é exibida como **Winners Round N / Winners Final**, **Losers Round N / Losers Final**, **Grand Final** e **Grand Final Reset** - nunca como "Rodada 5", que na numeração interna do motor é só a primeira rodada do Lower Bracket, não a quinta rodada do torneio.
- **Prazo**: cada partida corre no próprio relógio (a partir do momento em que os dois jogadores dela são definidos). Não existe "rodada travada" como no Suíço, porque a chave avança partida a partida, e não em bloco.
- **Byes**: mesma lógica da Eliminação Simples - se o número de inscritos não for uma potência de 2, alguns jogadores recebem bye já na primeira rodada do Upper Bracket, decidido no sorteio inicial.
- Cada fase usa o mesmo Bo1/Bo3 configurado na criação do torneio, igual à Eliminação Simples.
- **Campeão**: quem vencer a Grand Final.
- Mínimo de 4 participantes pra começar - diferente do Suíço e da Eliminação Simples, que pedem só 2.

## 6. Saindo do torneio (drop)

O jogador tem um botão pra sair do torneio a qualquer momento, mas o que acontece depende de quando ele usa:

| Situação | O que acontece |
| --- | --- |
| Torneio ainda não começou, e é grátis | Sai na hora, sem restrição. Pode se inscrever de novo depois, normalmente. |
| Torneio ainda não começou, é pago, mas o pagamento **não** foi confirmado | Mesma coisa - sai livre, pode voltar a se inscrever. |
| Torneio ainda não começou, é pago, e o pagamento **já foi confirmado** | O botão fica bloqueado. A mensagem orienta o jogador a falar com um membro da Staff pra resolver isso manualmente. |
| Torneio já começou | Aparece um aviso antes de confirmar, deixando claro que: (1) dropar conta como uma **derrota automática** na rodada atual; (2) isso **prejudica o tiebreaker** de quem continua no torneio (porque o desempenho dos adversários entra no cálculo de quem eles enfrentaram); (3) se o torneio for pago, **não há reembolso**. Só depois dessa confirmação o drop é efetivado. |

Um jogador que dropa depois do início do torneio some dos próximos pareamentos, mas o histórico dele (pontos, partidas já jogadas) continua contando pro cálculo de tiebreaker de quem ele enfrentou.

Se o jogador ainda não tiver uma partida pareada naquela rodada no momento do drop (por exemplo, está esperando o próximo pareamento, ou está numa rodada que ainda não abriu partida pra ele por causa de um bye anterior), não existe partida pra "perder" de fato - o drop simplesmente concede a derrota da rodada atual (se houver uma partida em aberto pra ele) e ele para de receber novos pareamentos dali em diante.

### Ausência automática

Um jogador que **não reporta resultado em 2 rodadas seguidas** é automaticamente removido do torneio, do mesmo jeito que um drop manual - com a derrota da rodada atual contabilizada normalmente. Reportar (ou ter o resultado decidido a tempo por qualquer via) numa rodada zera essa contagem.

## 7. A rodada, na prática

Cada rodada, para cada dupla pareada:

1. Uma **sala de duelo é criada automaticamente** assim que o pareamento acontece, com as configurações padrão do formato REDU já pré-configuradas (banlist, formato, pontos de vida, mão inicial, etc. - o jogador não escolhe nada disso, só entra na sala). O link da sala aparece na área do jogador.
2. Os dois jogadores combinam entre si quando vão duelar, dentro do prazo da rodada (o prazo configurado no torneio, contado a partir do momento em que o pareamento foi feito).
3. Depois do duelo, **cada jogador reporta o próprio resultado** (Venci / Perdi / Empate) na área do evento. Ninguém reporta pelo outro.
4. **Quando os dois lados concordam** (um diz "venci", o outro diz "perdi"; ou os dois dizem "empate"), o resultado é confirmado automaticamente e a rodada segue.
5. **Quando os dois lados discordam** (os dois dizem "venci", os dois dizem "perdi", ou um diz "empate" e o outro não), a partida fica marcada como **disputada**. Ninguém mais precisa fazer nada além de esperar - um membro da Staff vai revisar e definir o resultado correto manualmente. Enquanto uma partida estiver disputada, **a próxima rodada não começa** até ela ser resolvida (as outras partidas da rodada podem já ter terminado normalmente).
6. A Staff também pode entrar ou corrigir manualmente o resultado de qualquer partida - inclusive uma que já tinha sido reportada pelos dois jogadores, se precisar corrigir um erro. Isso só vale **enquanto a rodada daquela partida ainda for a rodada corrente** - assim que a próxima rodada é gerada, o resultado fica trancado e não pode mais ser alterado (evita recálculo retroativo de pareamentos e tiebreakers já usados por rodadas seguintes). Toda correção manual - primeira entrada ou alteração - fica registrada no audit log da Staff.

### O que "Venci / Perdi / Empate" significa numa série Bo3

Numa partida Bo3 (melhor de três duelos), os dois jogadores duelam entre si fora do REDU, na sala do Dueling Nexus, até alguém fechar a série - **2×0 ou 2×1**. O sistema não acompanha duelo a duelo, só pede o resultado final da série:

- **1×1 não fecha a série** - os jogadores duelam um terceiro antes de reportar qualquer coisa.
- **Empate** só existe se a série for interrompida antes de terminar por algum motivo externo ao jogo (por exemplo, o prazo da rodada vencer com a série em andamento e nenhum dos dois tendo fechado - ver "Quando o prazo da rodada vence" abaixo). Não existe "empatar" por decisão própria dos jogadores.
- Quem abandona a série no meio conta como derrota pra quem abandonou, não como empate.

Isso vale igual pra Bo1 - a única diferença é que a série já termina no primeiro duelo.

### Quando o prazo da rodada vence

Se o prazo (em dias) da rodada terminar antes de uma partida ser resolvida:

- Se **só um jogador reportou**, o resultado que ele reportou é aceito como está - o outro lado teve a chance e não reportou.
- Se **nenhum dos dois reportou** (ou os dois reportaram algo que nunca bateu), o sistema resolve automaticamente pra não travar o torneio:
  - No **Suíço**, isso é um **double loss**: os dois ficam com **0 pontos** naquela rodada - o silêncio ou a discordância dos dois lados não beneficia ninguém.
  - Na **Eliminação Simples, Eliminação Dupla, e no Top Cut** (seção 11), um double loss não é possível - o bracket exige que alguém avance pra fase seguinte. Nesses casos o sistema declara um vencedor arbitrariamente (hoje, sempre quem está na posição "jogador 1" daquela partida).
  - Esse é um caso raro e sempre pode ser corrigido depois por um membro da Staff, dentro da janela de correção descrita no item 6 acima.

### Rodada trancada

Vencido o tempo da rodada (o cronômetro de minutos no modo padrão, o prazo em dias no modo de longa duração), a rodada fica **trancada**: os botões de report somem e o servidor recusa qualquer report atrasado - não adianta recarregar a página, voltar no histórico ou forjar o formulário, porque quem decide é o horário gravado no banco, não o navegador. No lugar dos botões, o jogador vê o motivo e o link do Discord pra falar com um Tournament Organizer.

Depois disso:

- **Modo padrão (mesmo dia)**: passa o período de limpeza e a próxima rodada é gerada automaticamente. Um moderador pode gerar antes, sem esperar o resto da limpeza.
- **Modo de longa duração**: o torneio fica parado nesse estado até um moderador gerar a próxima rodada. Nunca sozinho.

## 8. Byes, novamente

Vale repetir: um bye (quando o número de jogadores ativos numa rodada é ímpar) não é uma partida de verdade. Não há sala, não há nada pra reportar - o jogador que recebe o bye simplesmente ganha os pontos de uma vitória naquela rodada e segue pra próxima.

Isso descreve o bye do **Suíço** especificamente - ele pode se repetir a cada rodada que fica ímpar. Na Eliminação Simples e na Eliminação Dupla, o bye funciona diferente: é decidido uma única vez, no sorteio inicial do bracket, e não se repete adaptativamente rodada a rodada (ver seções 4 e 5).

## 9. Pontuação

Cada partida vale, pro placar geral do torneio:

- **Vitória**: 3 pontos.
- **Empate**: 1 ponto.
- **Derrota**: 0 pontos.
- **Bye**: conta como uma vitória (3 pontos), sem custo pro adversário (porque não existe adversário naquela rodada).

Se o torneio tem **top cut** (corte pra mata-mata depois da fase suíça), cada vitória dentro do top cut soma **+5 pontos extras** no total final do jogador, além dos pontos normais da partida.

## 10. Desempate (quando duas pessoas empatam em pontos)

Esse é o tiebreaker oficial usado nos torneios presenciais da Konami (KDE-US Tournament Policy, seção V.C), adotado aqui pra manter a colocação do REDU o mais fiel possível ao que um jogador competitivo já conhece. Quando dois ou mais jogadores terminam com a mesma pontuação, a colocação entre eles é decidida, nessa ordem:

1. **Força do calendário dos adversários (OMW%)**: a média de aproveitamento dos adversários que o jogador enfrentou - quem joga contra gente que, em média, venceu mais partidas fica na frente. Cada adversário individual tem um piso de 1/3 nesse cálculo, pra um adversário que caiu cedo (bye, drop) não puxar ninguém pra baixo além do que uma derrota normal puxaria.
2. **Força do calendário dos adversários dos adversários (OOMW%)**: se ainda empatado, olha um nível mais fundo - a média do OMW% de cada adversário do jogador.
3. **Em que rodadas as derrotas aconteceram**: soma o quadrado do número de cada rodada em que o jogador perdeu de verdade (empate e double loss não contam aqui - ver seção 7). Perder mais tarde pesa mais que perder cedo. Como último critério, praticamente nunca chega a decidir nada na prática.
4. **Ordem alfabética pelo nome** cadastrado, no caso (extremamente raro) de dois jogadores terminarem absolutamente empatados em tudo - mesmo critério que a Konami usa no desempate final.

Empate conta como derrota só pra efeito desse cálculo de "força do calendário" (não pra pontuação do próprio jogador, que continua valendo 1 ponto normalmente).

Esse mesmo cálculo também decide o seed do Top Cut (ver seção 11) - com uma ressalva: o motor que monta o bracket do mata-mata usa uma aproximação dos dois primeiros critérios (força do calendário, força do calendário dos adversários) pra decidir a ordem, sem o piso de 1/3 nem o terceiro critério (rodada da derrota). Isso só importa no caso raríssimo de dois jogadores empatados em pontos **e** nos dois primeiros critérios exatamente no corte do Top Cut - a colocação final exibida pro jogador sempre usa a fórmula completa e correta, é só o seed do bracket que pode, nesse cenário específico, não bater 100% com ela.

## 11. Top Cut, em detalhe

O Top Cut é sempre eliminação simples, mesmo quando o resto do torneio é Suíço - não existe Top Cut em formato de dupla eliminação hoje.

- **Seed**: os classificados são pareados pela colocação final do Suíço (calculada pelo tiebreaker da seção 10) - 1º contra o último colocado do corte, 2º contra o penúltimo, e assim por diante. Num Top 8, por exemplo: **1º×8º, 2º×7º, 3º×6º, 4º×5º**.
- Cada fase do Top Cut usa o mesmo formato Bo1/Bo3 configurado pro torneio inteiro (seção 1) - não existe uma configuração separada só pro mata-mata.
- Fora o seed vir da colocação do Suíço, o resto do Top Cut funciona exatamente como a Eliminação Simples (seção 4): avanço automático do vencedor, eliminação direta do perdedor, sem 3º lugar, campeão é quem vence a final.
- Vitórias dentro do Top Cut valem o bônus de +5 pontos (seção 9), além da pontuação normal 3/1/0.

## 12. Encerramento do torneio

Quando não há mais rodadas ou partidas de top cut pra jogar, a Staff encerra o torneio manualmente. Nesse momento:

- A colocação final de todo mundo é calculada e **congelada** - vira o resultado oficial e definitivo daquele torneio, exibido na página do evento.
- Cada jogador vê sua colocação final e a pontuação total (incluindo o bônus de top cut, se houve).
- O torneio some da lista de partidas em aberto e passa a aparecer como "resultado finalizado" na página do evento e no histórico de cada jogador.

Esse encerramento é um instante diferente do início do torneio (seção 3) - um torneio pode estar "começado" (bracket rodando, inscrição fechada) por dias sem estar "encerrado". Só depois desse encerramento é que a página do evento troca de "Torneio" pra "Resultados" e mostra o link de colocação; enquanto o bracket só está em andamento, o jogador vê o card normal do torneio com a partida atual dele.

## 13. Cancelamento do torneio

A Staff pode cancelar um torneio inteiro, mesmo depois de já ter começado.

- Um torneio cancelado **não gera colocação e não entra pro ranking geral** - nenhum jogador ganha ou perde pontos por causa dele.
- Pagamentos já confirmados seguem a política de reembolso que a Staff decidir caso a caso - o sistema não reembolsa automaticamente.
- O torneio passa a aparecer como **Cancelado**, um estado final diferente de **Encerrado** (seção 12). Um torneio encerrado tem resultado oficial; um cancelado não tem.
- Partidas já jogadas antes do cancelamento continuam visíveis no histórico de cada jogador, só não contam pra ranking nem geram colocação final.

## 14. Pausar ou estender uma rodada

Se algo impede os jogadores de duelar dentro do prazo normal - por exemplo, o Dueling Nexus fica fora do ar - a Staff pode estender o prazo da rodada corrente.

- A Staff altera o prazo (deadline) só da rodada que está em andamento no momento.
- Toda alteração de prazo fica registrada no audit log da Staff (quem alterou, de quando pra quando).
- Não existe hoje uma pausa geral do torneio (travar tudo até a Staff destravar) - só a extensão do prazo da rodada atual.

## 15. Depois do torneio

- A colocação de cada jogador entra no **ranking geral (leaderboard)** do REDU Format, que soma pontos de todos os torneios em que aquele jogador participou vinculado à sua conta.
- No painel pessoal, cada jogador vê seus eventos passados com a colocação obtida ("Colocado em #N") e pode revisitar o histórico rodada a rodada daquele torneio específico (contra quem jogou, resultado de cada duelo).
- Um jogador que nunca vinculou a inscrição a uma conta (inscrição feita manualmente pela Staff, sem login) não aparece no ranking geral - só quem joga com conta vinculada acumula pontos entre torneios.
- Torneios cancelados não entram nesse cálculo (ver seção 13).

### Pontos de ranking por colocação

Proposta inicial pra validar - ainda não implementada, é o que falta pra fechar o sistema de ranking:

| Colocação | Pontos no ranking |
| --- | ---: |
| 1º | 100 |
| 2º | 75 |
| 3º-4º | 50 |
| 5º-8º | 25 |
| 9º-16º | 10 |
| Participação (17º em diante) | 5 |

Ainda em aberto, pra decidir depois de validar a tabela acima:

- Torneios maiores ou pagos valem mais pontos que torneios pequenos/grátis?
- O ranking usa todos os torneios do jogador, ou só os últimos N?
- Existe descarte do pior resultado?
- Pontos de ranking expiram (por período, ou por temporada)?
