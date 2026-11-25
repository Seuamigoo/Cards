# Eventos do duelo

A UI anima o duelo só com o `EventBus` de `GameMatch`. O estado já está atualizado quando o evento sai. `instanceId` identifica a cópia física da carta. `cardId` é o id do catálogo. O Limbo é a única pilha de cartas que saíram de jogo: o cemitério antigo, se ainda vier num save, é somado ao Limbo na carga.

Nomes já publicados continuam iguais. Campos novos foram acrescentados aos payloads antigos.

## Eventos

| Evento | Quando | Payload |
| --- | --- | --- |
| `phase:changed` | Toda troca de fase | `from`, `to`, `turn`, `activePlayerIndex` |
| `turn:started` | A fase `end` vira a `draw` do adversário | `turn`, `activePlayerIndex` |
| `card:drawn` | Compra da fase `draw` | `playerIndex`, `card`, `turn`, `instanceId`, `cardId` |
| `monster:summoned` | Invocação, convergência ou entrada do Dragão Brasa | `playerIndex`, `zoneIndex`, `position`, `instanceId`, `cardId`, `card` |
| `monster:position` | Mudança de posição | `playerIndex`, `zoneIndex`, `position`, `instanceId`, `cardId` |
| `spelltrap:set` | Carta colocada no slot de magia ou armadilha | `playerIndex`, `zoneIndex`, `instanceId`, `cardId`, `card` |
| `spelltrap:activated` | Magia ativada na Main Phase, ou armadilha ativada na batalha | `playerIndex`, `owner`, `zoneIndex`, `instanceId`, `cardId`, `targets?` |
| `effect:activated` | Efeito de monstro ou Torre | `playerIndex`, `zoneIndex` (ou `null` na Torre), `instanceId`, `cardId`, `kind` |
| `attack:declared` | Declaração de ataque | `playerIndex`, `attackerZoneIndex`, `target`, `instanceId`, `cardId`, `targetInstanceId`, `targetCardId` |
| `damage:dealt` | Dano em monstro, Torre ou jogador | `playerIndex`, `amount`, `source` (`battle` ou `effect`), `target` (`monster`, `tower` ou `player`), `zoneIndex`, `instanceId`, `cardId` |
| `monster:destroyed` | Monstro destruído em batalha | `playerIndex`, `zoneIndex`, `instanceId`, `cardId`, `card` |
| `card:sent` | Carta vai ao Limbo | `playerIndex`, `instanceId`, `cardId`, `destination` (`limbo`), `from` (`monster`, `hand`, `tower`, `biome`, `spelltrap` ou `material`), `zoneIndex` |
| `tower:summoned` | Torre colocada | `playerIndex`, `def`, `instanceId`, `cardId`, `card` |
| `tower:destroyed` | Torre destruída (ATK maior que a DEF) ou substituída | `playerIndex`, `def`, `instanceId`, `cardId`, `card` |
| `biome:played` | Bioma entra | `playerIndex`, `instanceId`, `cardId`, `card`, `replaced` |
| `biome:left` | Bioma sai porque outro entra | `playerIndex`, `instanceId`, `cardId`, `card` |
| `monster:fused` | Fusão do Dragão Brasa | `playerIndex`, `zoneIndex`, `position`, `instanceId`, `cardId`, `card`, `materials`, `materialInstanceIds` |
| `materials:released` | Materiais soltos quando o monstro fundido sai | `playerIndex`, `zoneIndex`, `instanceId`, `cardId`, `cards`, `materialInstanceIds` |
| `game:over` | Derrota por compra ou por HP | `winner`, `reason` (`deck_out` ou `player_hp`) |

`kind` de `effect:activated`: `onSummon` (efeito ao entrar), `activate` (uma vez por turno) ou `aura` (aura ou bônus contínuo de Torre, inclusive `towerDef`).

`target` de `attack:declared` é `{ kind: "monster", zoneIndex }`, `{ kind: "tower" }` ou `{ kind: "player" }`. No alvo jogador, `targetInstanceId` e `targetCardId` são `null`. No dano ao jogador, `zoneIndex`, `instanceId` e `cardId` são `null`.

`targets`, quando vem, é uma lista de `{ owner, zoneIndex, instanceId }`. Sem alvo, o campo fica de fora.

A Torre não tem HP. O ataque compara o ATK efetivo com a DEF efetiva. ATK maior destrói a Torre (`tower:destroyed`) e ela vai ao Limbo, sem dano no HP de quem atacou. ATK menor mantém a Torre e quem atacou perde a diferença (`damage:dealt` no jogador). Empate não muda HP nem destrói a Torre.

No turno 1, quem começa não compra ao sair da Draw Phase e não entra na Battle Phase, então não ataca.

## Visão do jogador

`getPlayerView(state, playerId)` devolve a partida para um assento. A própria mão vem completa. A mão do oponente vem só como cartas `{ hidden: true }`, com `handCount`. Os dois decks vêm só como `deckCount`. Magia ou armadilha ainda baixada no campo do oponente vem `{ hidden: true }`, sem `cardId`, até `spelltrap:activated`. Monstro do oponente só perde o `cardId` se `faceDown` for `true`. A v0.2 não coloca monstro virado para baixo; Defesa normal continua visível. O Limbo dos dois é público.

`redactEventFor(event, playerId, state)` tira `card` e `cardId` de `card:drawn` e de `spelltrap:set` quando o espectador não é o dono. A carta baixada conserva `instanceId` para a UI virar a mesma cópia na ativação. `spelltrap:activated` mostra o `cardId` para os dois.

## Ordem

- Invocação: `card:sent` dos tributos (Limbo), `monster:summoned`, `effect:activated` `onSummon`, `effect:activated` `aura`, `damage:dealt` do efeito, `game:over` se o HP chegou a zero.
- Posição: só `monster:position`.
- Magia ou armadilha baixada: `spelltrap:set`. Ativação: `spelltrap:activated`, depois `card:sent` ao Limbo.
- Ativar 1x por turno: só `effect:activated` com `kind: "activate"`.
- Ataque: `attack:declared`, dano no alvo, dano no jogador quando a Torre segura o golpe ou o monstro perde HP, `monster:destroyed` (defensor, depois atacante), `card:sent` ao Limbo, `materials:released` e `card:sent` dos materiais, `tower:destroyed` e `card:sent` da Torre se o ATK superar a DEF, `game:over`.
- Torre: se substitui outra, `tower:destroyed` e `card:sent`; depois `tower:summoned` e `effect:activated` `aura`.
- Bioma: se substitui outro, `biome:left` e `card:sent`; depois `biome:played`.
- Fusão do Dragão Brasa: `monster:summoned`, depois `monster:fused`. Os Filhotes não são destruídos nem enviados. Quando o Dragão sai: `monster:destroyed`, `card:sent` do Dragão ao Limbo, `materials:released`, `card:sent` de cada material.
- Fase: `phase:changed`, `card:sent` do descarte de mão ao Limbo, `turn:started`, `card:drawn`, `game:over` por deck vazio.

Tributo não emite `monster:destroyed`. Monstro destruído, tributo, magia ativada e Torre destruída vão ao Limbo.
