# Como usar o Supabase como banco de dados em tempo real

Este é o passo a passo para ativar o **Supabase** como alternativa ao
Firebase. O resultado final é o mesmo: todo mundo (fiscal, líder,
administrador) vê os dados atualizarem na hora, em qualquer aparelho.

O código já está pronto em `js/supabase-config.js` — você só precisa criar
as tabelas no Supabase e colar duas informações no arquivo.

---

## Passo 1 — Criar o projeto no Supabase

1. Acesse **https://supabase.com** e clique em **"Start your project"**.
2. Faça login com GitHub ou e-mail (é grátis, não pede cartão).
3. Clique em **"New project"**:
   - **Name**: `inspecampo-equatorial` (ou o nome que preferir)
   - **Database Password**: crie uma senha forte e **guarde ela** (não é a
     senha que os usuários do app vão usar — é só do banco)
   - **Region**: escolha **"South America (São Paulo)"** para ficar perto
     do Brasil
4. Clique em **"Create new project"** e aguarde 1–2 minutos enquanto o
   Supabase prepara tudo.

---

## Passo 2 — Criar as 5 tabelas

1. No menu à esquerda do painel do projeto, clique em **"SQL Editor"**.
2. Clique em **"New query"**.
3. Cole o código abaixo e clique em **"Run"**:

```sql
-- Tabela de usuários (Administrador, Líderes e Fiscais)
create table fiscais (
  id text primary key,
  data jsonb not null
);

-- Tabela de equipes cadastradas
create table cadastros (
  id text primary key,
  data jsonb not null
);

-- Tabela de inspeções (checklists de EPI/EPC)
create table inspecoes (
  id text primary key,
  data jsonb not null
);

-- Tabela de produção (bases de atendimentos importadas na página "Produção")
create table producao (
  id text primary key,
  data jsonb not null
);

-- Tabela de Ordens de Inspeção de Ativo (líder envia -> fiscal preenche -> líder revisa)
create table ordens (
  id text primary key,
  data jsonb not null
);
```

Cada tabela tem só duas colunas: um `id` (texto) e um `data` (jsonb, que
guarda o objeto inteiro do cadastro/inspeção/usuário/registro de produção/
ordem de inspeção). Isso mantém o banco simples e evita ter que alterar o
SQL toda vez que um campo novo é adicionado a algum formulário do app.

---

## Passo 3 — Ativar o Realtime nas 5 tabelas

1. No menu à esquerda, clique em **"Database"** → **"Replication"**.
2. Em **"Source"**, clique para expandir a lista de tabelas.
3. Ative (toggle ON) as 5 tabelas: `fiscais`, `cadastros`, `inspecoes`, `producao`, `ordens`.

Isso é o que permite que o navegador de uma pessoa "escute" mudanças
feitas por outra pessoa, em tempo real.

---

## Passo 4 — Liberar acesso de leitura/escrita (RLS)

Por padrão, o Supabase bloqueia todo acesso às tabelas até você criar uma
política. Como este app não usa o sistema de login do Supabase (a
autenticação é feita manualmente, por matrícula/senha, dentro do próprio
app), vamos liberar o acesso público às 3 tabelas.

Volte ao **"SQL Editor"** → **"New query"** e rode:

```sql
alter table fiscais enable row level security;
alter table cadastros enable row level security;
alter table inspecoes enable row level security;
alter table producao enable row level security;
alter table ordens enable row level security;

create policy "Acesso público - fiscais" on fiscais
  for all using (true) with check (true);

create policy "Acesso público - cadastros" on cadastros
  for all using (true) with check (true);

create policy "Acesso público - inspecoes" on inspecoes
  for all using (true) with check (true);

create policy "Acesso público - producao" on producao
  for all using (true) with check (true);

create policy "Acesso público - ordens" on ordens
  for all using (true) with check (true);
```

> ⚠️ Assim como no Firebase, isso deixa o banco aberto para qualquer
> pessoa que souber a URL do seu projeto Supabase (não do seu site)
> ler/escrever diretamente via API. Para uso interno controlado, é
> aceitável. Para produção com dados sensíveis, o ideal é implementar o
> Supabase Auth com políticas mais restritas — posso te ajudar depois que
> o básico estiver funcionando.

---

## Passo 5 — Pegar a URL e a chave do projeto

1. No menu à esquerda, clique na engrenagem ⚙️ **"Project Settings"**.
2. Clique em **"API"**.
3. Copie os dois valores:
   - **Project URL** (algo como `https://abcxyzabc.supabase.co`)
   - **anon public** (uma chave longa, começando com `eyJ...`)

