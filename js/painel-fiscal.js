/**
 * ==========================================================================
 * PAINEL FISCAL — Minhas Equipes e Minhas Inspeções
 * ==========================================================================
 * Visão pessoal do fiscal: todas as equipes que ele cadastrou e todas as
 * inspeções que ele já realizou. Uma equipe pode ser inspecionada mais de
 * uma vez ao longo do tempo.
 * ==========================================================================
 */

const FiscalPanelPage = {
  activeTab: "equipes",

  render(container) {
    const user = Auth.current();
    const meusCadastros = DB.getCadastros().filter(c => c.fiscalId === user.id).sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));
    const minhasInspecoes = DB.getInspecoes().filter(i => i.fiscalId === user.id).sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));
    const cadastroIdsVistoriados = new Set(DB.getInspecoes().map(i => i.cadastroId));

    container.innerHTML = "";
    container.classList.add("fade-in");

    // ---------- KPIs ----------
    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    const kpis = [
      { icon: "fa-id-card", label: "Equipes cadastradas por mim", value: meusCadastros.length, cls: "c-blue" },
      { icon: "fa-clipboard-check", label: "Inspeções realizadas por mim", value: minhasInspecoes.length, cls: "c-green" },
      { icon: "fa-hourglass-half", label: "Minhas equipes pendentes", value: meusCadastros.filter(c => !cadastroIdsVistoriados.has(c.id)).length, cls: "c-amber" }
    ];
    kpis.forEach(k => {
      kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
        Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
        Utils.el("div", { class: "value" }, String(k.value)),
        Utils.el("div", { class: "label" }, k.label)
      ]));
    });
    container.appendChild(kpiGrid);

    // ---------- Aviso de Ordens de Inspeção pendentes ----------
    const ordensPendentes = DB.getOrdens().filter(o => o.fiscalId === user.id && (o.status === "pendente" || o.status === "recusada"));
    if (ordensPendentes.length > 0) {
      container.appendChild(Utils.el("div", { class: "panel mb-16", style: "border-left:4px solid var(--color-warning);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;" }, [
        Utils.el("div", { class: "flex items-center gap-8" }, [
          Utils.el("i", { class: "fa-solid fa-bolt", style: "color:var(--color-warning);font-size:1.2rem;" }),
          Utils.el("div", {}, [
            Utils.el("b", {}, `${ordensPendentes.length} Ordem(ns) de Inspeção de Ativo aguardando você`),
            Utils.el("div", { class: "text-muted", style: "font-size:.82rem;" }, "Seu líder enviou inspeções de transformador, chave de proteção ou unidade consumidora para você realizar.")
          ])
        ]),
        Utils.el("button", { class: "btn btn-primary btn-sm", onclick: () => Router.go("ordens") }, [Utils.el("i", { class: "fa-solid fa-arrow-right" }), " Ver Ordens"])
      ]));
    }

    // ---------- Análises (Produção + Cadastros + Inspeções) ----------
    const prefixosDoFiscal = new Set(meusCadastros.map(c => (c.prefixo || "").trim().toUpperCase()));
    const dadosAnalise = Analises.calcular(prefixosDoFiscal, meusCadastros, minhasInspecoes);
    container.appendChild(Analises.renderPainel(dadosAnalise, "Minhas Análises"));

    // ---------- Tabs ----------
    const tabs = Utils.el("div", { class: "gallery-tabs" });
    [["equipes", "Minhas Equipes Cadastradas", "fa-id-card"], ["inspecoes", "Minhas Inspeções Realizadas", "fa-clipboard-check"]].forEach(([key, label, icon]) => {
      tabs.appendChild(Utils.el("button", {
        class: "gallery-tab" + (this.activeTab === key ? " active" : ""),
        onclick: () => { this.activeTab = key; this.render(container); }
      }, [Utils.el("i", { class: `fa-solid ${icon}` }), " " + label]));
    });
    container.appendChild(tabs);

    const panel = Utils.el("div", { class: "panel" });

    if (this.activeTab === "equipes") {
      panel.appendChild(Utils.el("div", { class: "panel-head" }, [
        Utils.el("h3", {}, "Minhas Equipes Cadastradas"),
        Utils.el("span", { class: "tag" }, `${meusCadastros.length} equipe(s)`)
      ]));

      if (meusCadastros.length === 0) {
        panel.appendChild(Utils.el("div", { class: "empty-state" }, [
          Utils.el("i", { class: "fa-solid fa-id-card" }),
          Utils.el("h3", {}, "Você ainda não cadastrou nenhuma equipe"),
          Utils.el("p", {}, 'Acesse "Cadastro de Equipe" no menu ao lado para começar.')
        ]));
      } else {
        const table = Utils.el("table");
        table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
          Utils.el("th", {}, "Prefixo"), Utils.el("th", {}, "Placa"), Utils.el("th", {}, "Empresa"), Utils.el("th", {}, "Município"), Utils.el("th", {}, "Data do cadastro"),
          Utils.el("th", {}, "Status"), Utils.el("th", {}, "")
        ])]));
        const tbody = Utils.el("tbody");
        meusCadastros.forEach(c => {
          const vistoriada = cadastroIdsVistoriados.has(c.id);
          tbody.appendChild(Utils.el("tr", {}, [
            Utils.el("td", {}, [Utils.el("b", {}, c.prefixo)]),
            Utils.el("td", { class: "mono" }, c.veiculo?.placa || "—"),
            Utils.el("td", {}, c.empresa || "—"),
            Utils.el("td", {}, c.municipio),
            Utils.el("td", { class: "mono" }, Utils.formatDateTime(c.dataHoraISO)),
            Utils.el("td", {}, [vistoriada ? Utils.el("span", { class: "badge badge-success" }, "Vistoriada") : Utils.el("span", { class: "badge badge-warning" }, "Pendente")]),
            Utils.el("td", { class: "flex gap-8", style: "flex-wrap:wrap;" }, [
              Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => LiderPage.openCadastroDetail(c, DB.getInspecoes().filter(i => i.cadastroId === c.id)) }, [Utils.el("i", { class: "fa-solid fa-eye" }), " Ver"]),
              Utils.el("button", {
                class: "btn btn-secondary btn-sm",
                onclick: () => CadastroPage.abrirGerenciarEletricistas(c, container, () => this.render(container))
              }, [Utils.el("i", { class: "fa-solid fa-users-gear" }), " Eletricistas"]),
              Utils.el("button", {
                class: "btn btn-secondary btn-sm",
                onclick: () => { InspectionPage.startFor(c.id); Router.go("inspecao"); }
              }, [Utils.el("i", { class: "fa-solid fa-clipboard-list" }), " Inspecionar"])
            ])
          ]));
        });
        table.appendChild(tbody);
        panel.appendChild(table);
      }
    } else {
      panel.appendChild(Utils.el("div", { class: "panel-head" }, [
        Utils.el("h3", {}, "Minhas Inspeções Realizadas"),
        Utils.el("span", { class: "tag" }, `${minhasInspecoes.length} inspeção(ões)`)
      ]));

      if (minhasInspecoes.length === 0) {
        panel.appendChild(Utils.el("div", { class: "empty-state" }, [
          Utils.el("i", { class: "fa-solid fa-clipboard-check" }),
          Utils.el("h3", {}, "Você ainda não realizou nenhuma inspeção"),
          Utils.el("p", {}, 'Acesse "Inspeção de Equipe" no menu ao lado para começar.')
        ]));
      } else {
        const table = Utils.el("table");
        table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
          Utils.el("th", {}, "Data da Inspeção"), Utils.el("th", {}, "Equipe"), Utils.el("th", {}, "Município"),
          Utils.el("th", {}, "Situação"), Utils.el("th", {}, "")
        ])]));
        const tbody = Utils.el("tbody");
        minhasInspecoes.forEach(i => {
          const { total, pendentes } = Utils.contarPendencias(i);
          tbody.appendChild(Utils.el("tr", {}, [
            Utils.el("td", { class: "mono" }, i.dataInspecao ? Utils.formatDate(i.dataInspecao) : "—"),
            Utils.el("td", {}, [Utils.el("b", {}, i.equipePrefixo)]),
            Utils.el("td", {}, i.municipio),
            Utils.el("td", {}, [
              total === 0
                ? Utils.el("span", { class: "badge badge-success" }, "Tudo de acordo")
                : pendentes > 0
                  ? Utils.el("span", { class: "badge badge-danger" }, `${pendentes} pendente(s)`)
                  : Utils.el("span", { class: "badge badge-success" }, "Resolvido")
            ]),
            Utils.el("td", {}, [Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => HistoryPage.openDetail(i) }, [Utils.el("i", { class: "fa-solid fa-eye" }), " Ver"])])
          ]));
        });
        table.appendChild(tbody);
        panel.appendChild(table);
      }
    }

    container.appendChild(panel);
  }
};
