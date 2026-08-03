# InspeCampo — Sistema de Inspeção de Equipes de Campo

Aplicação web (HTML5 + CSS3 + JavaScript puro) para fiscalização de equipes
emergenciais e comerciais em campo, com dashboard executivo em tempo real.

## Como colocar online, com dados em tempo real para todos

Veja o guia passo a passo em **`DEPLOY.md`** (Firebase) ou **`SUPABASE.md`**
(Supabase) — os dois já estão implementados no código; escolher um é só
trocar uma linha (`DB.mode` em `js/firebase-config.js`). Cobrem desde
ativar o banco compartilhado (com atualização em tempo real) até publicar
o site com um link público (Netlify ou Firebase Hosting).

## Como abrir

Como o projeto usa arquivos separados (`css/`, `js/`), abra por um servidor
local em vez de dar duplo clique no `index.html` (evita bloqueios de CORS
do navegador com `file://`). Duas opções simples:

```bash
# Opção 1 — Python (já vem em quase todo sistema)
cd inspecao-equatorial
python3 -m http.server 8080
# depois acesse http://localhost:8080

# Opção 2 — VS Code
# Instale a extensão "Live Server" e clique em "Go Live"
```

## Como o sistema funciona (fluxo em 2 etapas)

1. **Cadastro de Equipe** — o fiscal registra a equipe em campo: prefixo
   (digitado manualmente), município, horário de trabalho, veículo,
   comunicação e os colaboradores da equipe.
2. **Inspeção de Equipe** — depois, o fiscal seleciona a equipe já
   cadastrada (pelo prefixo), informa a data da inspeção e realiza os
   checklists de **EPI** (individual, por eletricista) e **EPC** (do
   veículo, uma vez só).

Isso permite, por exemplo, cadastrar uma equipe uma vez e inspecioná-la
várias vezes ao longo do tempo (verificações periódicas de segurança).

## Perfis de usuário

- **Fiscal** — landing em "Meu Painel" (suas equipes cadastradas e suas
  inspeções realizadas), com acesso a "Cadastro de Equipe" e "Inspeção de
  Equipe". Uma equipe pode ser inspecionada mais de uma vez ao longo do
  tempo — o atalho "Inspecionar" no painel já pré-seleciona a equipe.
- **Líder** — acessa o "Painel do Líder": KPIs, sua equipe de fiscais, e
  duas listas completas (em abas) — "Equipes Cadastradas" e "Inspeções
  Realizadas" — de tudo que os fiscais vinculados a ele (`liderId`)
  fizeram, com filtro por fiscal e município.
- **Administrador** — acessa Dashboard, Histórico, Galeria, Exportações e
  o Painel do Líder (vendo todos os fiscais). Não realiza Cadastro/Inspeção
  diretamente — esse fluxo é operacional, do fiscal.

## Login de demonstração

O sistema semeia automaticamente os usuários na primeira vez que é aberto
(guardados no `localStorage` do navegador). Cada usuário tem **matrícula e
senha próprias**, definidas em `js/data.js`:

- `USUARIOS` — Administrador e Fiscais (cada fiscal com um `liderId`
  vinculando-o a um líder).
- `LIDERES` — os líderes que enxergam os fiscais vinculados a eles.

Por segurança, a tela de login **não exibe mais** as credenciais — consulte
diretamente `js/data.js` para saber matrícula/senha de cada usuário de
demonstração. Depois de logado, cada usuário pode trocar a própria senha no
ícone de chave 🔑, ao lado do botão de sair, na barra lateral.

> **Importante:** essa senha é validada só no navegador (não há backend),
> então serve para controlar acesso no dia a dia, mas não é criptografia
> de nível produção. Para uso real com múltiplos dispositivos e segurança
> de verdade, o caminho é ativar o Firebase Authentication — veja
> `firebase/firestore-schema.md`.

## Estrutura de pastas

