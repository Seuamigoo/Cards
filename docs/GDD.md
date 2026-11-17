# GDD v0.2 - Projeto Convergência (TCG)

Status: v0.2 (17 nov 2026). Vitória, bloqueio, tributo por nível, Torre com DEF e saída do Ladino aprovados pelo Rick em 17 nov. Itens marcados **[OK Rick?]** ainda aguardam confirmação. Todos os números ficam no arquivo de regras do motor.

Mudanças desde a v0.1: Torre virou carta invocável com DEF impressa (não tem HP; só o jogador tem HP) e deixou de ser condição de vitória; Bioma é 1 por jogador; a classe "Ladino" saiu; entram as regras de combate, invocação, Linhagem, raridade, face da carta e o primeiro set.

---

## 1. Modos

| | Clássico | Blitz |
|---|---|---|
| HP do jogador | 8000 | 4000 |
| Zonas de monstro | 6 | 3 |
| Zonas de magia/armadilha | 6 | 3 |
| Zona de Torre / Bioma | 1 / 1 por jogador | 1 / 1 por jogador |
| Deck principal | 40 a 60 | 20 a 30 |
| Deck de Linhagem | até 15 | até 5 |
| Mão inicial | 5 | 4 |
| Limite de mão (End Phase) | 7 | 6 |
| DEF da Torre | valor impresso | valor impresso |

Limite de mão: no End Phase, quem passar do limite descarta até ficar nele (as descartadas vão pro Limbo).

## 2. Montagem de deck
- Até 3 cópias de cada carta. Lendária e Mítica: 1 cópia.
- Torre e Bioma contam no deck principal.
- Deck de Linhagem só aceita Mestiços.

## 3. Início e vitória
- Sorteio de quem começa. Cada jogador compra a mão inicial.
- **Turno 1:** o primeiro jogador não compra na Draw Phase e pula a Battle Phase.
- **Vitória:** vence quem zerar o HP do adversário. Também perde quem precisar comprar com o deck vazio. Destruir a Torre não vence o duelo, só tira os bônus do oponente. Só o jogador tem HP.

## 4. Fases
Draw → Main 1 → Battle → Main 2 → End.
- Draw: compra 1 (exceto turno 1 do primeiro jogador). Efeitos de início de turno.
- Main: invocar, mudar posição, ativar magias, setar armadilhas, invocar Torre, Convergência.
- Battle: declara ataque → janela de armadilhas do defensor → escolhe alvo válido → dano.
- End: custos de Torre, limite de mão, efeitos "até o fim do turno" acabam.

## 5. Invocação
- Monstros têm **Nível 1 a 8** (número pequeno ao lado do nome, não no topo da carta).
  - Nível 1-4: sem tributo.
  - Nível 5-6: 1 tributo (manda 1 monstro seu do campo pro Limbo).
  - Nível 7-8: 2 tributos.
- **1 invocação normal por turno** (com ou sem tributo).
- O monstro entra virado pra cima, em Ataque ou Defesa, à escolha do jogador. Não existe monstro virado pra baixo na v0.2.
- Invocações especiais (efeitos, Convergência, Torre Necrópole) não gastam a invocação normal.
- Mudar posição: 1 vez por turno por monstro, nunca no turno em que ele entrou nem depois de atacar.

## 6. Combate
- Cada monstro em Ataque pode atacar 1 vez por turno. Monstro em Defesa não ataca.
- **Enjoo de invocação:** monstro não ataca no turno em que entrou, exceto com a palavra-chave Ímpeto.
- **Bloqueio:** se o defensor tiver pelo menos 1 monstro no campo (em qualquer posição), o atacante só pode mirar monstros. Sem monstros, pode mirar a Torre (se houver) ou o jogador.
  - Exceções só por efeito impresso (ex.: Arqueiro Espectral, Aríete de Cerco).
- **ATK x ATK:** o menor é destruído e o controlador dele perde a diferença em HP. Empate: os dois são destruídos, sem dano.
- **ATK x DEF:** ATK maior destrói o defensor, sem dano ao jogador. ATK menor: o atacante não é destruído e seu controlador perde a diferença. Empate: nada acontece.
- **Ataque à Torre:** compara ATK com a DEF da Torre. ATK maior: a Torre é destruída e vai pro Limbo, sem dano ao jogador. ATK menor: a Torre fica e o controlador do atacante perde a diferença. Empate: nada acontece.
- **Ataque direto:** o jogador perde HP igual ao ATK.

### Palavras-chave
- **Ímpeto:** pode atacar no turno em que entrou.
- **Provocar:** enquanto este monstro estiver em Defesa, ataques a monstros do seu lado têm que mirar ele.
- **Perfurar:** ao destruir um monstro em Defesa, o oponente perde a diferença entre ATK e DEF.

