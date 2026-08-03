# Estrutura do Firestore — InspeCampo

Este documento descreve a modelagem de dados pronta para o Firebase Firestore.
O app já roda hoje em **modo demo** (localStorage) usando exatamente essa
mesma estrutura, então migrar para o Firebase real é só trocar os métodos
do objeto `DB` em `js/firebase-config.js` — nenhuma outra parte do código
precisa mudar.

## Fluxo do sistema

1. O fiscal preenche o **Cadastro de Equipe** (prefixo digitado manualmente,
   município, horário de trabalho, veículo, comunicação e componentes da
   equipe).
2. Depois, em **Inspeção de Equipe**, o fiscal escolhe a equipe cadastrada
   (pelo prefixo), informa a data da inspeção e realiza os checklists de
   EPI (por eletricista) e EPC (do veículo).
3. O **líder** acompanha, no Painel do Líder, tudo o que os fiscais
   vinculados a ele cadastraram e inspecionaram.
4. O **administrador** vê tudo: Dashboard, Histórico, Galeria e Exportações.

## Coleções

### `/fiscais/{usuarioId}`
Guarda Administrador, Líderes e Fiscais (todos os perfis de usuário).

| Campo | Tipo | Descrição |
|---|---|---|
| nome | string | Nome completo |
| matricula | string | Matrícula funcional (usada no login) |
| senha | string | Senha (validação local em modo demo) |
| email | string | E-mail corporativo |
| perfil | string | `"admin"`, `"lider"` ou `"fiscal"` |
| liderId | string\|null | Para fiscais: referência ao líder responsável (`/fiscais` de perfil `lider`) |

### `/cadastros/{cadastroId}` — formulário "Cadastro de Equipe"
| Campo | Tipo | Descrição |
|---|---|---|
| fiscalId, fiscalNome | string | Quem cadastrou |
| dataHoraISO | string (ISO 8601) | Capturado automaticamente |
| gps | map `{lat, lng, precisao}` | Capturado automaticamente |
| prefixo | string | Informado manualmente pelo fiscal (ex: `APA-07`) |
| municipio | string | |
| horarioInicial, horarioFinal | string (`HH:MM`) | Horário de trabalho da equipe |
| processo | string | Comercial / Emergencial / Comercial GD / Corte-Religa |
| veiculo | map `{tipo, placa, fotos:{frente,traseira,lateral,placa}}` | Sem campo de prefixo (já está no cadastro) |
| comunicacao | map `{tipo, numeroSerie, foto}` | |
| colaboradores | array de maps `{nome, matricula, funcao}` | 2 a 3 itens |
| fotoEquipe | string | Foto obrigatória da equipe |

### `/inspecoes/{inspecaoId}` — formulário "Inspeção de Equipe"
| Campo | Tipo | Descrição |
|---|---|---|
| fiscalId, fiscalNome | string | Quem realizou a inspeção (checklist) |
| cadastroId | string | Referência à equipe cadastrada (`/cadastros`) |
| equipePrefixo, municipio, processo, veiculoTipo, veiculoPlaca, comunicacaoTipo, comunicacaoSerie | — | Cópia dos dados do cadastro no momento da inspeção |
| colaboradores | array | Copiado do cadastro, para referência |
| dataInspecao | string (`YYYY-MM-DD`) | Informada manualmente pelo fiscal |
| dataHoraISO | string (ISO 8601) | Timestamp do registro no sistema |
| epiPorColaborador | array de `{ colaborador, itens: [{nome, quantidade, validade, estado, foto}] }` | Checklist de EPI, um por eletricista |
| epc | map `{ itens: [{nome, quantidade, validade, estado, foto}] }` | Checklist de EPC, único por veículo/equipe |
| status | string | `"concluida"` |

## Migrando para o Firebase real

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com).
2. Ative **Firestore Database** (modo produção) e **Storage**.
3. Preencha `FIREBASE_CONFIG` em `js/firebase-config.js`.
4. Adicione os SDKs modulares (`firebase-app.js`, `firebase-firestore.js`,
   `firebase-storage.js`) — instruções comentadas no próprio arquivo.
5. Reimplemente os métodos `getFiscais`, `getCadastros`, `getInspecoes`,
   `saveCadastro` e `saveInspecao` do objeto `DB` para chamar
   `getDocs`/`addDoc`/`updateDoc` do Firestore, e faça o upload das fotos
   (que já chegam em base64, comprimidas) para o Storage antes de gravar a
   URL no documento.
6. Recomenda-se criar regras de segurança (`firestore.rules`) restringindo:
   - Fiscal: leitura/escrita dos próprios cadastros e inspeções.
   - Líder: leitura de tudo que pertence aos fiscais com `liderId` igual ao
     seu próprio id.
   - Admin: leitura de tudo, escrita restrita a ajustes administrativos.