```
inspecao-equatorial/
├── index.html
├── css/style.css
├── js/
│   ├── firebase-config.js   # config + estrutura Firestore (modo demo por padrão)
│   ├── data.js              # usuários de demonstração (admin/líder/fiscal) + checklists EPI/EPC
│   ├── utils.js             # helpers (GPS, imagens, datas, alertas)
│   ├── auth.js              # login, sessão e hierarquia líder→fiscal
│   ├── cadastro.js          # formulário "Cadastro de Equipe"
│   ├── inspection.js        # formulário "Inspeção de Equipe" (checklists EPI/EPC)
│   ├── painel-fiscal.js     # "Meu Painel" — visão do fiscal (equipes + inspeções)
│   ├── lider.js             # Painel do Líder
│   ├── dashboard.js         # dashboard executivo (Chart.js + Leaflet)
│   ├── history.js           # histórico e busca de inspeções
│   ├── gallery.js           # galeria de fotos
│   ├── export.js            # exportação PDF/Excel
│   └── app.js                # roteamento e bootstrap
├── firebase/firestore-schema.md   # modelagem de dados e guia de migração
├── img/       # reservado para ícones/imagens estáticas do projeto
├── pages/     # reservado para futuras páginas isoladas, se necessário
└── components/# reservado para futura extração de componentes reutilizáveis
```

## O que já está implementado

- Login por matrícula e senha individual, com três perfis: Administrador,
  Líder e Fiscal. A tela de login não exibe credenciais.
- **Cadastro de Equipe**: prefixo manual, município, horário de trabalho,
  processo, veículo (sem campo de prefixo — já informado na
  Identificação), comunicação (incluindo dispositivo utilizado — Tablet ou
  Celular — com foto) e 2–3 colaboradores, com GPS e fotos obrigatórias, e
  validação bloqueando o envio se faltar algo.
- **Inspeção de Equipe**: seleção da equipe cadastrada por prefixo, data da
  inspeção, **checklist de EPIs** (20 itens, verificado individualmente
  para cada eletricista, em abas) e **checklist de EPCs** (24 itens,
  único por veículo/equipe) — quantidade, validade do laudo, situação
  (De acordo / Danificado) e foto opcional por item.
- **Meu Painel (Fiscal)**: KPIs pessoais e duas listas em abas — "Minhas
  Equipes Cadastradas" (com atalho "Inspecionar" pré-selecionando a
  equipe) e "Minhas Inspeções Realizadas".
- **Painel do Líder**: KPIs, equipe de fiscais vinculados, e duas listas em
  abas — "Equipes Cadastradas" e "Inspeções Realizadas" — de tudo que os
  fiscais dele fizeram, com filtros por fiscal e município.
- Dashboard executivo (Administrador) com 8 KPIs (incluindo total de itens
  de EPI/EPC danificados), 5 gráficos (Chart.js) e mapa de inspeções por
  município (Leaflet), atualizados automaticamente a cada novo registro.
- Ranking de fiscais por cadastros e inspeções realizadas.
- Histórico (Administrador) com filtros combináveis (data, município,
  fiscal, equipe, processo, veículo), modal de detalhe unindo dados do
  cadastro (fotos, horários, GPS) com o checklist da inspeção.
- Galeria de fotos (Administrador) separada por Veículo / Comunicação /
  Equipe / Checklist (EPI/EPC), com ampliação (lightbox).
- Exportação (Administrador) de PDF por inspeção (cadastro + checklist),
  Excel geral, por fiscal, por município, e relatório dedicado de itens de
  EPI/EPC danificados (com status de resolução).
- **Resolução de não-conformidades**: qualquer item marcado como
  "Danificado" no checklist ganha um botão "Marcar resolvida" — o fiscal
  anexa uma foto comprovando a correção, e o item passa a mostrar um selo
  "Resolvida" com data/hora e quem resolveu. KPIs, resumos e exportações
  mostram "pendente(s)" vs "resolvida(s)".
- **Exclusão de equipes e inspeções**: Administrador e Líder podem excluir
  cadastros (com aviso de que as inspeções vinculadas também serão
  excluídas em cascata) e inspeções, direto pelas listas do Painel do
  Líder e do Histórico.
- **Dashboard sempre atualizado**: além de reagir a mudanças em tempo real,
  o Dashboard tem um botão "Atualizar agora" e se atualiza sozinho a cada
  poucos segundos como reforço, garantindo que o administrador sempre veja
  os números corretos.

## Próximos passos sugeridos

- Conectar ao Firebase real (Firestore + Storage + Authentication) para uso
  em produção com múltiplos dispositivos simultâneos.
- Tela de administração para gerenciar líderes/fiscais e vínculos sem
  editar `js/data.js` diretamente.
- Push notifications para o líder/gestor quando uma inspeção com itens
  danificados for salva.