## 7. Torre
- Carta do deck principal, com **DEF impressa**. A Torre não tem HP: quem tem HP é só o jogador. A DEF é a mesma no Clássico e no Blitz.
- Invocada na Main Phase, no máximo 1 por turno, sem gastar a invocação normal.
- Só existe 1 Torre por jogador. Invocar outra manda a atual pro Limbo.
- Sem Torre em campo, não há bônus racial de Torre.
- Não é afetada por efeitos genéricos de "destrua 1 carta". Só cai por ataque que supere a DEF dela ou por efeito que cite Torre.
- Destruída, vai pro Limbo e pode ser substituída depois.
- A Torre não ataca.

## 8. Bioma
- Magia de campo, 1 por jogador, na zona própria. Cada Bioma afeta o campo inteiro (os dois lados).
- Os dois Biomas podem estar ativos juntos e os efeitos somam.
- Invocar outro Bioma manda o seu atual pro Limbo.

## 9. Raças × Classes (tags)
- Todo monstro tem 1 Raça e 1 Classe. Mestiço tem 2 Raças e 1 Classe.
- Raças: Humanos, Elfos, Anões, Anjos, Demônios, Dragões, Mortos-Vivos, Autômatos, Bestas, Elementais, Abissais, Enxame.
- Classes (5, **Ladino sai**): Guerreiro, Mago, Arqueiro, Assassino, Clérigo. O exemplo "Ladino Abissal" vira "Assassino Abissal".
- A classe não dá regra fixa; ela orienta os efeitos impressos:
  - Guerreiro: stats altos, Provocar.
  - Mago: compra, magias, redução de ATK.
  - Arqueiro: dano à Torre e alcance.
  - Assassino: Ímpeto, dano direto.
  - Clérigo: cura do jogador e reforço de DEF da Torre.
- Tags no motor, ex.: `["HUMAN","WARRIOR"]`, `["UNDEAD","DEMON","ASSASSIN"]`.

## 10. Linhagem (Mestiços) [OK Rick?]
- **Convergência:** na Main Phase, mande pro Limbo 2 monstros seus do campo, um de cada Raça matriz (classe livre), e invoque o Mestiço do Deck de Linhagem.
- 1 Convergência por turno. Não gasta a invocação normal.
- Torre Híbrida (Agulha da Convergência): permite que 1 dos materiais venha da mão.
- O Mestiço tem enjoo de invocação como qualquer monstro, salvo Ímpeto.
- Um Mestiço destruído vai pro Limbo, não volta pro Deck de Linhagem.

## 11. Raridade e face da carta
- Raridade é só de coleção, sem efeito no jogo: Comum (cinza), Incomum (verde), Rara (azul), Épica (roxo), Lendária (dourado), Mítica (vermelho perolado com toque de roxo).
- Gema da raridade no canto superior, sem número. Nível pequeno ao lado do nome.
- Rodapé: monstro mostra `ATK:` e `DEF:`; Torre mostra `DEF:`; magia, armadilha e Bioma não têm bloco de stats.
- Layout do tabuleiro (Torre numa lateral, Bioma na oposta, zonas do mesmo tamanho) é apresentação e fica com a UI.

## 12. Curva de balance (referência)
| Nível | ATK típico | Teto de ATK |
|---|---|---|
| 1-2 | 500-1000 | 1200 |
| 3-4 | 1000-1600 | 1800 |
| 5-6 | 1800-2300 | 2500 |
| 7-8 | 2500-2800 | 3000 |
Efeito forte reduz o stat em ~300-500. ATK + DEF de um Comum Nível 3-4 sem efeito fica perto de 2400-2800.

---

## 13. Primeiro set: "Despertar" (32 cartas, IP próprio)

### Torres
| Nome | Raridade | DEF | Efeito |
|---|---|---|---|
| Cidadela do Rei | Rara | 2200 | Humanos que você controla ganham +200 ATK/DEF por cada Humano no seu campo (máx. +800). |
| Necrópole Silente | Rara | 2000 | 1x por turno, na sua Main: invoque do seu Limbo 1 Morto-Vivo Nível 2 ou menor em Defesa. Ele não pode atacar neste turno. |

### Biomas
| Nome | Raridade | Efeito |
|---|---|---|
| Planície Dourada | Incomum | Todos os Humanos ganham +200 DEF. |
| Pântano das Lápides | Incomum | Todos os Mortos-Vivos ganham +200 ATK. Todos os Anjos perdem 200 ATK. |

