/**
 * ==========================================================================
 * FIREBASE CONFIG — Sistema de Inspeção de Equipes de Campo
 * ==========================================================================
 * COMO COLOCAR O SISTEMA ONLINE, COM DADOS COMPARTILHADOS EM TEMPO REAL:
 *
 *  1. Crie um projeto gratuito em https://console.firebase.google.com
 *  2. No menu do projeto, ative "Firestore Database" (modo produção,
 *     localização "southamerica-east1" para ficar perto do Brasil).
 *  3. Em "Configurações do projeto" > "Geral" > "Seus apps", clique no
 *     ícone "</>" (Web), registre um app e copie o objeto de configuração.
 *  4. Cole esse objeto substituindo o FIREBASE_CONFIG abaixo.
 *  5. Troque DB.mode de "demo" para "firebase" (linha logo abaixo do
 *     objeto FIREBASE_CONFIG).
 *  6. Pronto — o app inteiro passa a usar o Firestore automaticamente,
 *     com atualização em tempo real entre todos os aparelhos conectados.
 *
 * Enquanto DB.mode = "demo", o sistema roda salvando tudo no localStorage
 * do navegador (cada aparelho vê só os próprios dados). Isso é ótimo para
 * testar o sistema sozinho antes de configurar o Firebase.
 * ==========================================================================
 */

const FIREBASE_CONFIG = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

/**
 * ESTRUTURA DE COLEÇÕES (Firestore)
 * ------------------------------------------------------------------------
 * /fiscais/{usuarioId}
 *     nome, matricula, senha, email, perfil: "admin" | "lider" | "fiscal",
 *     liderId: string|null  (referência ao líder responsável, quando fiscal)
 *
 * /cadastros/{cadastroId}   — "Cadastro de Equipe" (Identificação, Veículo,
 *                              Comunicação, Componentes da Equipe)
 *     fiscalId, fiscalNome, dataHoraISO, gps: {lat, lng},
 *     empresa ("PSE ENGENHARIA" | "EQUATORIAL"),
 *     prefixo (informado manualmente pelo fiscal), municipio,
 *     horarioInicial, horarioFinal, processo,
 *     veiculo: {tipo, placa, documentoNumero, documentoValidade, fotos:{frente,traseira,lateral,placa,documento}},
 *     comunicacao: {tipo, numeroSerie, foto, dispositivo, fotoDispositivo},
 *     colaboradores: [{nome, matricula, funcao, foto}],
 *     fotoEquipe
 *
 * /inspecoes/{inspecaoId}   — "Inspeção de Equipe" (checklist de EPI/EPC)
 *     fiscalId, fiscalNome, cadastroId, equipePrefixo,
 *     municipio, processo, veiculoTipo, veiculoPlaca, comunicacaoTipo, comunicacaoSerie,
 *     colaboradores: [{nome, matricula, funcao}]  (copiado do cadastro),
 *     dataInspecao (informada pelo fiscal), dataHoraISO (registro do sistema),
 *     epiPorColaborador: [{ colaborador, itens: [{nome, quantidade, validade, estado, foto}] }],
 *     epc: { itens: [{nome, quantidade, validade, estado, foto}] },
 *     status: "concluida"
 *
 * ATENÇÃO — LIMITE DE TAMANHO: cada documento do Firestore aceita até 1MB.
 * As fotos são salvas em base64 direto no documento (para simplificar);
 * como um cadastro tem várias fotos, fique de olho no tamanho. Se algum
 * dia der erro de "documento muito grande", o próximo passo é migrar as
 * fotos para o Firebase Storage (upload separado + salvar só a URL no
 * documento) — posso te ajudar a implementar isso quando precisar.
 * ------------------------------------------------------------------------
 *
 * /producao/{registroId}   — linhas importadas das bases de serviços
 *                             (Comercial, Emergencial, Miscelânea), usadas
 *                             na página "Produção" (js/producao.js)
 *     tipo: "comercial" | "emergencial" | "miscelanea"
 *     prefixo (cruzado com /cadastros para achar fiscal/líder responsável),
 *     dataRef (AAAA-MM-DD, usada nos filtros de período e no ranking),
 *     + campos específicos de cada tipo (ver js/producao.js)
 *
 * O upload de cada base faz "merge" (upsert): registros com o mesmo id
 * são atualizados, novos são adicionados — nada é apagado numa nova
 * importação.
 * ------------------------------------------------------------------------
 *
 * /ordens/{ordemId}   — "Ordem de Inspeção de Ativo" (js/ordens.js)
 *     Fluxo: líder envia -> fiscal preenche (fotos + ações + observações)
 *            -> líder aprova ou recusa (recusada -> fiscal reenvia).
 *     liderId, liderNome, fiscalId, fiscalNome,
 *     tipoAtivo: "Transformador" | "Chave de Proteção" | "Unidade Consumidora",
 *     identificacao, municipio, endereco, prioridade, prazo, motivo,
 *     dataEnvioISO, status: "pendente" | "aguardando_revisao" | "aprovada" | "recusada",
 *     fotos: [base64...], acoesSelecionadas: [string...], observacoesFiscal,
 *     gpsFiscal: {lat,lng}, dataExecucaoISO,
 *     revisao: {status, comentario, liderRevisorNome, dataISO} | null
 * ------------------------------------------------------------------------
 */

