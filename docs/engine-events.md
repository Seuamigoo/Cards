# Eventos do duelo

A UI anima o duelo só com o `EventBus` de `GameMatch`. O estado já está atualizado quando o evento sai. `instanceId` identifica a cópia física da carta (estável da mão ao campo, ao Limbo e ao cemitério). `cardId` é o id do catálogo.

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
| `spelltrap:activated` | Magia ou armadilha ativada | `playerIndex`, `zoneIndex`, `instanceId`, `cardId` |
| `effect:activated` | Efeito de monstro ou Torre | `playerIndex`, `zoneIndex` (ou `null` na Torre), `instanceId`, `cardId`, `kind` |
| `attack:declared` | Declaração de ataque | `playerIndex`, `attackerZoneIndex`, `target`, `instanceId`, `cardId`, `targetInstanceId`, `targetCardId` |
| `damage:dealt` | Dano em monstro, Torre ou jogador | `playerIndex`, `amount`, `source` (`battle` ou `effect`), `target` (`monster`, `tower` ou `player`), `zoneIndex`, `instanceId`, `cardId` |
| `monster:destroyed` | Monstro destruído em batalha | `playerIndex`, `zoneIndex`, `instanceId`, `cardId`, `card` |
| `card:sent` | Carta vai ao Limbo ou ao cemitério | `playerIndex`, `instanceId`, `cardId`, `destination` (`limbo` ou `graveyard`), `from` (`monster`, `hand`, `tower`, `biome`, `spelltrap` ou `material`), `zoneIndex` |
| `tower:summoned` | Torre colocada | `playerIndex`, `def`, `instanceId`, `cardId`, `card` |
| `tower:destroyed` | Torre destruída ou substituída | `playerIndex`, `def`, `instanceId`, `cardId`, `card` |
| `biome:played` | Bioma entra | `playerIndex`, `instanceId`, `cardId`, `card`, `replaced` |
| `biome:left` | Bioma sai porque outro entra | `playerIndex`, `instanceId`, `cardId`, `card` |
| `monster:fused` | Fusão do Dragão Brasa | `playerIndex`, `zoneIndex`, `position`, `instanceId`, `cardId`, `card`, `materials`, `materialInstanceIds` |
| `materials:released` | Materiais soltos quando o monstro fundido sai | `playerIndex`, `zoneIndex`, `instanceId`, `cardId`, `cards`, `materialInstanceIds` |
| `game:over` | Derrota por compra ou por HP | `winner`, `reason` (`deck_out` ou `player_hp`) |

`kind` de `effect:activated`: `onSummon` (efeito ao entrar), `activate` (uma vez por turno) ou `aura` (aura ou bônus contínuo de Torre, inclusive `towerDef`).

`target` de `attack:declared` é `{ kind: "monster", zoneIndex }`, `{ kind: "tower" }` ou `{ kind: "player" }`. No alvo jogador, `targetInstanceId` e `targetCardId` são `null`. No dano ao jogador, `zoneIndex`, `instanceId` e `cardId` são `null`.

## O que ainda não é emitido

`spelltrap:activated` está tipado para a UI. O motor só coloca a carta no slot e emite `spelltrap:set`. Não há ativação de magia ou armadilha, então esse evento não sai.

## Ordem

- Invocação: `card:sent` dos tributos (Limbo), `monster:summoned`, `effect:activated` `onSummon`, `effect:activated` `aura`, `damage:dealt` do efeito, `game:over` se o HP chegou a zero.
- Posição: só `monster:position`.
- Magia ou armadilha: só `spelltrap:set`.
- Ativar 1x por turno: só `effect:activated` com `kind: "activate"`.
- Ataque: `attack:declared`, dano no alvo (monstro ou Torre), dano de efeito de batalha e dano no jogador, `monster:destroyed` (defensor, depois atacante), `card:sent` da carta destruída, `materials:released` e `card:sent` dos materiais, `tower:destroyed` e `card:sent` da Torre, `game:over`.
- Torre: se substitui outra, `tower:destroyed` e `card:sent`; depois `tower:summoned` e `effect:activated` `aura`.
- Bioma: se substitui outro, `biome:left` e `card:sent`; depois `biome:played`.
- Fusão do Dragão Brasa: `monster:summoned`, depois `monster:fused`. Os Filhotes não são destruídos nem enviados. Quando o Dragão sai: `monster:destroyed`, `card:sent` do Dragão ao Limbo, `materials:released`, `card:sent` de cada material.
- Fase: `phase:changed`, `card:sent` do descarte de mão ao Limbo, `turn:started`, `card:drawn`, `game:over` por deck vazio.

Tributo não emite `monster:destroyed`. Monstro comum destruído em batalha vai ao cemitério; mestiço, Dragão Brasa e tributo vão ao Limbo.