### Monstros
| Nome | Nv | Raça / Classe | Raridade | ATK / DEF | Efeito |
|---|---|---|---|---|---|
| Recruta da Muralha | 2 | Humano / Guerreiro | Comum | 1000 / 1200 | — |
| Arqueira da Torre Norte | 3 | Humano / Arqueiro | Comum | 1200 / 800 | Ao ser invocada: a Torre inimiga perde 400 DEF até o fim do turno. |
| Escudeiro Juramentado | 3 | Humano / Guerreiro | Comum | 800 / 1600 | Provocar. |
| Lâmina Sem Brasão | 3 | Humano / Assassino | Incomum | 1300 / 600 | Ímpeto. |
| Clériga da Aurora | 4 | Humano / Clérigo | Incomum | 1000 / 1400 | 1x por turno, na sua Main: você recupera 500 HP. |
| Mago da Corte | 4 | Humano / Mago | Incomum | 1400 / 1000 | Ao ser invocado: se você controla uma Torre, compre 1 carta. |
| Capitã Lyra Valmont | 4 | Humano / Guerreiro | Rara | 1700 / 1000 | Os outros Humanos que você controla ganham +100 ATK. |
| Paladino do Estandarte | 6 | Humano / Guerreiro | Épica | 2300 / 2000 | Enquanto estiver em campo, sua Torre ganha +500 DEF. |
| Rei Aldren, o Último Bastião | 8 | Humano / Guerreiro | Lendária | 2600 / 2600 | Ganha +200 ATK por cada outro Humano que você controla. Provocar. |
| Filhote de Brasa | 3 | Dragão / Guerreiro | Comum | 1100 / 900 | Quando é destruído em batalha: o jogador oponente perde 300 HP. |
| Serpe das Cinzas | 5 | Dragão / Mago | Rara | 2000 / 1500 | Ao ser invocada: 1 monstro inimigo perde 500 ATK até o fim do turno. |
| Esqueleto Guardião | 2 | Morto-Vivo / Guerreiro | Comum | 800 / 1400 | — |
| Carniçal Faminto | 3 | Morto-Vivo / Assassino | Comum | 1300 / 700 | Ímpeto. |
| Acólita do Ossário | 3 | Morto-Vivo / Clérigo | Incomum | 700 / 1200 | 1x por turno, na sua Main: mande 1 carta da mão pro Limbo e compre 1. |
| Arqueiro Espectral | 4 | Morto-Vivo / Arqueiro | Incomum | 1500 / 900 | Pode atacar a Torre inimiga mesmo havendo monstros inimigos. |
| Necromante Velka | 4 | Morto-Vivo / Mago | Rara | 1400 / 1100 | 1x por turno, na sua Main: invoque do seu Limbo 1 Morto-Vivo Nível 2 ou menor em Defesa. |
| Cavaleiro Sem Túmulo | 6 | Morto-Vivo / Guerreiro | Épica | 2200 / 1800 | Quando vai pro Limbo: invoque do seu Limbo 1 Morto-Vivo Nível 4 ou menor. |
| Rainha Ossuária Mórgala | 8 | Morto-Vivo / Mago | Lendária | 2700 / 2400 | Enquanto estiver em campo, os monstros inimigos perdem 400 ATK. |
| Diabrete Zombeteiro | 2 | Demônio / Assassino | Comum | 900 / 500 | Ao ser invocado: o jogador oponente perde 200 HP. |
| Algoz do Abismo | 5 | Demônio / Guerreiro | Rara | 2100 / 1300 | 1x por turno: pague 500 HP para ganhar +500 ATK até o fim do turno. |

### Mestiços (Deck de Linhagem)
| Nome | Matrizes | Classe | Raridade | ATK / DEF | Efeito |
|---|---|---|---|---|---|
| Draconato Kaelthar | Humano + Dragão | Guerreiro | Épica | 2400 / 2000 | Os Humanos que você controla ganham +200 ATK. Perfurar. |
| Ceifador Carmesim | Morto-Vivo + Demônio | Assassino | Épica | 2300 / 1500 | Ímpeto. Quando destrói um monstro em batalha: o jogador oponente perde 300 HP. |

### Magias
| Nome | Raridade | Efeito |
|---|---|---|
| Poção de Campanha | Comum | Você recupera 1000 HP. |
| Reforço de Muralha | Comum | Sua Torre ganha +800 DEF até o fim do próximo turno do oponente. |
| Lâmina Afiada | Comum | Equipamento: o monstro equipado ganha +400 ATK. |
| Estratagema | Incomum | Compre 2 cartas e depois mande 1 da mão pro Limbo. |
| Aríete de Cerco | Incomum | Equipamento: 1x por turno, o monstro equipado pode atacar a Torre inimiga mesmo havendo monstros inimigos. |
| Chamado do Limbo | Rara | Invoque do seu Limbo 1 monstro Nível 4 ou menor. |