const DB = {
  mode: "supabase", // "demo" | "firebase" | "supabase" — veja DEPLOY.md ou SUPABASE.md
  pronto: false, // vira true assim que os usuários (fiscais) terminam de carregar

  _cache: { fiscais: [], cadastros: [], inspecoes: [], producao: [], ordens: [] },
  _firestore: null,

  // ---------------------------------------------------------------------
  // Inicialização — chamado uma vez, no boot do app (App.init)
  // ---------------------------------------------------------------------
  init(fiscaisIniciais) {
    if (this.mode === "firebase") {
      this._initFirebase(fiscaisIniciais);
    } else if (this.mode === "supabase") {
      this._initSupabase(fiscaisIniciais); // implementado em js/supabase-config.js
    } else {
      this._seedLocalIfEmpty(fiscaisIniciais);
      this._initDemoProducao(); // produção usa IndexedDB, não localStorage (ver abaixo)
      this._marcarPronto();
    }
  },

  /** Chamado uma única vez, assim que os usuários (fiscais) terminam de carregar. */
  _marcarPronto() {
    if (this.pronto) return;
    this.pronto = true;
    window.dispatchEvent(new CustomEvent("db:ready"));
  },

  _initFirebase(fiscaisIniciais) {
    if (typeof firebase === "undefined") {
      console.error("SDK do Firebase não carregado. Confira as tags <script> no index.html.");
      return;
    }
    firebase.initializeApp(FIREBASE_CONFIG);
    this._firestore = firebase.firestore();

    // Semeia os usuários iniciais apenas se a coleção estiver vazia (1ª vez)
    this._firestore.collection("fiscais").limit(1).get().then(snap => {
      if (snap.empty) {
        const batch = this._firestore.batch();
        fiscaisIniciais.forEach(f => batch.set(this._firestore.collection("fiscais").doc(f.id), f));
        batch.commit().catch(err => console.error("Erro ao semear usuários:", err));
      }
    });

    // Assina as coleções em tempo real — qualquer mudança em qualquer
    // aparelho conectado atualiza this._cache e dispara "db:changed"
    this._subscribe("fiscais");
    this._subscribe("cadastros");
    this._subscribe("inspecoes");
    this._subscribe("producao");
    this._subscribe("ordens");
  },

  _subscribe(colecao) {
    this._firestore.collection(colecao).onSnapshot(
      (snapshot) => {
        this._cache[colecao] = snapshot.docs.map(d => d.data());
        if (colecao === "fiscais") this._marcarPronto();
        window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: colecao } }));
      },
      (err) => console.error(`Erro ao sincronizar "${colecao}":`, err)
    );
  },

  // ---------------------------------------------------------------------
  // Produção (modo demo) — usa IndexedDB em vez de localStorage
  // ------------------------------------------------------------------
  // As bases de serviços importadas (Comercial/Emergencial/Miscelânea)
  // podem ter dezenas de milhares de linhas. O localStorage só aguenta
  // uns 5-10MB no total (e é reescrito por inteiro a cada gravação), então
  // uma planilha grande sozinha já estoura a cota. O IndexedDB não tem
  // esse problema (aguenta centenas de MB) e permite gravar registro por
  // registro sem reescrever a base inteira — por isso só a coleção
  // "producao" usa IndexedDB; fiscais/cadastros/inspeções continuam no
  // localStorage normalmente.
  // ---------------------------------------------------------------------
  _idbDbPromise: null,

  _idbOpen() {
    if (this._idbDbPromise) return this._idbDbPromise;
    this._idbDbPromise = new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error("IndexedDB não suportado neste navegador.")); return; }
      const req = indexedDB.open("inspecampo_demo", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("producao")) db.createObjectStore("producao", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this._idbDbPromise;
  },

  async _idbGetAll(store) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readonly");
      const req = tx.objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async _idbPutAll(store, registros) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      registros.forEach(r => tx.objectStore(store).put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async _idbDeleteAll(store, ids) {
    const db = await this._idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      ids.forEach(id => tx.objectStore(store).delete(id));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /** Carrega a produção do IndexedDB para a cache; migra dados antigos que ainda estejam no localStorage. */
  async _initDemoProducao() {
    try {
      const legado = this._read("producao", null);
      if (legado && legado.length) {
        await this._idbPutAll("producao", legado);
        localStorage.removeItem("producao"); // libera espaço do localStorage
      }
    } catch (err) {
      console.error("Erro ao migrar produção do localStorage para o IndexedDB:", err);
    }
    try {
      this._cache.producao = await this._idbGetAll("producao");
    } catch (err) {
      console.error("Erro ao carregar produção (IndexedDB):", err);
      this._cache.producao = [];
    }
    window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } }));
  },

  // ---------------------------------------------------------------------
  // Leitura — mesma assinatura em ambos os modos (demo/firebase)
  // ---------------------------------------------------------------------
  getFiscais() { return this._usesCache() ? this._cache.fiscais : this._read("fiscais", []); },
  getCadastros() { return this._usesCache() ? this._cache.cadastros : this._read("cadastros", []); },
  getInspecoes() { return this._usesCache() ? this._cache.inspecoes : this._read("inspecoes", []); },
  getOrdens() { return this._usesCache() ? this._cache.ordens : this._read("ordens", []); },
  /** Registros importados das bases de serviços. Passe "tipo" para filtrar (comercial/emergencial/miscelanea). */
  getProducao(tipo) {
    const all = this._cache.producao || []; // sempre via cache: IndexedDB (demo) ou Firestore/Supabase (nuvem)
    return tipo ? all.filter(r => r.tipo === tipo) : all;
  },
  _usesCache() { return this.mode === "firebase" || this.mode === "supabase"; },

  // ---------------------------------------------------------------------
  // Escrita
  // ---------------------------------------------------------------------
  saveCadastro(cadastro) {
    if (this.mode === "firebase") {
      this._firestore.collection("cadastros").doc(cadastro.id).set(cadastro)
        .catch(err => console.error("Erro ao salvar cadastro:", err));
      return cadastro; // a UI atualiza sozinha quando o onSnapshot confirmar
    }
    if (this.mode === "supabase") {
      this._supabaseUpsert("cadastros", cadastro); // implementado em js/supabase-config.js
      return cadastro;
    }
    const all = this.getCadastros();
    const idx = all.findIndex(c => c.id === cadastro.id);
    if (idx >= 0) all[idx] = cadastro; else all.push(cadastro);
    return this._write("cadastros", all) ? cadastro : null;
  },

  saveInspecao(inspecao) {
    if (this.mode === "firebase") {
      this._firestore.collection("inspecoes").doc(inspecao.id).set(inspecao)
        .catch(err => console.error("Erro ao salvar inspeção:", err));
      return inspecao;
    }
    if (this.mode === "supabase") {
      this._supabaseUpsert("inspecoes", inspecao);
      return inspecao;
    }
    const all = this.getInspecoes();
    const idx = all.findIndex(i => i.id === inspecao.id);
    if (idx >= 0) all[idx] = inspecao; else all.push(inspecao);
    return this._write("inspecoes", all) ? inspecao : null;
  },

  /**
   * Importa/atualiza um lote de registros de produção (upload de planilha).
   * Faz "merge": registros com o mesmo id são atualizados, os demais são
   * adicionados — nada é apagado. Retorna a quantidade de registros do lote.
   */
  saveProducaoLote(registros) {
    if (!registros || !registros.length) return 0;
    if (this.mode === "firebase") {
      const tamanhoLote = 450; // limite de 500 operações por batch no Firestore
      let p = Promise.resolve();
      for (let i = 0; i < registros.length; i += tamanhoLote) {
        const parte = registros.slice(i, i + tamanhoLote);
        p = p.then(() => {
          const batch = this._firestore.batch();
          parte.forEach(r => batch.set(this._firestore.collection("producao").doc(r.id), r, { merge: true }));
          return batch.commit();
        });
      }
      p.catch(err => console.error("Erro ao salvar produção:", err));
      return registros.length;
    }
    if (this.mode === "supabase") {
      this._supabaseUpsertBatch("producao", registros);
      // Atualiza a cache local na hora (não espera o "tempo real" avisar) —
      // pra quem acabou de importar já ver os dados na tela imediatamente,
      // mesmo com bases grandes (milhares de linhas).
      const mapa = new Map((this._cache.producao || []).map(r => [r.id, r]));
      registros.forEach(r => mapa.set(r.id, r));
      this._cache.producao = [...mapa.values()];
      window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } }));
      return registros.length;
    }
    // Demo → IndexedDB. Atualiza a cache imediatamente (a tela já reflete
    // os novos dados) e grava em segundo plano — sem reescrever a base
    // inteira a cada importação, como acontecia com o localStorage.
    const mapa = new Map((this._cache.producao || []).map(r => [r.id, r]));
    registros.forEach(r => mapa.set(r.id, r));
    this._cache.producao = [...mapa.values()];
    this._idbPutAll("producao", registros)
      .then(() => window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } })))
      .catch(err => {
        console.error("Erro ao salvar produção (IndexedDB):", err);
        if (typeof Utils !== "undefined" && Utils.error) {
          Utils.error("Não foi possível salvar a base importada", "Ocorreu um erro ao gravar os dados no navegador. Tente novamente ou atualize o navegador para uma versão mais recente.");
        }
      });
    return registros.length;
  },

  /** Exclui TODOS os registros de produção de um tipo (comercial/emergencial/miscelanea) — ex: base importada errada. */
  deleteProducaoPorTipo(tipo) {
    const idsParaExcluir = this.getProducao(tipo).map(r => r.id);
    if (!idsParaExcluir.length) return 0;

    if (this.mode === "firebase") {
      const tamanhoLote = 450;
      let p = Promise.resolve();
      for (let i = 0; i < idsParaExcluir.length; i += tamanhoLote) {
        const parte = idsParaExcluir.slice(i, i + tamanhoLote);
        p = p.then(() => {
          const batch = this._firestore.batch();
          parte.forEach(id => batch.delete(this._firestore.collection("producao").doc(id)));
          return batch.commit();
        });
      }
      p.catch(err => console.error("Erro ao excluir base de produção:", err));
      this._cache.producao = this._cache.producao.filter(r => r.tipo !== tipo);
      window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } }));
      return idsParaExcluir.length;
    }

    if (this.mode === "supabase") {
      const tamanhoLote = 500;
      let p = Promise.resolve();
      for (let i = 0; i < idsParaExcluir.length; i += tamanhoLote) {
        const parte = idsParaExcluir.slice(i, i + tamanhoLote);
        p = p.then(() => this._sb.from("producao").delete().in("id", parte)).then(({ error }) => {
          if (error) console.error("Erro ao excluir base de produção:", error);
        });
      }
      this._cache.producao = this._cache.producao.filter(r => r.tipo !== tipo);
      window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } }));
      return idsParaExcluir.length;
    }

    // Demo → IndexedDB
    this._cache.producao = this._cache.producao.filter(r => r.tipo !== tipo);
    this._idbDeleteAll("producao", idsParaExcluir)
      .then(() => window.dispatchEvent(new CustomEvent("db:changed", { detail: { key: "producao" } })))
      .catch(err => console.error("Erro ao excluir base de produção (IndexedDB):", err));
    return idsParaExcluir.length;
  },

  /** Cria/atualiza uma Ordem de Inspeção de Ativo (fluxo líder → fiscal → revisão) */
  saveOrdem(ordem) {
    if (this.mode === "firebase") {
      this._firestore.collection("ordens").doc(ordem.id).set(ordem)
        .catch(err => console.error("Erro ao salvar ordem de inspeção:", err));
      return ordem;
    }
    if (this.mode === "supabase") {
      this._supabaseUpsert("ordens", ordem);
      return ordem;
    }
    const all = this.getOrdens();
    const idx = all.findIndex(o => o.id === ordem.id);
    if (idx >= 0) all[idx] = ordem; else all.push(ordem);
    return this._write("ordens", all) ? ordem : null;
  },

  /** Exclui uma equipe cadastrada e, em cascata, todas as inspeções feitas nela */
  deleteCadastro(cadastroId) {
    this.getInspecoes().filter(i => i.cadastroId === cadastroId).forEach(i => this.deleteInspecao(i.id));

    if (this.mode === "firebase") {
      this._firestore.collection("cadastros").doc(cadastroId).delete()
        .catch(err => console.error("Erro ao excluir cadastro:", err));
      return;
    }
    if (this.mode === "supabase") {
      this._sb.from("cadastros").delete().eq("id", cadastroId).then(({ error }) => {
        if (error) console.error("Erro ao excluir cadastro:", error);
      });
      return;
    }
    this._write("cadastros", this.getCadastros().filter(c => c.id !== cadastroId));
  },

  deleteInspecao(inspecaoId) {
    if (this.mode === "firebase") {
      this._firestore.collection("inspecoes").doc(inspecaoId).delete()
        .catch(err => console.error("Erro ao excluir inspeção:", err));
      return;
    }
    if (this.mode === "supabase") {
      this._sb.from("inspecoes").delete().eq("id", inspecaoId).then(({ error }) => {
        if (error) console.error("Erro ao excluir inspeção:", error);
      });
      return;
    }
    this._write("inspecoes", this.getInspecoes().filter(i => i.id !== inspecaoId));
  },

  deleteOrdem(ordemId) {
    if (this.mode === "firebase") {
      this._firestore.collection("ordens").doc(ordemId).delete()
        .catch(err => console.error("Erro ao excluir ordem de inspeção:", err));
      return;
    }
    if (this.mode === "supabase") {
      this._sb.from("ordens").delete().eq("id", ordemId).then(({ error }) => {
        if (error) console.error("Erro ao excluir ordem de inspeção:", error);
      });
      return;
    }
    this._write("ordens", this.getOrdens().filter(o => o.id !== ordemId));
  },

  updateSenha(fiscalId, novaSenha) {
    if (this.mode === "firebase") {
      this._firestore.collection("fiscais").doc(fiscalId).update({ senha: novaSenha })
        .catch(err => console.error("Erro ao atualizar senha:", err));
      return true;
    }
    if (this.mode === "supabase") {
      const atual = this._cache.fiscais.find(f => f.id === fiscalId);
      if (!atual) return false;
      this._supabaseUpsert("fiscais", { ...atual, senha: novaSenha });
      return true;
    }
    const fiscais = this.getFiscais();
    const f = fiscais.find(x => x.id === fiscalId);
    if (!f) return false;
    f.senha = novaSenha;
    this._write("fiscais", fiscais);
    return true;
  },

  /** Cria ou atualiza um usuário (admin/líder/analista/fiscal) — usado pela Gestão de Usuários */
  saveFiscal(user) {
    if (this.mode === "firebase") {
      this._firestore.collection("fiscais").doc(user.id).set(user, { merge: true })
        .catch(err => console.error("Erro ao salvar usuário:", err));
      return user;
    }
    if (this.mode === "supabase") {
      this._supabaseUpsert("fiscais", user);
      return user;
    }
    const all = this.getFiscais();
    const idx = all.findIndex(f => f.id === user.id);
    if (idx >= 0) all[idx] = user; else all.push(user);
    return this._write("fiscais", all) ? user : null;
  },

  /** Exclui um usuário (admin/líder/analista/fiscal) */
  deleteFiscal(userId) {
    if (this.mode === "firebase") {
      this._firestore.collection("fiscais").doc(userId).delete()
        .catch(err => console.error("Erro ao excluir usuário:", err));
      return;
    }
    if (this.mode === "supabase") {
      this._sb.from("fiscais").delete().eq("id", userId).then(({ error }) => {
        if (error) console.error("Erro ao excluir usuário:", error);
      });
      return;
    }
    this._write("fiscais", this.getFiscais().filter(f => f.id !== userId));
  },

  // ---------------------------------------------------------------------
  // Modo demo (localStorage) — inalterado, serve de fallback/teste local
  // ---------------------------------------------------------------------
  _read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error("DB read error", key, e);
      return fallback;
    }
  },
  _write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent("db:changed", { detail: { key } }));
      return true;
    } catch (e) {
      console.error("DB write error", key, e);
      const cheio = e && (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014);
      if (typeof Utils !== "undefined" && Utils.error) {
        Utils.error(
          "Não foi possível salvar",
          cheio
            ? 'O armazenamento local do navegador (modo demo) está cheio — isso costuma acontecer depois de importar bases grandes em "Produção" ou salvar muitas fotos. Nada foi salvo agora. Para resolver: (1) ative o Firebase ou o Supabase (veja DEPLOY.md / SUPABASE.md) para salvar em nuvem sem esse limite, ou (2) libere espaço apagando cadastros/inspeções antigas.'
            : "Ocorreu um erro inesperado ao salvar os dados. Tente novamente."
        );
      }
      return false;
    }
  },
  _seedLocalIfEmpty(fiscais) {
    if (this.getFiscais().length === 0) this._write("fiscais", fiscais);
    if (!localStorage.getItem("cadastros")) this._write("cadastros", []);
    if (!localStorage.getItem("inspecoes")) this._write("inspecoes", []);
    if (!localStorage.getItem("ordens")) this._write("ordens", []);
  },

  onChange(cb) {
    window.addEventListener("db:changed", cb);
    window.addEventListener("storage", cb); // sincroniza abas do mesmo navegador em modo demo
  }
};
