/**
 * ==========================================================================
 * ANÁLISES — cruza Produção + Cadastros + Inspeções
 * ==========================================================================
 * Usado no Painel do Fiscal e no Painel do Líder para mostrar, além das
 * listas simples, alguns indicadores calculados a partir dos dados já
 * existentes: produção das equipes (js/producao.js), cadastros de equipe e
 * inspeções de EPI/EPC.
 * ==========================================================================
 */

const Analises = {
  /**
   * @param {Set<string>|string[]} prefixos  Prefixos das equipes no escopo (do fiscal ou do líder)
   * @param {Array} cadastros                Cadastros já filtrados para o escopo
   * @param {Array} inspecoes                Inspeções já filtradas para o escopo
   */
  calcular(prefixos, cadastros, inspecoes) {
    const setPrefixos = prefixos instanceof Set ? prefixos : new Set(prefixos);
    const producao = DB.getProducao().filter(r => setPrefixos.has(r.prefixo));

    const totalPorTipo = { comercial: 0, emergencial: 0, miscelanea: 0 };
    producao.forEach(r => { if (totalPorTipo[r.tipo] !== undefined) totalPorTipo[r.tipo]++; });

    const porEquipe = new Map();
    producao.forEach(r => porEquipe.set(r.prefixo, (porEquipe.get(r.prefixo) || 0) + 1));
    const rankingEquipes = [...porEquipe.entries()].sort((a, b) => b[1] - a[1]);
    const equipeTop = rankingEquipes.length ? { prefixo: rankingEquipes[0][0], qtd: rankingEquipes[0][1] } : null;

    const comEfetividade = producao.filter(r => r.EFETIVIDADE_VISITA || r.EFETIVIDADE);
    const efetivos = comEfetividade.filter(r => String(r.EFETIVIDADE_VISITA || r.EFETIVIDADE || "").toUpperCase().includes("EFETIVA")).length;
    const pctEfetividade = comEfetividade.length ? Math.round((efetivos / comEfetividade.length) * 100) : null;

    const comTmd = producao.filter(r => typeof r.TMD === "number");
    const tmdMedio = comTmd.length ? comTmd.reduce((s, r) => s + r.TMD, 0) / comTmd.length : null;
    const comTme = producao.filter(r => typeof r.TME === "number");
    const tmeMedio = comTme.length ? comTme.reduce((s, r) => s + r.TME, 0) / comTme.length : null;

    const cadastroIdsVistoriados = new Set(inspecoes.map(i => i.cadastroId));
    const pendentes = cadastros.length - cadastros.filter(c => cadastroIdsVistoriados.has(c.id)).length;

    let itensChecados = 0, itensDanificados = 0, itensPendentes = 0;
    inspecoes.forEach(insp => {
      const { total, pendentes: pend } = Utils.contarPendencias(insp);
      itensDanificados += total;
      itensPendentes += pend;
      itensChecados += [
        ...(insp.epiPorColaborador || []).flatMap(c => c.itens),
        ...(insp.epc ? insp.epc.itens : [])
      ].length;
    });
    const pctConformidade = itensChecados ? Math.round(((itensChecados - itensDanificados) / itensChecados) * 100) : null;

    return {
      totalProducao: producao.length, totalPorTipo, equipeTop,
      pctEfetividade, tmdMedio, tmeMedio,
      totalCadastros: cadastros.length, pendentes,
      totalInspecoes: inspecoes.length, itensDanificados, itensPendentes, pctConformidade
    };
  },

  /** Monta o painel de Análises (KPIs + um parágrafo de destaque) pronto para inserir na página. */
  renderPainel(dados, titulo) {
    const panel = Utils.el("div", { class: "panel mb-16" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, titulo || "Análises"),
      Utils.el("span", { class: "tag" }, "Produção + Cadastros + Inspeções")
    ]));

    if (dados.totalProducao === 0 && dados.totalCadastros === 0) {
      panel.appendChild(Utils.el("p", { class: "text-muted" }, "Ainda não há dados suficientes para gerar análises."));
      return panel;
    }

    const cards = [
      { icon: "fa-list-check", label: "Atendimentos no período (Produção)", value: dados.totalProducao, cls: "c-blue" },
      { icon: "fa-id-card", label: "Equipes cadastradas", value: dados.totalCadastros, cls: "c-teal" },
      { icon: "fa-hourglass-half", label: "Equipes pendentes de vistoria", value: dados.pendentes, cls: "c-amber" }
    ];
    if (dados.pctEfetividade !== null) cards.push({ icon: "fa-bullseye", label: "Efetividade média dos atendimentos", value: `${dados.pctEfetividade}%`, cls: "c-green" });
    if (dados.pctConformidade !== null) cards.push({ icon: "fa-shield-halved", label: "Conformidade de EPI/EPC nas inspeções", value: `${dados.pctConformidade}%`, cls: "c-green" });
    if (dados.equipeTop) cards.push({ icon: "fa-trophy", label: `Equipe mais produtiva (${dados.equipeTop.qtd} atendimento(s))`, value: dados.equipeTop.prefixo, cls: "c-blue" });

    const grid = Utils.el("div", { class: "kpi-grid" });
    cards.forEach(k => {
      grid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
        Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
        Utils.el("div", { class: "value" }, String(k.value)),
        Utils.el("div", { class: "label" }, k.label)
      ]));
    });
    panel.appendChild(grid);

    const partes = [];
    partes.push(`${dados.totalPorTipo.comercial} comercial(is), ${dados.totalPorTipo.emergencial} emergencial(is) e ${dados.totalPorTipo.miscelanea} miscelânea(s)`);
    if (dados.tmdMedio !== null) partes.push(`TMD médio de ${dados.tmdMedio.toFixed(1)}`);
    if (dados.tmeMedio !== null) partes.push(`TME médio de ${dados.tmeMedio.toFixed(1)}`);
    if (dados.itensPendentes > 0) partes.push(`${dados.itensPendentes} item(ns) de EPI/EPC danificado(s) ainda pendente(s) de resolução`);
    panel.appendChild(Utils.el("p", { class: "text-muted mt-8", style: "font-size:.85rem;" }, "Resumo do período: " + partes.join(" · ") + "."));

    return panel;
  }
};