### Armadilhas (setadas; só ativam a partir do turno seguinte do oponente)
| Nome | Raridade | Gatilho e efeito |
|---|---|---|
| Muralha de Escudos | Comum | Quando um monstro inimigo declara ataque: o monstro atacado ganha +800 DEF até o fim do turno. |
| Fosso de Estacas | Incomum | Quando um monstro inimigo com 1500 ATK ou menos declara ataque: destrua esse monstro. |
| Contra-Ataque | Rara | Quando um monstro inimigo ataca sua Torre ou você diretamente: anule o ataque e o jogador oponente perde HP igual à metade do ATK do atacante. |

## 14. Decks iniciais (modo contra bot)

### Deck A — "Vanguarda do Reino" (Humanos + Dragões)
| Carta | Clássico (40) | Blitz (20) |
|---|---|---|
| Cidadela do Rei | 3 | 2 |
| Planície Dourada | 2 | 1 |
| Recruta da Muralha | 3 | 2 |
| Arqueira da Torre Norte | 3 | 2 |
| Escudeiro Juramentado | 3 | 2 |
| Lâmina Sem Brasão | 2 | 1 |
| Clériga da Aurora | 2 | 1 |
| Mago da Corte | 2 | 1 |
| Capitã Lyra Valmont | 2 | 1 |
| Paladino do Estandarte | 2 | 1 |
| Rei Aldren, o Último Bastião | 1 | 0 |
| Filhote de Brasa | 3 | 2 |
| Serpe das Cinzas | 2 | 1 |
| Poção de Campanha | 1 | 0 |
| Reforço de Muralha | 2 | 1 |
| Lâmina Afiada | 2 | 1 |
| Estratagema | 1 | 0 |
| Aríete de Cerco | 1 | 0 |
| Fosso de Estacas | 1 | 0 |
| Muralha de Escudos | 2 | 1 |
| **Total** | **40** | **20** |
Linhagem: Draconato Kaelthar x2 (Blitz x1).
Plano: encher o campo de Humanos baratos, crescer com a Cidadela e a Capitã, fechar com Paladino/Rei.

### Deck B — "Marcha da Necrópole" (Mortos-Vivos + Demônios)
| Carta | Clássico (40) | Blitz (20) |
|---|---|---|
| Necrópole Silente | 3 | 2 |
| Pântano das Lápides | 2 | 1 |
| Esqueleto Guardião | 3 | 2 |
| Carniçal Faminto | 3 | 2 |
| Acólita do Ossário | 2 | 1 |
| Arqueiro Espectral | 3 | 2 |
| Necromante Velka | 2 | 1 |
| Cavaleiro Sem Túmulo | 2 | 1 |
| Rainha Ossuária Mórgala | 1 | 0 |
| Diabrete Zombeteiro | 3 | 2 |
| Algoz do Abismo | 2 | 1 |
| Poção de Campanha | 1 | 0 |
| Reforço de Muralha | 1 | 0 |
| Lâmina Afiada | 2 | 0 |
| Estratagema | 2 | 1 |
| Chamado do Limbo | 2 | 1 |
| Fosso de Estacas | 2 | 1 |
| Contra-Ataque | 2 | 1 |
| Muralha de Escudos | 2 | 1 |
| **Total** | **40** | **20** |
Linhagem: Ceifador Carmesim x2 (Blitz x1).
Plano: trocar monstros fracos sem medo, reciclar pelo Limbo, pressionar a Torre com o Arqueiro Espectral e fechar com Ceifador/Rainha.

## 15. Critérios de aceite para o motor
1. Com monstro inimigo em campo, os alvos válidos são só monstros, salvo efeito impresso.
2. ATK x ATK, ATK x DEF e empates seguem a seção 6, inclusive o dano ao controlador.
3. Monstro sem Ímpeto não ataca no turno em que entrou; monstro em Defesa não ataca.
4. Nível 5-6 exige 1 tributo, 7-8 exige 2; só 1 invocação normal por turno.
5. Torre: 1 por turno, não gasta invocação normal, DEF impressa (igual nos dois modos), sem HP; ATK maior que a DEF destrói e manda pro Limbo; pode ser substituída.
6. Convergência exige um monstro de cada Raça matriz no campo (ou 1 da mão com Agulha da Convergência), 1 por turno.
7. O primeiro jogador não compra e não batalha no turno 1.
8. Perde quem zera o HP ou quem precisa comprar com deck vazio.
9. Os dois decks iniciais montam com exatamente 40 (Clássico) e 20 (Blitz) cartas e respeitam o limite de cópias.

## Ainda em aberto (v0.3)
- Torres das outras raças (Demoníaca, Élfica, Anã, Dracônica, Híbrida) com DEF e custo de sangue em números.
- Biomas Caldeira Rubra (vulcão), Pico Gélido (montanha gelada) e Jardim de Pétalas (jardim de flores).
- Regras de corrente de resposta (armadilha respondendo a armadilha).
