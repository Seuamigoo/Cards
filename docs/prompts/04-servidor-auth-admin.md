# Prompt — Servidor, login, admin e catálogo

Cole este texto inteiro no Cursor depois que o combate (03) estiver em `main`. Se o PR de combate ainda não foi mergeado, crie a branch a partir da branch de combate e avise no PR.

```
Implemente o servidor do TCG Convergência e as telas mínimas de login, cadastro e admin no app. IP própria. O motor (src/domain, src/catalog, src/persistence, src/ai se já existir) continua com zero dependência de runtime. Dependências novas ficam só em server/. Não quebre npm test nem npm run typecheck da raiz.

Branch: cursor/servidor-auth-admin-0328. PR para main, ou para a branch de combate se ela ainda não entrou em main. Diga a base no PR.
Commit: feat: servidor com auth, admin e publicação de catálogo.

Contexto já presente:
- CardRegistry.fromJSON(json) em src/catalog/registry.ts valida o catálogo e devolve {ok:true, registry} ou {ok:false, errors}. Card tem id, name, rarity (comum|incomum|rara|epica|lendaria|mitica), kind monster|spell|trap|tower|biome, image opcional {src, alt}. Monstro tem atk e def inteiros >= 0. Torre pode ter hp. Imagem válida: caminho relativo .png/.jpg/.jpeg/.webp ou URL https (src/catalog/image.ts).
- CatalogCache em src/catalog/cache.ts: construtor (adapter, fetchCatalog, url). sync() baixa o JSON, compara version com isNewer e só grava se for mais novo. Fetch é injetável. Não use fetch global dentro de src/catalog.
- PlayerProfile em src/persistence/profile.ts: version, playerId, name, collection, decks, stats {wins, losses, matchesPlayed}, updatedAt. ProfileRepository é local (StorageAdapter). O servidor passa a ser a fonte do perfil autenticado; não apague o repositório local.
- App Vite em app/ (workspace convergencia-app). Tela inicial "Convergência", botões "Jogar contra bot (em breve)" e "Online (em breve)" desabilitados, Coleção lista o catálogo embutido em catalog/cards.json. VITE já usa base "./".
- Raiz: npm test (vitest), npm run typecheck (tsc da raiz e do app), npm run build:app. TypeScript strict. Switch com never. Imports no topo.
- CI do GitHub pode falhar só por cobrança da conta. Valide localmente.

Crie server/ como workspace npm separado (adicione "server" em workspaces da raiz, ou mantenha o package.json dele instalável com npm ci dentro de server/ — prefira workspace para um npm install na raiz). Dependências só de server: fastify, @fastify/multipart, @fastify/static, @fastify/cookie, @fastify/rate-limit, prisma, @prisma/client, zod, argon2 (bcrypt se argon2 não instalar), jsonwebtoken e os @types necessários. Scripts: dev, build, test, typecheck, prisma:migrate, seed.

Prisma + SQLite em dev (file:./dev.db). DATABASE_URL no ambiente, fácil de trocar por Postgres sem mudar o schema além do provider. Modelos:
- User: id, email único, username único, passwordHash, role "player" | "admin", createdAt.
- CardRecord: id, name, rarity, kind, atk Int?, def Int?, hp Int?, race String?, class String?, imagePath String?, status "draft" | "published", createdAt, updatedAt. Campos espelham CardDefinition.
- CatalogVersion: id, version Int único, publishedAt, json String (o documento que CardRegistry.fromJSON aceita).
- PlayerProfile: userId único, json String (o PlayerProfile do motor), updatedAt.

Auth:
- POST /auth/register {email, username, password} cria role player. Senha com argon2 (ou bcrypt). Resposta sem hash.
- POST /auth/login {email, password} devolve access token JWT curto (15 min) e seta refresh token httpOnly, Secure em produção, SameSite=Lax, path /auth.
- POST /auth/refresh gira o refresh token.
- POST /auth/logout revoga o refresh token.
- Rate limit só no login (ex.: 10 req/min por IP).
- Validação zod em todo body. Erros 400 com mensagem estável, sem vazar se o email existe no login (401 genérico).
- Rotas autenticadas leem Authorization: Bearer.

Admin inicial: server/src/seed.ts lê ADMIN_EMAIL e ADMIN_PASSWORD do ambiente. Se o email não existe, cria role admin. Nunca grave senha no código. server/.env.example lista DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PORT. .env no .gitignore. O exemplo não tem segredo real.

Admin (403 se não for admin):
- GET/POST /admin/cards e GET/PATCH/DELETE /admin/cards/:id. CRUD de rascunho. DELETE só rascunho.
- POST /admin/cards/:id/image multipart, campo "image". Só png, jpg, jpeg, webp. Máximo 2 MB. Salva em server/uploads/<id>.<ext> e grava imagePath. Interface ImageStorage { save, publicPath } com implementação local; comentário de que S3 entra depois sem mudar a rota.
- GET /uploads/* estático.
- POST /admin/catalog/publish: pega cartas published, monta o JSON do catálogo (version = última + 1, publishedAt ISO), valida com CardRegistry.fromJSON. Se inválido, 422 com os erros do registry e não grava. Se válido, cria CatalogVersion.

Público, sem auth:
- GET /catalog/latest → { version } da última CatalogVersion, ou 404.
- GET /catalog/:version → o JSON armazenado, 404 se não existe.

Perfil autenticado:
- GET /me/profile devolve o JSON do PlayerProfile ou um perfil vazio no formato do motor (version 1, playerId = user id, name = username, collection [], decks [], stats zeradas).
- PUT /me/profile substitui o JSON depois de validar o formato (version, stats numéricas >= 0, arrays). Não confie no playerId do body: force o id do usuário logado.

App (app/src, sem framework novo):
- Telas Login e Cadastro. Guarda o access token em memória (variável do módulo), não em localStorage.
- Menu ganha Entrar e Cadastrar. Admin só aparece se /me (ou o claim role do JWT decodificado no cliente, sem verificar assinatura para esconder botão; o servidor continua sendo a autoridade) disser role admin.
- Admin: lista de cartas, formulário criar/editar com prévia (nome, raridade, ATK/DEF ou traço, imagem), upload, botão Publicar atualização.
- Ao abrir, CatalogCache consulta ${VITE_API_URL}/catalog/latest. Se a version for maior que a do catálogo em memória/cache, baixa /catalog/:version. Se a rede falhar, segue com o último catálogo (o JSON embutido na primeira execução). VITE_API_URL default http://127.0.0.1:3001. Documente em app/.env.example.

Testes do servidor (vitest + o app Fastify injetado, sem subir porta): banco SQLite temporário por arquivo ou prisma db push num DATABASE_URL de teste. Cubra:
- cadastro e login felizes; login com senha errada 401;
- rota admin com jogador comum 403 e com admin 200;
- upload de gif ou arquivo > 2 MB rejeitado;
- publish com carta published inválida 422; publish válido aumenta a version e GET /catalog/latest reflete.

README da raiz: seção "Servidor" com npm install, copiar server/.env.example para server/.env, npx prisma migrate dev (rode a partir de server/), npm run seed -w <nome>, npm run dev -w <nome>, e o app com VITE_API_URL.

Critério: na raiz, npm test e npm run typecheck passam; no server, npm test e npm run typecheck passam. Não implemente WebSocket nem bot nesta etapa.
```
