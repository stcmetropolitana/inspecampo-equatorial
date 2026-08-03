# Como colocar o InspeCampo online, com dados em tempo real

Hoje o sistema salva tudo no `localStorage` do navegador — por isso cada
pessoa só vê os próprios dados. Para todo mundo ver a mesma informação, ao
mesmo tempo, em qualquer aparelho, você precisa de duas coisas:

1. **Um banco de dados compartilhado na nuvem** → Firebase Firestore
   (já está implementado no código, só falta ativar).
2. **Um link/endereço público para acessar o site** → hospedagem (hosting).

Este guia cobre as duas etapas, do zero.

---

## Parte 1 — Ativar o banco de dados compartilhado (Firestore)

### 1.1. Criar o projeto no Firebase

1. Acesse **https://console.firebase.google.com** e faça login com uma
   conta Google.
2. Clique em **"Criar projeto"**, dê um nome (ex: `inspecampo-equatorial`)
   e siga o assistente (pode desativar o Google Analytics, não é
   necessário).

### 1.2. Ativar o Firestore Database

1. No menu à esquerda, clique em **"Firestore Database"**.
2. Clique em **"Criar banco de dados"**.
3. Escolha **modo produção**.
4. Na localização, escolha **`southamerica-east1` (São Paulo)** — deixa o
   acesso mais rápido para o Brasil.

### 1.3. Pegar as credenciais do projeto

1. Clique na engrenagem ⚙️ (canto superior esquerdo) → **"Configurações do
   projeto"**.
2. Role até **"Seus apps"** e clique no ícone **`</>`** (Web).
3. Dê um apelido ao app (ex: `inspecampo-web`) e clique em **"Registrar
   app"**. Não precisa marcar a opção de Hosting aqui.
4. O Firebase vai mostrar um bloco de código parecido com este:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "inspecampo-equatorial.firebaseapp.com",
     projectId: "inspecampo-equatorial",
     storageBucket: "inspecampo-equatorial.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abcdef"
   };
   ```
5. **Copie esses valores.**

### 1.4. Colar as credenciais no projeto

Abra `js/firebase-config.js` e substitua o objeto `FIREBASE_CONFIG` pelos
valores que você copiou:

```js
const FIREBASE_CONFIG = {
  apiKey: "AIza...",
  authDomain: "inspecampo-equatorial.firebaseapp.com",
  projectId: "inspecampo-equatorial",
  storageBucket: "inspecampo-equatorial.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

Logo abaixo, dentro do objeto `DB`, troque:

```js
mode: "demo",
```

por:

```js
mode: "firebase",
```

Pronto — o sistema inteiro passa a usar o Firestore automaticamente,
com **atualização em tempo real** entre todos os aparelhos conectados
(implementado com `onSnapshot`, que "escuta" mudanças no banco o tempo
todo). Não precisa mexer em mais nenhum arquivo.

### 1.5. Configurar as regras de segurança

Por padrão, o Firestore em "modo produção" bloqueia tudo. Como este app
não usa login do Firebase (a autenticação é feita manualmente, por
matrícula/senha, dentro do próprio app), você precisa liberar acesso de
leitura/escrita nas regras. No Firebase Console, vá em **Firestore
Database → Regras** e use:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

> ⚠️ Isso deixa o banco aberto para qualquer pessoa que souber o link do
> seu projeto Firebase (não do seu site) ler/escrever diretamente via API.
> Para um ambiente de teste ou uso interno controlado, é aceitável. Para
> produção com dados sensíveis, o ideal é implementar o Firebase
> Authentication e regras mais restritas — posso te ajudar com isso depois
> que o básico estiver funcionando.

Clique em **"Publicar"**.

### 1.6. Testar localmente antes de publicar

Depois de trocar `mode` para `"firebase"`, rode o servidor local de novo
(`python3 -m http.server 8080`) e abra o sistema em **duas abas** ou **dois
navegadores diferentes**. Cadastre uma equipe em uma aba — ela deve
aparecer automaticamente na outra, sem precisar atualizar a página. Se
isso funcionar, o banco compartilhado está ativo.

---

## Parte 2 — Colocar o site em um link público (hospedagem)

Com o Firestore já ativo, qualquer hospedagem de site estático serve —
os dados moram no Firebase, não no servidor de hospedagem. Duas opções
simples:

### Opção A — Netlify Drop (mais rápido, sem instalar nada)

1. Acesse **https://app.netlify.com/drop**
2. Arraste a pasta `inspecao-equatorial` inteira para a página.
3. Pronto — em alguns segundos você recebe um link público
   (ex: `https://inspecampo-123abc.netlify.app`), já funcionando para
   qualquer pessoa, em qualquer aparelho.
4. Para trocar o nome do link ou conectar um domínio próprio, crie uma
   conta gratuita no Netlify e ajuste nas configurações do site.

### Opção B — Firebase Hosting (fica tudo no mesmo lugar do banco)

Requer o Node.js instalado no seu computador.

```bash
# 1. Instalar a ferramenta de linha de comando do Firebase (uma vez só)
npm install -g firebase-tools

# 2. Fazer login com a mesma conta Google usada no Firebase Console
firebase login

# 3. Dentro da pasta do projeto (inspecao-equatorial), iniciar o Hosting
cd inspecao-equatorial
firebase init hosting
#   - Escolha o projeto que você criou na Parte 1
#   - Diretório público: "." (ponto, a pasta atual)
#   - Configurar como single-page app: Não
#   - Sobrescrever index.html: Não

# 4. Publicar
firebase deploy
```

Ao final, o terminal mostra o link público (algo como
`https://inspecampo-equatorial.web.app`).

---

## Resumo do que acontece depois de tudo pronto

- Qualquer fiscal, líder ou administrador acessa o **mesmo link**, de
  qualquer celular, tablet ou computador.
- Um cadastro ou inspeção salvo por um fiscal aparece **na hora** nas
  telas de outras pessoas conectadas (Dashboard, Painel do Líder, Meu
  Painel, Histórico, Galeria) — sem precisar atualizar a página.
- Os dados ficam salvos na nuvem (Firestore), não mais no navegador de
  cada um.

## Se precisar de ajuda depois

- **Erro de "documento muito grande" ao salvar um cadastro:** o Firestore
  tem limite de 1MB por documento, e como as fotos vão em base64 dentro do
  próprio cadastro, equipes com muitas fotos grandes podem esbarrar nesse
  limite. Nesse caso, o próximo passo é migrar as fotos para o **Firebase
  Storage** (upload separado, salvando só o link no documento) — me avise
  que ajudo a implementar.
- **Quer login mais seguro (com Firebase Authentication)?** também dá para
  evoluir depois, mantendo a mesma estrutura de dados.
