/**
 * ==========================================================================
 * PAINEL DO LÍDER
 * ==========================================================================
 * Mostra, para o líder logado, todos os cadastros de equipe e inspeções
 * realizados pelos fiscais vinculados a ele (campo liderId em /fiscais).
 * O administrador também pode acessar esta tela, vendo todos os fiscais.
 * ==========================================================================
 */

const LiderPage = {
  filtroFiscal: "",
  filtroMunicipio: "",
  filtroLider: "",
  activeTab: "equipes",

  render(container) {
    const user = Auth.current();
    const meusFiscais = Auth.meusFiscais();
    const fiscalIds = new Set(meusFiscais.map(f => f.id));

    container.innerHTML = "";
    container.classList.add("fade-in");

    if (meusFiscais.length === 0) {
      container.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-user-tie" }),
        Utils.el("h3", {}, "Nenhum fiscal vinculado"),
        Utils.el("p", {}, user.perfil === "admin"
          ? 'Vá em "Usuários" e vincule fiscais a pelo menos um líder.'
          : "Peça ao administrador para vincular fiscais a você na tela \"Usuários\".")
      ]));
      return;
    }

    const cadastros = DB.getCadastros().filter(c => fiscalIds.has(c.fiscalId));
    const inspecoes = DB.getInspecoes().filter(i => cadastros.some(c => c.id === i.cadastroId));
    const cadastroIdsVistoriados = new Set(inspecoes.map(i => i.cadastroId));

    // ---------- KPIs ----------
    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    const kpis = [
      { icon: "fa-users", label: "Fiscais vinculados", value: meusFiscais.length, cls: "c-blue" },
      { icon: "fa-clipboard-list", label: "Equipes cadastradas", value: cadastros.length, cls: "c-teal" },
      { icon: "fa-clipboard-check", label: "Inspeções realizadas", value: inspecoes.length, cls: "c-green" },
      { icon: "fa-hourglass-half", label: "Equipes pendentes", value: cadastros.length - cadastroIdsVistoriados.size, cls: "c-amber" }
    ];
    kpis.forEach(k => {
      kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
        Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
        Utils.el("div", { class: "value" }, String(k.value)),
        Utils.el("div", { class: "label" }, k.label)
      ]));
    });
    container.appendChild(kpiGrid);

    // ---------- Aviso de Ordens de Inspeção aguardando revisão ----------
    const ordensParaRevisar = DB.getOrdens().filter(o => o.status === "aguardando_revisao");
    if (ordensParaRevisar.length > 0) {
      container.appendChild(Utils.el("div", { class: "panel mb-16", style: "border-left:4px solid var(--color-primary);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;" }, [
        Utils.el("div", { class: "flex items-center gap-8" }, [
          Utils.el("i", { class: "fa-solid fa-bolt", style: "color:var(--color-primary);font-size:1.2rem;" }),
          Utils.el("div", {}, [
            Utils.el("b", {}, `${ordensParaRevisar.length} Ordem(ns) de Inspeção aguardando sua revisão`),
            Utils.el("div", { class: "text-muted", style: "font-size:.82rem;" }, "Fiscais enviaram registros fotográficos e ações necessárias para você aprovar ou recusar.")
          ])
        ]),
        Utils.el("button", { class: "btn btn-primary btn-sm", onclick: () => Router.go("ordens") }, [Utils.el("i", { class: "fa-solid fa-arrow-right" }), " Revisar Agora"])
      ]));
    }

    // ---------- Painel: equipe de fiscais ----------
    const panelFiscais = Utils.el("div", { class: "panel mb-16" });
    panelFiscais.appendChild(Utils.el("div", { class: "panel-head" }, [Utils.el("h3", {}, user.perfil === "admin" ? "Todos os Fiscais" : "Minha Equipe de Fiscais")]));
    const tableFiscais = Utils.el("table");
    tableFiscais.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
      Utils.el("th", {}, "Fiscal"), Utils.el("th", {}, "Matrícula"), Utils.el("th", {}, "Equipes cadastradas"), Utils.el("th", {}, "Inspeções realizadas")
    ])]));
    const tbodyFiscais = Utils.el("tbody");
    meusFiscais.forEach(f => {
      tbodyFiscais.appendChild(Utils.el("tr", {}, [
        Utils.el("td", {}, f.nome),
        Utils.el("td", { class: "mono" }, f.matricula),
        Utils.el("td", { class: "mono" }, String(cadastros.filter(c => c.fiscalId === f.id).length)),
        Utils.el("td", { class: "mono" }, String(inspecoes.filter(i => i.fiscalId === f.id).length))
      ]));
    });
    tableFiscais.appendChild(tbodyFiscais);
    panelFiscais.appendChild(tableFiscais);
    container.appendChild(panelFiscais);

    // ---------- Análises (Produção + Cadastros + Inspeções) ----------
    const prefixosDaEquipe = new Set(cadastros.map(c => (c.prefixo || "").trim().toUpperCase()));
    const dadosAnalise = Analises.calcular(prefixosDaEquipe, cadastros, inspecoes);
    container.appendChild(Analises.renderPainel(dadosAnalise, user.perfil === "admin" ? "Análises Gerais" : "Análises da Minha Equipe"));

    // ---------- Filtros ----------
    const municipios = [...new Set(cadastros.map(c => c.municipio))].sort();
    const fiscalIdParaLiderId = new Map(DB.getFiscais().map(f => [f.id, f.liderId]));
    const bar = Utils.el("div", { class: "filter-bar" });

    if (user.perfil === "admin") {
      const lideresTodos = DB.getFiscais().filter(f => f.perfil === "lider").sort((a, b) => a.nome.localeCompare(b.nome));
      const fLider = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Líder")]);
      const selLider = Utils.el("select", {});
      selLider.appendChild(Utils.el("option", { value: "" }, "Todos"));
      lideresTodos.forEach(l => {
        const opt = Utils.el("option", { value: l.id }, l.nome);
        if (this.filtroLider === l.id) opt.selected = true;
        selLider.appendChild(opt);
      });
      selLider.addEventListener("change", (e) => { this.filtroLider = e.target.value; this.render(container); });
      fLider.appendChild(selLider);
      bar.appendChild(fLider);
    }

    const fFiscal = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Fiscal")]);
    const selFiscal = Utils.el("select", {});
    selFiscal.appendChild(Utils.el("option", { value: "" }, "Todos"));
    meusFiscais.forEach(f => {
      const opt = Utils.el("option", { value: f.nome }, f.nome);
      if (this.filtroFiscal === f.nome) opt.selected = true;
      selFiscal.appendChild(opt);
    });
    selFiscal.addEventListener("change", (e) => { this.filtroFiscal = e.target.value; this.render(container); });
    fFiscal.appendChild(selFiscal);
    bar.appendChild(fFiscal);

    const fMun = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Município")]);
    const selMun = Utils.el("select", {});
    selMun.appendChild(Utils.el("option", { value: "" }, "Todos"));
    municipios.forEach(m => {
      const opt = Utils.el("option", { value: m }, m);
      if (this.filtroMunicipio === m) opt.selected = true;
      selMun.appendChild(opt);
    });
    selMun.addEventListener("change", (e) => { this.filtroMunicipio = e.target.value; this.render(container); });
    fMun.appendChild(selMun);
    bar.appendChild(fMun);

    bar.appendChild(Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => { this.filtroFiscal = ""; this.filtroMunicipio = ""; this.filtroLider = ""; this.render(container); } }, "Limpar filtros"));
    container.appendChild(bar);

    // ---------- Abas: Equipes Cadastradas / Inspeções Realizadas ----------
    const tabs = Utils.el("div", { class: "gallery-tabs" });
    [["equipes", "Equipes Cadastradas", "fa-id-card"], ["inspecoes", "Inspeções Realizadas", "fa-clipboard-check"]].forEach(([key, label, icon]) => {
      tabs.appendChild(Utils.el("button", {
        class: "gallery-tab" + (this.activeTab === key ? " active" : ""),
        onclick: () => { this.activeTab = key; this.render(container); }
      }, [Utils.el("i", { class: `fa-solid ${icon}` }), " " + label]));
    });
    container.appendChild(tabs);

    if (this.activeTab === "equipes") {
      // ---------- Lista: Equipes Cadastradas ----------
      let cadastrosFiltrados = cadastros.filter(c => {
        if (this.filtroFiscal && c.fiscalNome !== this.filtroFiscal) return false;
        if (this.filtroMunicipio && c.municipio !== this.filtroMunicipio) return false;
        if (this.filtroLider && fiscalIdParaLiderId.get(c.fiscalId) !== this.filtroLider) return false;
        return true;
      }).sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));

      const panelCadastros = Utils.el("div", { class: "panel" });
      panelCadastros.appendChild(Utils.el("div", { class: "panel-head" }, [
        Utils.el("h3", {}, "Equipes Cadastradas"),
        Utils.el("span", { class: "tag" }, `${cadastrosFiltrados.length} equipe(s)`)
      ]));

      if (cadastrosFiltrados.length === 0) {
        panelCadastros.appendChild(Utils.el("div", { class: "empty-state" }, [
          Utils.el("i", { class: "fa-solid fa-clipboard-list" }),
          Utils.el("h3", {}, "Nenhum cadastro encontrado"),
          Utils.el("p", {}, "Ajuste os filtros acima ou aguarde os fiscais registrarem novas equipes.")
        ]));
      } else {
        const table = Utils.el("table");
        table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
          Utils.el("th", {}, "Prefixo"), Utils.el("th", {}, "Placa"), Utils.el("th", {}, "Empresa"), Utils.el("th", {}, "Fiscal"), Utils.el("th", {}, "Município"),
          Utils.el("th", {}, "Data do cadastro"), Utils.el("th", {}, "Status"), Utils.el("th", {}, "")
        ])]));
        const tbody = Utils.el("tbody");
        cadastrosFiltrados.forEach(c => {
          const vistoriada = cadastroIdsVistoriados.has(c.id);
          tbody.appendChild(Utils.el("tr", {}, [
            Utils.el("td", {}, [Utils.el("b", {}, c.prefixo)]),
            Utils.el("td", { class: "mono" }, c.veiculo?.placa || "—"),
            Utils.el("td", {}, c.empresa || "—"),
            Utils.el("td", {}, c.fiscalNome),
            Utils.el("td", {}, c.municipio),
            Utils.el("td", { class: "mono" }, Utils.formatDateTime(c.dataHoraISO)),
            Utils.el("td", {}, [vistoriada ? Utils.el("span", { class: "badge badge-success" }, "Vistoriada") : Utils.el("span", { class: "badge badge-warning" }, "Pendente")]),
            Utils.el("td", { class: "flex gap-8" }, [
              Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => this.openCadastroDetail(c, inspecoes.filter(i => i.cadastroId === c.id)) }, [Utils.el("i", { class: "fa-solid fa-eye" }), " Ver"]),
              Utils.el("button", { class: "btn btn-danger btn-sm", onclick: () => this.excluirCadastro(c, container) }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir"])
            ])
          ]));
        });
        table.appendChild(tbody);
        panelCadastros.appendChild(table);
      }
      container.appendChild(panelCadastros);
    } else {
      // ---------- Lista: Inspeções Realizadas ----------
      let inspecoesFiltradas = inspecoes.filter(i => {
        if (this.filtroFiscal && i.fiscalNome !== this.filtroFiscal) return false;
        if (this.filtroMunicipio && i.municipio !== this.filtroMunicipio) return false;
        if (this.filtroLider && fiscalIdParaLiderId.get(i.fiscalId) !== this.filtroLider) return false;
        return true;
      }).sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));

      const panelInsp = Utils.el("div", { class: "panel" });
      panelInsp.appendChild(Utils.el("div", { class: "panel-head" }, [
        Utils.el("h3", {}, "Inspeções Realizadas"),
        Utils.el("span", { class: "tag" }, `${inspecoesFiltradas.length} inspeção(ões)`)
      ]));
      if (inspecoesFiltradas.length > 0) {
        panelInsp.appendChild(Utils.el("button", {
          class: "btn btn-secondary btn-sm mb-16",
          onclick: () => Exporter.exportChecklistsExcel(inspecoesFiltradas)
        }, [Utils.el("i", { class: "fa-solid fa-file-excel" }), ` Exportar Todos os Checklists (${inspecoesFiltradas.length}) — Excel`]));
      }

      if (inspecoesFiltradas.length === 0) {
        panelInsp.appendChild(Utils.el("div", { class: "empty-state" }, [
          Utils.el("i", { class: "fa-solid fa-clipboard-check" }),
          Utils.el("h3", {}, "Nenhuma inspeção encontrada"),
          Utils.el("p", {}, "Ajuste os filtros acima ou aguarde os fiscais realizarem inspeções.")
        ]));
      } else {
        const table = Utils.el("table");
        table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
          Utils.el("th", {}, "Data da Inspeção"), Utils.el("th", {}, "Equipe"), Utils.el("th", {}, "Fiscal"),
          Utils.el("th", {}, "Município"), Utils.el("th", {}, "Situação"), Utils.el("th", {}, "")
        ])]));
        const tbody = Utils.el("tbody");
        inspecoesFiltradas.forEach(insp => {
          const { total, pendentes } = Utils.contarPendencias(insp);
          tbody.appendChild(Utils.el("tr", {}, [
            Utils.el("td", { class: "mono" }, insp.dataInspecao ? Utils.formatDate(insp.dataInspecao) : "—"),
            Utils.el("td", {}, [Utils.el("b", {}, insp.equipePrefixo)]),
            Utils.el("td", {}, insp.fiscalNome),
            Utils.el("td", {}, insp.municipio),
            Utils.el("td", {}, [
              total === 0
                ? Utils.el("span", { class: "badge badge-success" }, "Tudo de acordo")
                : pendentes > 0
                  ? Utils.el("span", { class: "badge badge-danger" }, `${pendentes} pendente(s)`)
                  : Utils.el("span", { class: "badge badge-success" }, "Resolvido")
            ]),
            Utils.el("td", { class: "flex gap-8", style: "flex-wrap:wrap;" }, [
              Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => HistoryPage.openDetail(insp) }, [Utils.el("i", { class: "fa-solid fa-eye" }), " Ver"]),
              Utils.el("button", { class: "btn btn-secondary btn-sm", onclick: () => Exporter.exportChecklistExcel(insp) }, [Utils.el("i", { class: "fa-solid fa-file-excel" }), " Excel"]),
              Utils.el("button", { class: "btn btn-secondary btn-sm", onclick: () => Exporter.exportInspecaoPDF(insp) }, [Utils.el("i", { class: "fa-solid fa-file-pdf" }), " PDF"]),
              Utils.el("button", { class: "btn btn-danger btn-sm", onclick: () => this.excluirInspecao(insp, container) }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir"])
            ])
          ]));
        });
        table.appendChild(tbody);
        panelInsp.appendChild(table);
      }
      container.appendChild(panelInsp);
    }
  },

  async excluirCadastro(cadastro, container) {
    const relacionadas = DB.getInspecoes().filter(i => i.cadastroId === cadastro.id).length;
    const aviso = relacionadas > 0
      ? `Isso também vai excluir ${relacionadas} inspeção(ões) já realizada(s) nesta equipe. Esta ação não pode ser desfeita.`
      : "Esta ação não pode ser desfeita.";
    const ok = await Utils.confirm(`Excluir a equipe ${cadastro.prefixo}?`, aviso);
    if (!ok) return;
    DB.deleteCadastro(cadastro.id);
    Utils.toast("Equipe excluída.");
    this.render(container);
  },

  async excluirInspecao(insp, container) {
    const ok = await Utils.confirm(`Excluir a inspeção de ${insp.equipePrefixo}?`, "Esta ação não pode ser desfeita.");
    if (!ok) return;
    DB.deleteInspecao(insp.id);
    Utils.toast("Inspeção excluída.");
    this.render(container);
  },

  openCadastroDetail(cadastro, inspecoesRelacionadas) {
    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `Equipe — ${cadastro.prefixo}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const grid = Utils.el("div", { class: "detail-grid" });
    const items = [
      ["Fiscal responsável", cadastro.fiscalNome],
      ["Município", cadastro.municipio],
      ["Data do cadastro", Utils.formatDateTime(cadastro.dataHoraISO)],
      ["Horário de trabalho", (cadastro.horarioInicial && cadastro.horarioFinal) ? `${cadastro.horarioInicial} às ${cadastro.horarioFinal}` : "—"],
      ["Processo", cadastro.processo],
      ["GPS", cadastro.gps ? `${cadastro.gps.lat.toFixed(5)}, ${cadastro.gps.lng.toFixed(5)}` : "—"],
      ["Veículo", `${cadastro.veiculo?.tipo || "—"} · ${cadastro.veiculo?.placa || "—"}`],
      ["Empresa", cadastro.empresa || "—"],
      ["Documento do veículo", cadastro.veiculo?.documentoNumero ? `${cadastro.veiculo.documentoNumero}${cadastro.veiculo?.documentoValidade ? " · validade em " + Utils.formatDate(cadastro.veiculo.documentoValidade) : ""}` : "—"],
      ["Comunicação", `${cadastro.comunicacao?.tipo || "—"} · S/N ${cadastro.comunicacao?.numeroSerie || "—"}${cadastro.comunicacao?.dispositivo ? " · " + cadastro.comunicacao.dispositivo : ""}`],
      ["Colaboradores", (cadastro.colaboradores || []).map(c => `${c.nome} (${c.funcao})`).join(", ")]
    ];
    items.forEach(([k, v]) => grid.appendChild(Utils.el("div", { class: "detail-item" }, [Utils.el("div", { class: "k" }, k), Utils.el("div", { class: "v" }, v || "—")])));
    body.appendChild(grid);

    const photos = [
      ...Object.entries(cadastro.veiculo?.fotos || {}).map(([k, v]) => v && { label: `Veículo — ${k}`, src: v }),
      cadastro.comunicacao?.foto && { label: "Equipamento de comunicação", src: cadastro.comunicacao.foto },
      cadastro.comunicacao?.fotoDispositivo && { label: `Dispositivo — ${cadastro.comunicacao.dispositivo || ""}`, src: cadastro.comunicacao.fotoDispositivo },
      cadastro.fotoEquipe && { label: "Foto da equipe", src: cadastro.fotoEquipe },
      ...(cadastro.colaboradores || []).map(c => c.foto && { label: `Colaborador — ${c.nome || ""}`, src: c.foto })
    ].filter(Boolean);
    body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Fotos do cadastro"));
    const photoGrid = Utils.el("div", { class: "detail-photos" });
    photos.forEach(p => photoGrid.appendChild(Utils.el("img", { src: p.src, title: p.label, onclick: () => Gallery.lightbox(p.src) })));
    body.appendChild(photoGrid);

    body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Inspeções realizadas nesta equipe"));
    if (inspecoesRelacionadas.length === 0) {
      body.appendChild(Utils.el("p", { class: "text-muted mt-8" }, "Ainda não há inspeções (checklist de EPI/EPC) registradas para esta equipe."));
    } else {
      inspecoesRelacionadas
        .sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO))
        .forEach(insp => {
          const { total, pendentes } = Utils.contarPendencias(insp);
          const row = Utils.el("div", { class: "colaborador-card mt-8" });
          row.appendChild(Utils.el("div", { class: "flex items-center gap-8", style: "justify-content:space-between;" }, [
            Utils.el("div", {}, [
              Utils.el("b", {}, Utils.formatDate(insp.dataInspecao)),
              Utils.el("span", { class: "text-muted" }, ` — inspecionado por ${insp.fiscalNome}`)
            ]),
            total === 0
              ? Utils.el("span", { class: "badge badge-success" }, "Tudo de acordo")
              : pendentes > 0
                ? Utils.el("span", { class: "badge badge-danger" }, `${pendentes} pendente(s)`)
                : Utils.el("span", { class: "badge badge-success" }, "Resolvido")
          ]));
          const btnVer = Utils.el("button", {
            class: "btn btn-ghost btn-sm mt-8",
            onclick: (e) => { e.target.closest("button").style.display = "none"; row.appendChild(HistoryPage.renderChecklistDetail(insp)); }
          }, [Utils.el("i", { class: "fa-solid fa-list-check" }), " Ver checklist"]);
          row.appendChild(btnVer);
          body.appendChild(row);
        });
    }

    box.appendChild(body);
    overlay.appendChild(box);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
};
