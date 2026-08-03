/**
 * ==========================================================================
 * SUPABASE CONFIG — Backend alternativo ao Firebase (mesmo resultado final)
 * ==========================================================================
 * Este arquivo liga o Supabase (Postgres + Realtime) ao mesmo objeto DB
 * usado pelo resto do app — ou seja, nenhuma outra parte do código precisa
 * mudar. Para ativar:
 *
 *  1. Crie as tabelas no Supabase (SQL pronto no guia SUPABASE.md).
 *  2. Preencha SUPABASE_CONFIG abaixo com a URL e a "anon key" do projeto.
 *  3. Em js/firebase-config.js, troque DB.mode para "supabase".
 *
 * Cada tabela tem só 2 colunas: "id" (texto) e "data" (jsonb) — o objeto
 * inteiro do cadastro/inspeção/fiscal é salvo dentro de "data", igual já
 * fazíamos no localStorage e no Firestore. Isso evita ter que recriar o
 * schema toda vez que um campo novo é adicionado ao formulário.
 * ==========================================================================
 */

const SUPABASE_CONFIG = {
  url: "https://qrwlcurfianefrkkwctp.supabase.co",
  anonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFyd2xjdXJmaWFuZWZya2t3Y3RwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3MTY2NTQsImV4cCI6MjEwMTI5MjY1NH0.0nyWIvvTZOsJ6VePI16D6qdz6ajYpk1ABNUmKQmVIeA"
};

// Tamanho máximo de linha no Postgres não é um problema como no Firestore
// (não há limite de 1MB por documento), mas ainda assim evite fotos
// gigantes — a compressão já feita em js/utils.js é suficiente.

DB._sb = null;

DB._initSupabase = function (fiscaisIniciais) {
  if (typeof supabase === "undefined") {
    console.error("SDK do Supabase não carregado. Confira as tags <script> no index.html.");
    return;
  }
  this._sb = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

  // Semeia os usuários iniciais apenas se a tabela estiver vazia (1ª vez)
  this._sb.from("fiscais").select("id").limit(1).then(({ data, error }) => {
    if (error) { console.error("Erro ao checar tabela fiscais:", error); return; }
    if (!data || data.length === 0) {
      const rows = fiscaisIniciais.map(f => ({ id: f.id, data: f }));
      this._sb.from("fiscais").insert(rows).then(({ error: insertError }) => {
        if (insertError) console.error("Erro ao semear usuários:", insertError);
      });
    }
  });

  ["fiscais", "cadastros", "inspecoes", "producao", "ordens"].forEach(tabela => this._subscribeSupabase(tabela));
};

/** Carrega os dados da tabela e assina mudanças em tempo real (Realtime) */
DB._subscribeSupabase = function (tabela) {
  const recarregar = () => {
    this._sb.from(tabela).select("data").then(({ data, error }) => {
      if (error) { console.error(`Erro ao ler "${tabela}":`, error); return; }
      this._cache[tabela] = data.map(linha => linha.data);
      window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: tabela } }));
    });
  };

  recarregar(); // carga inicial

  this._sb
    .channel(`realtime:${tabela}`)
    .on("postgres_changes", { event: "*", schema: "public", table: tabela }, recarregar)
    .subscribe();
};

/** Insere ou atualiza uma linha (equivalente ao "set" do Firestore) */
DB._supabaseUpsert = function (tabela, objeto) {
  this._sb.from(tabela).upsert({ id: objeto.id, data: objeto }).then(({ error }) => {
    if (error) console.error(`Erro ao salvar em "${tabela}":`, error);
  });
};

/** Insere/atualiza muitas linhas de uma vez (upload das bases de produção) */
DB._supabaseUpsertBatch = function (tabela, objetos, tamanhoLote = 500) {
  const linhas = objetos.map(o => ({ id: o.id, data: o }));
  let p = Promise.resolve();
  for (let i = 0; i < linhas.length; i += tamanhoLote) {
    const lote = linhas.slice(i, i + tamanhoLote);
    p = p.then(() => this._sb.from(tabela).upsert(lote)).then(({ error }) => {
      if (error) console.error(`Erro ao salvar lote em "${tabela}":`, error);
    });
  }
};
