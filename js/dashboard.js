/**
 * ==========================================================================
 * DASHBOARD EXECUTIVO
 * ==========================================================================
 */

const DashboardPage = {
  charts: {},

  destroyCharts() {
    Object.values(this.charts).forEach(c => c && c.destroy());
    this.charts = {};
  },

  render(container) {
    this.destroyCharts();
    const cadastros = DB.getCadastros();
    const inspecoes = DB.getInspecoes();
    const fiscais = DB.getFiscais().filter(f => f.perfil === "fiscal");

    const cadastroIdsVistoriados = new Set(inspecoes.map(i => i.cadastroId));
    const totalEquipes = cadastros.length;
    const vistoriadas = cadastros.filter(c => cadastroIdsVistoriados.has(c.id)).length;
    const pendentes = totalEquipes - vistoriadas;
    const cobertura = totalEquipes ? Math.round((vistoriadas / totalEquipes) * 100) : 0;

    const totalFotos = cadastros.reduce((acc, c) => {
      let n = Object.values(c.veiculo?.fotos || {}).filter(Boolean).length;
      if (c.comunicacao?.foto) n += 1;
      if (c.fotoEquipe) n += 1;
      return acc + n;
    }, 0) + inspecoes.reduce((acc, i) => {
      const epi = (i.epiPorColaborador || []).reduce((a, c) => a + c.itens.filter(it => it.foto).length, 0);
      const epc = i.epc ? i.epc.itens.filter(it => it.foto).length : 0;
      return acc + epi + epc;
    }, 0);

    const hojeStr = new Date().toISOString().slice(0, 10);
    const hoje = inspecoes.filter(i => i.dataInspecao === hojeStr).length;
    const itensPendentes = inspecoes.reduce((acc, i) => acc + Utils.contarPendencias(i).pendentes, 0);

    // Cada placa é 1 veículo; uma mesma placa pode ter sido usada sob mais
    // de um prefixo (equipes diferentes, dias diferentes).
    const placaParaPrefixos = new Map();
    cadastros.forEach(c => {
      const placa = (c.veiculo?.placa || "").trim().toUpperCase();
      const prefixo = (c.prefixo || "").trim().toUpperCase();
      if (!placa || !prefixo) return;
      if (!placaParaPrefixos.has(placa)) placaParaPrefixos.set(placa, new Set());
      placaParaPrefixos.get(placa).add(prefixo);
    });
    const totalVeiculos = placaParaPrefixos.size;
    const totalPrefixos = new Set(cadastros.map(c => (c.prefixo || "").trim().toUpperCase()).filter(Boolean)).size;
    const placasComMultiplosPrefixos = [...placaParaPrefixos.entries()]
      .filter(([, prefixos]) => prefixos.size > 1)
      .map(([placa, prefixos]) => ({ placa, prefixos: [...prefixos].sort() }))
      .sort((a, b) => b.prefixos.length - a.prefixos.length);

    container.innerHTML = "";
    container.classList.add("fade-in");

    const refreshRow = Utils.el("div", { class: "flex items-center", style: "justify-content:flex-end;margin-bottom:12px;" }, [
      Utils.el("button", {
        class: "btn btn-ghost btn-sm",
        onclick: () => { this.render(container); Utils.toast("Dashboard atualizado."); }
      }, [Utils.el("i", { class: "fa-solid fa-rotate" }), " Atualizar agora"])
    ]);
    container.appendChild(refreshRow);

    // ---------- KPIs ----------
    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    const kpis = [
      { icon: "fa-people-group", label: "Equipes cadastradas", value: totalEquipes, cls: "c-blue" },
      { icon: "fa-clipboard-check", label: "Equipes vistoriadas", value: vistoriadas, cls: "c-green" },
      { icon: "fa-file-circle-check", label: "Inspeções realizadas", value: inspecoes.length, cls: "c-teal" },
      { icon: "fa-percent", label: "Cobertura", value: `${cobertura}%`, cls: "c-blue" },
      { icon: "fa-images", label: "Fotos anexadas", value: totalFotos, cls: "c-amber" },
      { icon: "fa-calendar-day", label: "Inspeções hoje", value: hoje, cls: "c-green" },
      { icon: "fa-hourglass-half", label: "Equipes pendentes", value: pendentes, cls: "c-amber" },
      { icon: "fa-triangle-exclamation", label: "Não conformidades pendentes", value: itensPendentes, cls: "c-amber" },
      { icon: "fa-truck-pickup", label: "Veículos cadastrados (placas distintas)", value: totalVeiculos, cls: "c-teal" },
      { icon: "fa-hashtag", label: "Prefixos cadastrados (distintos)", value: totalPrefixos, cls: "c-blue" }
    ];
    kpis.forEach(k => {
      kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
        Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
        Utils.el("div", { class: "value" }, String(k.value)),
        Utils.el("div", { class: "label" }, k.label)
      ]));
    });
    container.appendChild(kpiGrid);

    // ---------- Placas com mais de um prefixo ----------
    const panelPlacas = Utils.el("div", { class: "panel mb-16" });
    panelPlacas.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Veículos (Placas) com Mais de um Prefixo"),
      Utils.el("span", { class: "tag" }, `${placasComMultiplosPrefixos.length} placa(s)`)
    ]));
    if (placasComMultiplosPrefixos.length === 0) {
      panelPlacas.appendChild(Utils.el("p", { class: "text-muted" }, "Nenhuma placa foi usada sob mais de um prefixo até agora."));
    } else {
      const wrapPlacas = Utils.el("div", { class: "checklist-wrap" });
      const tablePlacas = Utils.el("table");
      tablePlacas.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "Placa"), Utils.el("th", {}, "Qtd. de Prefixos"), Utils.el("th", {}, "Prefixos utilizados")
      ])]));
      const tbodyPlacas = Utils.el("tbody");
      placasComMultiplosPrefixos.forEach(p => {
        tbodyPlacas.appendChild(Utils.el("tr", {}, [
          Utils.el("td", { class: "mono" }, [Utils.el("b", {}, p.placa)]),
          Utils.el("td", { class: "mono" }, String(p.prefixos.length)),
          Utils.el("td", {}, p.prefixos.join(", "))
        ]));
      });
      tablePlacas.appendChild(tbodyPlacas);
      wrapPlacas.appendChild(tablePlacas);
      panelPlacas.appendChild(wrapPlacas);
    }
    container.appendChild(panelPlacas);

    // ---------- Panels ----------
    const grid = Utils.el("div", { class: "panel-grid" });

    grid.appendChild(this.panel("span-7", "Inspeções por Fiscal", '<canvas id="chFiscal"></canvas>'));
    grid.appendChild(this.panel("span-5", "Cobertura das Equipes", '<canvas id="chCobertura"></canvas>'));
    grid.appendChild(this.panel("span-4", "Processo de Atuação", '<canvas id="chProcesso"></canvas>'));
    grid.appendChild(this.panel("span-4", "Tipo de Veículo", '<canvas id="chVeiculo"></canvas>'));
    grid.appendChild(this.panel("span-4", "Tipo de Comunicação", '<canvas id="chComunicacao"></canvas>'));
    grid.appendChild(this.panel("span-12", "Inspeções por Município", '<div id="mapMunicipio" style="height:280px;border-radius:12px;overflow:hidden;"></div>'));
    grid.appendChild(this.panel("span-12", "Ranking dos Fiscais", '<div id="rankingTableWrap"></div>'));

    container.appendChild(grid);

    // ---------- Chart data ----------
    // Cada gráfico/mapa/tabela é isolado em try/catch: se um falhar (ex: a
    // biblioteca de gráficos não carregou por causa da rede), os demais
    // continuam aparecendo normalmente, em vez de travar o dashboard inteiro.
    try {
      const porFiscal = fiscais.map(f => ({ nome: f.nome.split(" ")[0], qtd: inspecoes.filter(i => i.fiscalId === f.id).length }));
      this.charts.fiscal = new Chart(Utils.qs("#chFiscal"), {
        type: "bar",
        data: {
          labels: porFiscal.map(f => f.nome),
          datasets: [{ label: "Inspeções", data: porFiscal.map(f => f.qtd), backgroundColor: "#0A4DA6", borderRadius: 6, maxBarThickness: 28 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    } catch (err) { console.error("Erro ao montar gráfico 'Inspeções por Fiscal':", err); }

    try {
      this.charts.cobertura = new Chart(Utils.qs("#chCobertura"), {
        type: "doughnut",
        data: { labels: ["Vistoriadas", "Pendentes"], datasets: [{ data: [vistoriadas, pendentes], backgroundColor: ["#00A651", "#E1E8F0"], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "68%", plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 11 } } } } }
      });
    } catch (err) { console.error("Erro ao montar gráfico 'Cobertura das Equipes':", err); }

    try {
      const processos = ["Comercial", "Emergencial", "Comercial GD", "Corte/Religa"];
      const procCounts = processos.map(p => inspecoes.filter(i => i.processo === p).length);
      this.charts.processo = new Chart(Utils.qs("#chProcesso"), {
        type: "doughnut",
        data: { labels: processos, datasets: [{ data: procCounts, backgroundColor: ["#0A4DA6", "#00A651", "#00C2A8", "#F5A623"], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }
      });
    } catch (err) { console.error("Erro ao montar gráfico 'Processo de Atuação':", err); }

    try {
      const veiculos = ["Hilux 4x4", "Strada 4x2", "Moto", "Cesto Aéreo"];
      const veicCounts = veiculos.map(v => inspecoes.filter(i => i.veiculoTipo === v).length);
      this.charts.veiculo = new Chart(Utils.qs("#chVeiculo"), {
        type: "bar",
        data: { labels: veiculos, datasets: [{ data: veicCounts, backgroundColor: "#00A651", borderRadius: 6, maxBarThickness: 32 }] },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } } } }
      });
    } catch (err) { console.error("Erro ao montar gráfico 'Tipo de Veículo':", err); }

    try {
      const comunicacoes = ["STARLINK", "AUTOTRACK", "Celular"];
      const comCounts = comunicacoes.map(c => inspecoes.filter(i => i.comunicacaoTipo === c).length);
      this.charts.comunicacao = new Chart(Utils.qs("#chComunicacao"), {
        type: "pie",
        data: { labels: comunicacoes, datasets: [{ data: comCounts, backgroundColor: ["#0A4DA6", "#00C2A8", "#F5A623"], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } } }
      });
    } catch (err) { console.error("Erro ao montar gráfico 'Tipo de Comunicação':", err); }

    // ---------- Map ----------
    setTimeout(() => {
      try { this.renderMap(cadastros, inspecoes); }
      catch (err) { console.error("Erro ao montar o mapa 'Inspeções por Município':", err); }
    }, 50);

    // ---------- Ranking ----------
    try {
      const rankWrap = Utils.qs("#rankingTableWrap");
      const ranking = fiscais.map(f => {
        const cadastrosFiscal = cadastros.filter(c => c.fiscalId === f.id).length;
        const qtd = inspecoes.filter(i => i.fiscalId === f.id).length;
        return { nome: f.nome, cadastros: cadastrosFiscal, qtd };
      }).sort((a, b) => b.qtd - a.qtd);

      const table = Utils.el("table");
      table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "#"), Utils.el("th", {}, "Fiscal"), Utils.el("th", {}, "Equipes Cadastradas"), Utils.el("th", {}, "Inspeções Realizadas")
      ])]));
      const tbody = Utils.el("tbody");
      ranking.forEach((r, idx) => {
        tbody.appendChild(Utils.el("tr", {}, [
          Utils.el("td", {}, [Utils.el("span", { class: "rank-badge" }, String(idx + 1))]),
          Utils.el("td", {}, r.nome),
          Utils.el("td", { class: "mono" }, String(r.cadastros)),
          Utils.el("td", { class: "mono" }, String(r.qtd))
        ]));
      });
      table.appendChild(tbody);
      rankWrap.appendChild(table);
    } catch (err) {
      console.error("Erro ao montar o 'Ranking dos Fiscais':", err);
    }
  },

  panel(span, title, innerHTML) {
    const p = Utils.el("div", { class: `panel ${span}` });
    p.appendChild(Utils.el("div", { class: "panel-head" }, [Utils.el("h3", {}, title)]));
    const body = Utils.el("div", { html: innerHTML });
    p.appendChild(body);
    return p;
  },

  renderMap(cadastros, inspecoes) {
    const mapDiv = Utils.qs("#mapMunicipio");
    if (!mapDiv || mapDiv._leaflet_id) return;
    const map = L.map(mapDiv, { scrollWheelZoom: false }).setView([-16.68, -49.35], 8); // região de Goiás
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap" }).addTo(map);

    const munCoords = {
      "Aparecida de Goiânia": [-16.8236, -49.2442],
      "Bonfinópolis": [-16.5978, -49.0733],
      "Bela Vista de Goiás": [-16.9744, -48.9678],
      "Inhumas": [-16.3597, -49.4953],
      "Nerópolis": [-16.4083, -49.2172],
      "Senador Canedo": [-16.7058, -49.0939],
      "Silvânia": [-16.6547, -48.6108],
      "Varjão": [-15.6889, -49.1103]
    };

    const municipiosPresentes = new Set([...cadastros.map(c => c.municipio), ...Object.keys(munCoords)]);

    municipiosPresentes.forEach(nome => {
      const coords = munCoords[nome];
      if (!coords) return; // sem coordenada conhecida para este município (digitado livremente)
      const n = inspecoes.filter(i => i.municipio === nome).length;
      const totalCad = cadastros.filter(c => c.municipio === nome).length;
      if (totalCad === 0) return;
      const radius = 8 + n * 2.2;
      L.circleMarker(coords, {
        radius, color: "#0A4DA6", weight: 1, fillColor: "#00A651", fillOpacity: 0.55
      }).addTo(map).bindPopup(`<b>${nome}</b><br>${n} inspeções · ${totalCad} equipes cadastradas`);
    });
  }
};
