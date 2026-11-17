# Prompt — Partida online

Cole este texto inteiro no Cursor depois que o combate (03) e o servidor (04) estiverem na branch base. Se ainda não foram mergeados, empilhe nesta branch e declare a base no PR.

```
Implemente a partida online autoritativa do TCG Convergência. IP própria. Não quebre testes do motor nem do servidor. O motor continua sem dependência de runtime. CI do GitHub bloqueado por cobrança não conta como falha se os testes locais passarem.

Branch: cursor/online-0328, a partir da branch que já tem combate + servidor. PR para essa branch (ou main, se já mergeou). Diga a base.
Commit: feat: salas online autoritativas.

Contexto:
- GameMatch em src/domain/gameMatch.ts. dispatch(action) usa applyAction. getState() é a verdade. Ações: advancePhase, summonMonster, setSpellTrap, summonTower, playBiome e, após o combate, attack. Eventos no EventBus.
- createInitialState(config, playerIds, decks, rng) embaralha e compra a mão. resolveConfig(mode) em src/domain/config.ts. buildDeck(registry, cardIds) em src/catalog.
- Servidor Fastify em server/ com JWT, User e PlayerProfile. App Vite em app/ com VITE_API_URL, Login e menu. "Online (em breve)" está desabilitado: passe a habilitá-lo para usuário logado.
- TypeScript strict, switch com never, imports no topo.

Protocolo WebSocket no mesmo processo do Fastify (@fastify/websocket; não adicione Socket.IO se o plugin oficial bastar). Rota GET /ws?token=<accessToken>. Feche a conexão se o token for inválido.

Salas em memória (interface RoomStore para trocar por Redis depois, implementação MemoryRoomStore):
- Código de 6 caracteres, alfabeto sem ambíguos (sem 0/O e 1/I), único.
- Estados: lobby | playing | finished.
- No máximo 2 jogadores autenticados. O criador é o jogador 0.
- Cada jogador escolhe um deck: { mode: "classic" | "blitz", cardIds: string[] }. Valide o tamanho com MODE_CONFIGS[mode].mainDeckMin/Max e resolva as cartas com o último catálogo publicado (CatalogVersion). Id desconhecido rejeita a escolha.
- start só se os dois tiverem deck e só o criador pode pedir. Cria GameMatch com resolveConfig(mode do criador; se os modos divergirem, rejeite o start), decks construídos e seed aleatória guardada na sala.

Servidor autoritativo:
- Cliente envia {type:"action", action} no formato Action do motor.
- O servidor só aplica se o userId for o activePlayerIndex da vez. Usa applyAction / match.dispatch. Se ok:false, devolve {type:"error", message} só a quem enviou.
- Depois de cada ação válida, manda {type:"state", state, you} aos dois. state é o BoardState sem a mão e sem o deck do oponente: para o outro jogador, hand e deck viram arrays vazios (não revele o tamanho do deck além do que já for inevitável — pode mandar deck: [] e um deckCount numérico). A própria mão e o próprio deck vão completos em you: 0 | 1.
- Não confie em estado mandado pelo cliente.

Reconexão: o mesmo userId que caiu pode entrar de novo na sala com {type:"rejoin", code} e recebe o state filtrado atual. Se a sala finished, manda o resultado e não aceita ação.

Resultado: quando winner !== null, grave no PlayerProfile de cada um (wins/losses/matchesPlayed) usando a mesma forma do JSON do motor. Uma vez só, mesmo se os dois reconectarem.

Mensagens cliente → servidor: create, join {code}, chooseDeck {cardIds, mode}, start, action {action}, rejoin {code}.
Servidor → cliente: room {code, seats}, state, error {message}, finished {winner, you}.

App:
- Menu Online habilitado só com sessão. Tela para criar sala (mostra o código) e entrar com código.
- Lista simples da mão e botões para as ações legais devolvidas pelo servidor (não recalcule a regra no cliente como autoridade; pode usar getLegalActions só para rotular, mas o estado exibido é o do servidor).
- Mostre de quem é a vez e o HP.

Testes em server, sem porta fixa, dois clientes WebSocket simulados (o inject do fastify ou ws contra o servidor de teste):
- criar e entrar com código;
- jogador que não está na sala não age;
- ação ilegal não muda o estado e não vaza a mão do oponente no payload do outro;
- os dois recebem state após uma advancePhase ou summon válido;
- reconexão devolve o mesmo turn/phase;
- ao forçar winner no estado (ou jogar até deck out / HP 0 com decks minúsculos de teste), stats de vitória e derrota sobem uma vez.

Critério: npm test e typecheck da raiz e do server passam. Não implemente o bot nesta etapa.
```