---

## Passo 6 — Colar no projeto

Abra `js/supabase-config.js` e substitua:

```js
const SUPABASE_CONFIG = {
  url: "https://SEU_PROJETO.supabase.co",
  anonKey: "SUA_ANON_KEY"
};
```

pelos valores que você copiou.

Depois, abra `js/firebase-config.js` e troque:

```js
mode: "demo",
```

por:

```js
mode: "supabase",
```

Pronto — não precisa mexer em mais nenhum arquivo.

---

## Passo 7 — Testar

1. Rode o servidor local (`python3 -m http.server 8080` dentro da pasta
   `inspecao-equatorial`) e abra `http://localhost:8080`.
2. Abra o sistema em **duas abas** (ou dois navegadores).
3. Cadastre uma equipe em uma aba — ela deve aparecer automaticamente na
   outra aba, sem precisar dar F5.
4. Se aparecer, o Supabase está funcionando. Se der erro no console do
   navegador (F12 → Console), confira se a URL/chave foram coladas
   certinho e se as tabelas/políticas do Passo 2–4 foram criadas.

---

## Passo 8 — Colocar online (hospedagem)

Com o Supabase já ativo, os dados moram na nuvem — qualquer hospedagem de
site estático serve para publicar os arquivos HTML/CSS/JS. Duas opções
rápidas, sem precisar instalar nada:

### Opção A — GitHub Pages (usa a conta GitHub que você já tem)

1. Acesse **https://github.com/new** e crie um repositório novo (ex:
   `inspecampo-equatorial`). Pode deixar como **Public**.
2. Na página do repositório recém-criado, clique em **"uploading an
   existing file"** (ou "Add file" → "Upload files").
3. Arraste **todos os arquivos e pastas de dentro de** `inspecao-equatorial`
   (o conteúdo da pasta, não a pasta em si) para a área de upload, e
   clique em **"Commit changes"**.
4. Vá em **"Settings"** (menu do repositório) → **"Pages"** (menu lateral).
5. Em **"Build and deployment"** → **"Source"**, selecione **"Deploy from
   a branch"**, branch **"main"**, pasta **"/ (root)"**, e clique em
   **"Save"**.
6. Aguarde 1–2 minutos. O GitHub mostra o link público no topo da página
   (algo como `https://SEU_USUARIO.github.io/inspecampo-equatorial/`).

Qualquer atualização futura no app: repita o upload dos arquivos alterados
no repositório (ou use `git push`, se preferir linha de comando) — o
GitHub Pages republica automaticamente em 1–2 minutos.

### Opção B — Netlify Drop (mais rápido, sem conta)

1. Acesse **https://app.netlify.com/drop**
2. Arraste a pasta `inspecao-equatorial` inteira para a página.
3. Em segundos você recebe um link público (ex:
   `https://inspecampo-123abc.netlify.app`), já funcionando para qualquer
   pessoa, em qualquer aparelho.

(Veja `DEPLOY.md` para outras opções de hospedagem, como Firebase Hosting.)

---

## Supabase vs Firebase — qual escolher?

Os dois já estão implementados no código — é só trocar uma linha
(`DB.mode`). Não precisa escolher os dois ao mesmo tempo.

| | Firebase | Supabase |
|---|---|---|
| Tipo de banco | Firestore (NoSQL) | Postgres (SQL) |
| Tempo real | `onSnapshot` | Realtime (Postgres changes) |
| Limite por documento/linha | 1MB (pode ser um problema com muitas fotos) | Sem esse limite |
| Painel de administração dos dados | Firebase Console | Supabase Table Editor (parecido com planilha) |
| Curva de aprendizado | Bem documentado, muito usado | Também bem documentado, e quem já usa SQL se sente em casa |

Se você já tem ou pretende ter familiaridade com SQL/planilhas de banco de
dados, o Supabase tende a ser mais intuitivo para consultar/exportar dados
direto pelo painel. Se preferir um ecossistema mais "tudo-em-um" do
Google, o Firebase é uma escolha sólida também. Para este app, tanto faz —
o comportamento para o usuário final é idêntico.

## Se precisar de ajuda depois

- **Quer login mais seguro (com Supabase Auth)?** dá para evoluir depois,
  mantendo a mesma estrutura de dados.
- **Quer migrar as fotos para o Supabase Storage** (em vez de guardar o
  base64 dentro do `jsonb`)? também posso ajudar a implementar — o
  Postgres não tem o limite de 1MB do Firestore, então isso é opcional,
  mas ainda assim reduz o tamanho do banco.
