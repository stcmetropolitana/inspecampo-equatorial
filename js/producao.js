/**
 * ==========================================================================
 * PRODUÇÃO DAS EQUIPES
 * ==========================================================================
 * O Administrador importa as bases de serviços (Comercial, Emergencial e
 * Miscelânea — exportadas do sistema da concessionária) e o app cruza cada
 * linha pelo PREFIXO da equipe com os cadastros feitos pelos fiscais em
 * campo (js/cadastro.js), descobrindo assim qual fiscal (e qual líder) é
 * responsável por aquela equipe.
 *
 *  - Administrador → vê o ranking de todas as equipes e importa as bases.
 *  - Líder         → vê apenas a produção das equipes cadastradas pelos
 *                     fiscais vinculados a ele.
 *  - Fiscal        → vê apenas a produção das equipes que ele mesmo
 *                     cadastrou.
 *
 * Cada nova importação faz "merge": os registros que já existiam são
 * atualizados e os novos são adicionados — nada é apagado.
 * ==========================================================================
 */

const ProducaoPage = {
  activeTab: "ranking",
  filtros: { de: "", ate: "", prefixo: "", municipio: "", fiscalId: "" },
  paginas: { comercial: 1, emergencial: 1, miscelanea: 1 },
  ordenacao: {},
  PAGE_SIZE: 40,

  TIPOS: {
    comercial: {
      label: "Atendimentos Comerciais",
      icon: "fa-briefcase",
      idCols: ["SS_NUMERO"],
      dataCols: ["INICIO_DESLOCAMENTO", "DATA_SOLICITACAO"],
      resumoCampos: ["tmd", "tme"],
      campos: [
        ["INICIO_DESLOCAMENTO", "Início Deslocamento", "datetime"],
        ["FIM_DESLOCAMENTO", "Fim Deslocamento", "datetime"],
        ["INICIO_EXECUCAO", "Início Execução", "datetime"],
        ["FIM_EXECUCAO", "Fim Execução", "datetime"],
        ["MUNICIPIO", "Município", "text"],
        ["CLASSIFICACAO_ATENDIMENTO", "Classificação", "text"],
        ["TIPO_SERVICO", "Tipo de Serviço", "text"],
        ["SUBTIPO_SERVICO", "Subtipo de Serviço", "text"],
        ["TIPO_CONCLUSAO", "Tipo de Conclusão", "text"],
        ["CODE_MEDIDA", "Medida", "text"],
        ["EFETIVIDADE_VISITA", "Efetividade da Visita", "text"],
        ["PRAZO", "Prazo", "text"],
        ["TMD", "TMD", "num"],
        ["TME", "TME", "num"],
        ["REPROVACAO", "Reprovação", "text"]
      ]
    },
    emergencial: {
      label: "Atendimentos Emergenciais",
      icon: "fa-bolt-lightning",
      idCols: ["OCORRENCIA"],
      dataCols: ["INICIO_DESLOCAMENTO", "DATA_ABERTURA"],
      resumoCampos: ["tmd", "tme", "km"],
      campos: [
        ["INICIO_DESLOCAMENTO", "Início Deslocamento", "datetime"],
        ["FIM_DESLOCAMENTO", "Fim Deslocamento", "datetime"],
        ["INICIO_EXECUCAO", "Início Execução", "datetime"],
        ["FIM_EXECUCAO", "Fim Execução", "datetime"],
        ["MUNICIPIO", "Município", "text"],
        ["CAUSA", "Causa", "text"],
        ["PROCEDENCIA", "Procedência", "text"],
        ["DESVIO_OCIOSO", "Desvio Ocioso", "text"],
        ["EFETIVIDADE", "Efetividade", "text"],
        ["TMD", "TMD", "num"],
        ["TME", "TME", "num"],
        ["KM_PERCORRIDO", "KM Percorrido", "num"]
      ]
    },
    miscelanea: {
      label: "Atendimentos Miscelâneas",
      icon: "fa-layer-group",
      idCols: ["MISCELANEA"],
      dataCols: ["INICIO_DESLOCAMENTO"],
      resumoCampos: [],
      campos: [
        ["STATUS", "Status", "text"],
        ["INICIO_DESLOCAMENTO", "Início Deslocamento", "datetime"],
        ["FIM_DESLOCAMENTO", "Fim Deslocamento", "datetime"],
        ["INICIO_EXECUCAO", "Início Execução", "datetime"],
        ["FIM_EXECUCAO", "Fim Execução", "datetime"],
        ["EQUIPE_RETIRADA", "Equipe Retirada", "text"],
        ["SERVICO_LANCADO", "Serviço Lançado", "text"]
      ]
    }
  },

  // ------------------------------------------------------------------
  // Ordenação clicável (cabeçalhos das tabelas)
  // ------------------------------------------------------------------
  getOrdenacao(tabelaId) {
    if (!this.ordenacao[tabelaId]) this.ordenacao[tabelaId] = { chave: null, direcao: "desc" };
    return this.ordenacao[tabelaId];
  },

  ordenarLinhas(tabelaId, linhas, colunas) {
    const ord = this.getOrdenacao(tabelaId);
    if (!ord.chave) return linhas;
    const col = colunas.find(c => c.key === ord.chave);
    if (!col) return linhas;
    const mul = ord.direcao === "asc" ? 1 : -1;
    return [...linhas].sort((a, b) => {
      let va = a[ord.chave], vb = b[ord.chave];
      if (col.tipo === "numero") {
        va = (va === null || va === undefined || isNaN(va)) ? -Infinity : Number(va);
        vb = (vb === null || vb === undefined || isNaN(vb)) ? -Infinity : Number(vb);
        return (va - vb) * mul;
      }
      va = (va ?? "").toString(); vb = (vb ?? "").toString();
      return va.localeCompare(vb) * mul;
    });
  },

  /** Cabeçalho de tabela clicável: alterna maior→menor / menor→maior a cada clique. */
  thOrdenavel(tabelaId, col, container) {
    const ord = this.getOrdenacao(tabelaId);
    const ativo = ord.chave === col.key;
    const icone = ativo ? (ord.direcao === "desc" ? "fa-arrow-down-wide-short" : "fa-arrow-up-short-wide") : "fa-sort";
    return Utils.el("th", {
      style: "cursor:pointer;user-select:none;white-space:nowrap;",
      title: "Clique para ordenar (maior → menor / menor → maior)",
      onclick: () => {
        if (ord.chave === col.key) ord.direcao = ord.direcao === "desc" ? "asc" : "desc";
        else { ord.chave = col.key; ord.direcao = "desc"; }
        this.render(container);
      }
    }, [col.label + " ", Utils.el("i", { class: `fa-solid ${icone}`, style: "font-size:.7rem;opacity:.55;" })]);
  },

  // ------------------------------------------------------------------
  // Importação da planilha (SheetJS)
  // ------------------------------------------------------------------
  async parseArquivo(tipo, file) {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const linhas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
    if (!linhas.length) return [];

    const header = linhas[0].map(h => String(h || "").trim().toUpperCase());
    const idx = (nomes) => {
      for (const n of nomes) { const i = header.indexOf(n); if (i >= 0) return i; }
      return -1;
    };
    const cfg = this.TIPOS[tipo];
    const iPrefixo = idx(["PREFIXO"]);
    const iId = idx(cfg.idCols);
    const iData = (() => { for (const c of cfg.dataCols) { const i = idx([c]); if (i >= 0) return i; } return -1; })();
    if (iPrefixo < 0 || iId < 0) {
      throw new Error(`A planilha não tem as colunas esperadas (PREFIXO e ${cfg.idCols[0]}). Confira o arquivo.`);
    }
    const camposIdx = cfg.campos.map(([col]) => idx([col]));

    const registros = [];
    for (let r = 1; r < linhas.length; r++) {
      const row = linhas[r];
      if (!row || row.every(v => v === null || v === "")) continue;
      const prefixo = String(row[iPrefixo] || "").trim().toUpperCase();
      const chave = row[iId];
      if (!prefixo || chave === null || chave === undefined || String(chave).trim() === "") continue;

      const rec = { id: `${tipo}_${String(chave).trim()}`, tipo, prefixo };
      cfg.campos.forEach(([col, , kind], i) => {
        rec[col] = this.normalizarValor(row[camposIdx[i]], kind);
      });
      rec.dataRef = this.paraDataRef(iData >= 0 ? row[iData] : null);
      registros.push(rec);
    }
    return registros;
  },

  normalizarValor(v, kind) {
    if (v === null || v === undefined || v === "") return null;
    if (kind === "datetime") {
      const d = (v instanceof Date) ? v : new Date(v);
      return isNaN(d) ? null : d.toISOString();
    }
    if (kind === "num") {
      const n = Number(v);
      return isNaN(n) ? null : n;
    }
    return String(v).trim();
  },

  paraDataRef(v) {
    if (!v) return null;
    const d = (v instanceof Date) ? v : new Date(v);
    return isNaN(d) ? null : d.toISOString().slice(0, 10);
  },

  disparaUpload(tipo, container) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xlsx,.xls";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const registros = await this.parseArquivo(tipo, file);
        if (!registros.length) {
          Utils.error("Nenhum registro válido encontrado", "Confira se a planilha tem a coluna PREFIXO preenchida e o formato esperado.");
          return;
        }
        const salvos = DB.saveProducaoLote(registros);
        if (!salvos) return; // erro já mostrado pelo DB (ex: armazenamento local cheio)
        Utils.toast(`${salvos} registro(s) de "${this.TIPOS[tipo].label}" importado(s)/atualizado(s).`);
        this.render(container);
      } catch (err) {
        Utils.error("Erro ao importar planilha", err.message || String(err));
      }
    };
    input.click();
  },

  // ------------------------------------------------------------------
  // Render principal
  // ------------------------------------------------------------------
  render(container) {
    const user = Auth.current();
    const isAdmin = user.perfil === "admin";

    // Mapa prefixo -> {fiscalIds, liderIds} a partir dos cadastros de equipe
    const cadastros = DB.getCadastros();
    const fiscais = DB.getFiscais();
    const fiscalById = new Map(fiscais.map(f => [f.id, f]));

    const prefixoInfo = new Map();
    cadastros.forEach(c => {
      const p = (c.prefixo || "").trim().toUpperCase();
      if (!p) return;
      if (!prefixoInfo.has(p)) prefixoInfo.set(p, { fiscalIds: new Set(), liderIds: new Set() });
      const info = prefixoInfo.get(p);
      info.fiscalIds.add(c.fiscalId);
      const fiscal = fiscalById.get(c.fiscalId);
      if (fiscal && fiscal.liderId) info.liderIds.add(fiscal.liderId);
    });

    let prefixosPermitidos = null; // null = admin vê tudo
    if (user.perfil === "fiscal") {
      prefixosPermitidos = new Set(cadastros.filter(c => c.fiscalId === user.id).map(c => (c.prefixo || "").trim().toUpperCase()));
    } else if (user.perfil === "lider") {
      const meusFiscaisIds = new Set(Auth.meusFiscais().map(f => f.id));
      prefixosPermitidos = new Set(cadastros.filter(c => meusFiscaisIds.has(c.fiscalId)).map(c => (c.prefixo || "").trim().toUpperCase()));
    }

    container.innerHTML = "";
    container.classList.add("fade-in");

    if (prefixosPermitidos && prefixosPermitidos.size === 0) {
      container.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-chart-column" }),
        Utils.el("h3", {}, "Nenhuma equipe vinculada ainda"),
        Utils.el("p", {}, user.perfil === "fiscal"
          ? 'Cadastre uma equipe em "Cadastro de Equipe" para ver a produção dela aqui.'
          : "Nenhum fiscal da sua equipe cadastrou equipes ainda.")
      ]));
      return;
    }

    // ---------- Dados brutos de produção (todos os tipos) ----------
    const todosRegistros = DB.getProducao();
    const totaisImportados = { comercial: 0, emergencial: 0, miscelanea: 0 };
    todosRegistros.forEach(r => { if (totaisImportados[r.tipo] !== undefined) totaisImportados[r.tipo]++; });

    const visivel = (r) => !prefixosPermitidos || prefixosPermitidos.has(r.prefixo);
    const registrosVisiveis = todosRegistros.filter(visivel);
    const equipesComProducao = new Set(registrosVisiveis.map(r => r.prefixo));

    // ---------- KPIs ----------
    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    const kpis = [
      { icon: "fa-people-group", label: "Equipes com produção", value: equipesComProducao.size, cls: "c-blue" },
      { icon: "fa-briefcase", label: "Atendimentos Comerciais", value: registrosVisiveis.filter(r => r.tipo === "comercial").length, cls: "c-teal" },
      { icon: "fa-bolt-lightning", label: "Atendimentos Emergenciais", value: registrosVisiveis.filter(r => r.tipo === "emergencial").length, cls: "c-amber" },
      { icon: "fa-layer-group", label: "Atendimentos Miscelâneas", value: registrosVisiveis.filter(r => r.tipo === "miscelanea").length, cls: "c-green" }
    ];
    kpis.forEach(k => {
      kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
        Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
        Utils.el("div", { class: "value" }, String(k.value)),
        Utils.el("div", { class: "label" }, k.label)
      ]));
    });
    container.appendChild(kpiGrid);

    // ---------- Importação (somente Administrador) ----------
    if (isAdmin) {
      const panelImport = Utils.el("div", { class: "panel mb-16" });
      panelImport.appendChild(Utils.el("div", { class: "panel-head" }, [
        Utils.el("h3", {}, "Importar Bases de Serviços"),
        Utils.el("span", { class: "tag" }, "Excel (.xlsx)")
      ]));
      const grid = Utils.el("div", { class: "panel-grid" });
      Object.entries(this.TIPOS).forEach(([tipo, cfg]) => {
        grid.appendChild(Utils.el("div", { class: "panel span-4", style: "margin:0;" }, [
          Utils.el("div", { class: "kpi-card c-blue", style: "border:none;box-shadow:none;padding:0;" }, [
            Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${cfg.icon}` })]),
            Utils.el("h3", { style: "margin:8px 0 4px;font-size:1rem;" }, cfg.label),
            Utils.el("p", { class: "text-muted", style: "font-size:.84rem;margin-bottom:14px;" }, `${totaisImportados[tipo]} registro(s) importado(s) até agora.`),
            Utils.el("button", {
              class: "btn btn-primary btn-sm",
              onclick: () => this.disparaUpload(tipo, container)
            }, [Utils.el("i", { class: "fa-solid fa-upload" }), " Importar planilha"])
          ])
        ]));
      });
      panelImport.appendChild(grid);
      container.appendChild(panelImport);
    }

    // ---------- Filtros ----------
    const municipios = [...new Set(registrosVisiveis.map(r => r.MUNICIPIO).filter(Boolean))].sort();
    const prefixosDisponiveis = [...equipesComProducao].sort();

    const bar = Utils.el("div", { class: "filter-bar" });
    const fDe = Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "De"),
      Utils.el("input", { type: "date", value: this.filtros.de, oninput: (e) => this.filtros.de = e.target.value })
    ]);
    const fAte = Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Até"),
      Utils.el("input", { type: "date", value: this.filtros.ate, oninput: (e) => this.filtros.ate = e.target.value })
    ]);
    const fPrefixo = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Equipe (prefixo)")]);
    const selPrefixo = Utils.el("select", {});
    selPrefixo.appendChild(Utils.el("option", { value: "" }, "Todas"));
    prefixosDisponiveis.forEach(p => {
      const opt = Utils.el("option", { value: p }, p);
      if (this.filtros.prefixo === p) opt.selected = true;
      selPrefixo.appendChild(opt);
    });
    selPrefixo.addEventListener("change", (e) => this.filtros.prefixo = e.target.value);
    fPrefixo.appendChild(selPrefixo);

    const fMun = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Município")]);
    const selMun = Utils.el("select", {});
    selMun.appendChild(Utils.el("option", { value: "" }, "Todos"));
    municipios.forEach(m => {
      const opt = Utils.el("option", { value: m }, m);
      if (this.filtros.municipio === m) opt.selected = true;
      selMun.appendChild(opt);
    });
    selMun.addEventListener("change", (e) => this.filtros.municipio = e.target.value);
    fMun.appendChild(selMun);

    let fFiscalEl = null;
    if (user.perfil === "admin" || user.perfil === "lider") {
      const fiscaisComProducao = [...new Set(
        [...equipesComProducao].flatMap(p => [...(prefixoInfo.get(p)?.fiscalIds || [])])
      )].map(id => fiscalById.get(id)).filter(Boolean).sort((a, b) => a.nome.localeCompare(b.nome));

      fFiscalEl = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Fiscal")]);
      const selFiscalProd = Utils.el("select", {});
      selFiscalProd.appendChild(Utils.el("option", { value: "" }, "Todos"));
      fiscaisComProducao.forEach(f => {
        const opt = Utils.el("option", { value: f.id }, f.nome);
        if (this.filtros.fiscalId === f.id) opt.selected = true;
        selFiscalProd.appendChild(opt);
      });
      selFiscalProd.addEventListener("change", (e) => this.filtros.fiscalId = e.target.value);
      fFiscalEl.appendChild(selFiscalProd);
    }

    const btnAplicar = Utils.el("button", { class: "btn btn-primary btn-sm", onclick: () => { this.paginas = { comercial: 1, emergencial: 1, miscelanea: 1 }; this.render(container); } }, "Aplicar filtros");
    const btnLimpar = Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => { this.filtros = { de: "", ate: "", prefixo: "", municipio: "", fiscalId: "" }; this.render(container); } }, "Limpar");

    bar.appendChild(fDe); bar.appendChild(fAte); bar.appendChild(fPrefixo); bar.appendChild(fMun);
    if (fFiscalEl) bar.appendChild(fFiscalEl);
    bar.appendChild(Utils.el("div", { class: "flex gap-8 items-center", style: "align-self:flex-end;margin-bottom:0;" }, [btnAplicar, btnLimpar]));
    container.appendChild(bar);

    // ---------- Registros filtrados ----------
    const passaFiltro = (r) => {
      if (this.filtros.de && (!r.dataRef || r.dataRef < this.filtros.de)) return false;
      if (this.filtros.ate && (!r.dataRef || r.dataRef > this.filtros.ate)) return false;
      if (this.filtros.prefixo && r.prefixo !== this.filtros.prefixo) return false;
      if (this.filtros.municipio && r.MUNICIPIO !== this.filtros.municipio) return false;
      if (this.filtros.fiscalId && !(prefixoInfo.get(r.prefixo)?.fiscalIds.has(this.filtros.fiscalId))) return false;
      return true;
    };
    const filtrados = registrosVisiveis.filter(passaFiltro);

    // ---------- Abas ----------
    const tabs = Utils.el("div", { class: "gallery-tabs" });
    const abas = [
      ["ranking", "Ranking por Equipe", "fa-ranking-star"],
      ["comercial", "Comerciais", "fa-briefcase"],
      ["emergencial", "Emergenciais", "fa-bolt-lightning"],
      ["miscelanea", "Miscelâneas", "fa-layer-group"]
    ];
    abas.forEach(([key, label, icon]) => {
      tabs.appendChild(Utils.el("button", {
        class: "gallery-tab" + (this.activeTab === key ? " active" : ""),
        onclick: () => { this.activeTab = key; this.render(container); }
      }, [Utils.el("i", { class: `fa-solid ${icon}` }), " " + label]));
    });
    container.appendChild(tabs);

    if (this.activeTab === "ranking") {
      container.appendChild(this.painelRanking(filtrados, prefixoInfo, fiscalById, container));
    } else {
      container.appendChild(this.painelDetalhe(this.activeTab, filtrados.filter(r => r.tipo === this.activeTab), container));
    }
  },

  // ------------------------------------------------------------------
  // Ranking por equipe
  // ------------------------------------------------------------------
  painelRanking(registros, prefixoInfo, fiscalById, container) {
    const porEquipe = new Map();
    registros.forEach(r => {
      if (!porEquipe.has(r.prefixo)) porEquipe.set(r.prefixo, { prefixo: r.prefixo, comercial: 0, emergencial: 0, miscelanea: 0 });
      porEquipe.get(r.prefixo)[r.tipo]++;
    });

    const nomesResponsaveis = (prefixo) => {
      const info = prefixoInfo.get(prefixo);
      if (!info) return { fiscais: "—", lideres: "—" };
      const fiscaisNomes = [...info.fiscalIds].map(id => fiscalById.get(id)?.nome).filter(Boolean);
      const lideresNomes = [...info.liderIds].map(id => fiscalById.get(id)?.nome).filter(Boolean);
      return {
        fiscais: fiscaisNomes.length ? fiscaisNomes.join(", ") : "—",
        lideres: lideresNomes.length ? lideresNomes.join(", ") : "—"
      };
    };

    const listaPadrao = [...porEquipe.values()]
      .map(e => ({ ...e, total: e.comercial + e.emergencial + e.miscelanea, ...nomesResponsaveis(e.prefixo) }))
      .sort((a, b) => b.total - a.total);

    const colunas = [
      { key: "prefixo", label: "Prefixo", tipo: "texto" },
      { key: "fiscais", label: "Fiscal(is)", tipo: "texto" },
      { key: "lideres", label: "Líder(es)", tipo: "texto" },
      { key: "comercial", label: "Comercial", tipo: "numero" },
      { key: "emergencial", label: "Emergencial", tipo: "numero" },
      { key: "miscelanea", label: "Miscelânea", tipo: "numero" },
      { key: "total", label: "Total", tipo: "numero" }
    ];
    const lista = this.ordenarLinhas("ranking", listaPadrao, colunas);

    const panel = Utils.el("div", { class: "panel" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Ranking de Produção por Equipe"),
      Utils.el("span", { class: "tag" }, `${lista.length} equipe(s)`)
    ]));

    if (lista.length === 0) {
      panel.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-chart-column" }),
        Utils.el("h3", {}, "Nenhum registro de produção no período selecionado"),
        Utils.el("p", {}, "Ajuste os filtros ou aguarde a importação das bases pelo administrador.")
      ]));
      return panel;
    }

    const wrap = Utils.el("div", { class: "checklist-wrap" });
    const table = Utils.el("table");
    const headCells = [Utils.el("th", {}, "#")];
    colunas.forEach(col => headCells.push(this.thOrdenavel("ranking", col, container)));
    table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, headCells)]));
    const tbody = Utils.el("tbody");
    lista.forEach((e, idx) => {
      tbody.appendChild(Utils.el("tr", {}, [
        Utils.el("td", {}, [Utils.el("span", { class: "rank-badge" }, String(idx + 1))]),
        Utils.el("td", {}, [Utils.el("b", {}, e.prefixo)]),
        Utils.el("td", {}, e.fiscais),
        Utils.el("td", {}, e.lideres),
        Utils.el("td", { class: "mono" }, String(e.comercial)),
        Utils.el("td", { class: "mono" }, String(e.emergencial)),
        Utils.el("td", { class: "mono" }, String(e.miscelanea)),
        Utils.el("td", { class: "mono" }, [Utils.el("b", {}, String(e.total))])
      ]));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);
    return panel;
  },

  // ------------------------------------------------------------------
  // Detalhe por tipo (+ Resumo de Turno por Equipe / Dia)
  // ------------------------------------------------------------------
  painelDetalhe(tipo, registros, container) {
    const cfg = this.TIPOS[tipo];
    const wrapFrag = Utils.el("div", {});

    wrapFrag.appendChild(this.painelResumo(tipo, registros, container));

    const panel = Utils.el("div", { class: "panel" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, `Detalhamento — ${cfg.label}`),
      Utils.el("span", { class: "tag" }, `${registros.length} registro(s)`)
    ]));

    if (registros.length === 0) {
      panel.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: `fa-solid ${cfg.icon}` }),
        Utils.el("h3", {}, "Nenhum registro encontrado"),
        Utils.el("p", {}, "Ajuste os filtros ou aguarde a importação da base pelo administrador.")
      ]));
      wrapFrag.appendChild(panel);
      return wrapFrag;
    }

    const tabelaId = `detalhe_${tipo}`;
    const colunas = [{ key: "prefixo", label: "Prefixo", tipo: "texto" }]
      .concat(cfg.campos.map(([col, label, kind]) => ({ key: col, label, tipo: kind === "num" ? "numero" : "texto" })));

    const ordenadosPorData = [...registros].sort((a, b) => (b.dataRef || "").localeCompare(a.dataRef || ""));
    const ordenados = this.ordenarLinhas(tabelaId, ordenadosPorData, colunas);

    const pagina = Math.min(this.paginas[tipo] || 1, Math.max(1, Math.ceil(ordenados.length / this.PAGE_SIZE)));
    this.paginas[tipo] = pagina;
    const inicio = (pagina - 1) * this.PAGE_SIZE;
    const pageItems = ordenados.slice(inicio, inicio + this.PAGE_SIZE);
    const totalPaginas = Math.max(1, Math.ceil(ordenados.length / this.PAGE_SIZE));

    const wrap = Utils.el("div", { class: "checklist-wrap" });
    const table = Utils.el("table");
    const headCells = colunas.map(col => this.thOrdenavel(tabelaId, col, container));
    table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, headCells)]));

    const tbody = Utils.el("tbody");
    pageItems.forEach(r => {
      const cells = [Utils.el("td", {}, [Utils.el("b", {}, r.prefixo)])];
      cfg.campos.forEach(([col, , kind]) => {
        const v = r[col];
        let texto = "—";
        if (v !== null && v !== undefined) {
          if (kind === "datetime") texto = Utils.formatDateTime(v);
          else texto = String(v);
        }
        cells.push(Utils.el("td", { class: kind === "num" || kind === "datetime" ? "mono" : "" }, texto));
      });
      tbody.appendChild(Utils.el("tr", {}, cells));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);

    const pagBar = Utils.el("div", { class: "flex items-center gap-8 mt-8", style: "justify-content:flex-end;" });
    const btnAnt = Utils.el("button", { class: "btn btn-ghost btn-sm" }, "‹ Anterior");
    if (pagina <= 1) btnAnt.setAttribute("disabled", "disabled"); else btnAnt.onclick = () => { this.paginas[tipo] = pagina - 1; this.render(container); };
    const btnProx = Utils.el("button", { class: "btn btn-ghost btn-sm" }, "Próxima ›");
    if (pagina >= totalPaginas) btnProx.setAttribute("disabled", "disabled"); else btnProx.onclick = () => { this.paginas[tipo] = pagina + 1; this.render(container); };
    pagBar.appendChild(btnAnt);
    pagBar.appendChild(Utils.el("span", { class: "text-muted mono", style: "font-size:.8rem;" }, `Página ${pagina} de ${totalPaginas}`));
    pagBar.appendChild(btnProx);
    panel.appendChild(pagBar);

    wrapFrag.appendChild(panel);
    return wrapFrag;
  },

  /** Resumo por equipe/dia (quantidade de serviços + médias), para as 3 abas de detalhamento. */
  painelResumo(tipo, registros, container) {
    const cfg = this.TIPOS[tipo];
    const grupos = new Map();
    registros.forEach(r => {
      if (!r.dataRef) return;
      const key = `${r.prefixo}|${r.dataRef}`;
      if (!grupos.has(key)) grupos.set(key, { prefixo: r.prefixo, data: r.dataRef, qtd: 0, km: 0, tmdSum: 0, tmdN: 0, tmeSum: 0, tmeN: 0 });
      const g = grupos.get(key);
      g.qtd++;
      if (typeof r.KM_PERCORRIDO === "number") g.km += r.KM_PERCORRIDO;
      if (typeof r.TMD === "number") { g.tmdSum += r.TMD; g.tmdN++; }
      if (typeof r.TME === "number") { g.tmeSum += r.TME; g.tmeN++; }
    });

    const linhas = [...grupos.values()].map(g => ({
      prefixo: g.prefixo, data: g.data, qtd: g.qtd,
      km: g.km, tmdMedio: g.tmdN ? g.tmdSum / g.tmdN : null, tmeMedio: g.tmeN ? g.tmeSum / g.tmeN : null
    }));

    const colunas = [
      { key: "data", label: "Data", tipo: "texto" },
      { key: "prefixo", label: "Prefixo", tipo: "texto" },
      { key: "qtd", label: "Qtd. Serviços", tipo: "numero" }
    ];
    if (cfg.resumoCampos.includes("km")) colunas.push({ key: "km", label: "KM Percorrido", tipo: "numero" });
    if (cfg.resumoCampos.includes("tmd")) colunas.push({ key: "tmdMedio", label: "TMD Médio", tipo: "numero" });
    if (cfg.resumoCampos.includes("tme")) colunas.push({ key: "tmeMedio", label: "TME Médio", tipo: "numero" });

    const panel = Utils.el("div", { class: "panel mb-16" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Resumo de Turno por Equipe / Dia"),
      Utils.el("span", { class: "tag" }, `${linhas.length} registro(s)`)
    ]));

    if (linhas.length === 0) {
      panel.appendChild(Utils.el("p", { class: "text-muted" }, "Sem dados suficientes para o resumo no período selecionado."));
      return panel;
    }

    const tabelaId = `resumo_${tipo}`;
    const padrao = [...linhas].sort((a, b) => b.data.localeCompare(a.data) || a.prefixo.localeCompare(b.prefixo));
    const linhasOrdenadas = this.ordenarLinhas(tabelaId, padrao, colunas);

    const wrap = Utils.el("div", { class: "checklist-wrap" });
    const table = Utils.el("table");
    table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, colunas.map(col => this.thOrdenavel(tabelaId, col, container)))]));
    const tbody = Utils.el("tbody");
    linhasOrdenadas.forEach(g => {
      const cells = [];
      colunas.forEach(col => {
        if (col.key === "data") cells.push(Utils.el("td", { class: "mono" }, g.data ? Utils.formatDate(g.data) : "—"));
        else if (col.key === "prefixo") cells.push(Utils.el("td", {}, [Utils.el("b", {}, g.prefixo)]));
        else if (col.key === "qtd") cells.push(Utils.el("td", { class: "mono" }, String(g.qtd)));
        else if (col.key === "km") cells.push(Utils.el("td", { class: "mono" }, g.km ? `${g.km.toFixed(1)} km` : "—"));
        else if (col.key === "tmdMedio") cells.push(Utils.el("td", { class: "mono" }, g.tmdMedio !== null ? g.tmdMedio.toFixed(1) : "—"));
        else if (col.key === "tmeMedio") cells.push(Utils.el("td", { class: "mono" }, g.tmeMedio !== null ? g.tmeMedio.toFixed(1) : "—"));
      });
      tbody.appendChild(Utils.el("tr", {}, cells));
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    panel.appendChild(wrap);
    return panel;
  }
};
