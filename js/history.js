/**
 * ==========================================================================
 * HISTÓRICO DE INSPEÇÕES
 * ==========================================================================
 */

const HistoryPage = {
  filters: { data: "", municipio: "", fiscal: "", equipe: "", processo: "", veiculo: "" },

  render(container) {
    container.innerHTML = "";
    container.classList.add("fade-in");

    const inspecoes = DB.getInspecoes();
    const cadastros = DB.getCadastros();
    const fiscais = DB.getFiscais().filter(f => f.perfil === "fiscal" || f.perfil === "admin");
    const municipios = [...new Set(cadastros.map(c => c.municipio))].sort();
    const prefixos = [...new Set(cadastros.map(c => c.prefixo))].sort();

    const bar = Utils.el("div", { class: "filter-bar" });
    bar.appendChild(this.selectField("Data", "data", [], true));
    bar.appendChild(this.selectField("Município", "municipio", municipios));
    bar.appendChild(this.selectField("Fiscal", "fiscal", fiscais.map(f => f.nome)));
    bar.appendChild(this.selectField("Equipe", "equipe", prefixos));
    bar.appendChild(this.selectField("Processo", "processo", ["Comercial", "Emergencial", "Comercial GD", "Corte/Religa"]));
    bar.appendChild(this.selectField("Veículo", "veiculo", ["Hilux 4x4", "Strada 4x2", "Moto", "Cesto Aéreo"]));
    bar.appendChild(Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => { this.filters = { data: "", municipio: "", fiscal: "", equipe: "", processo: "", veiculo: "" }; this.render(container); } }, "Limpar filtros"));
    container.appendChild(bar);

    const resultsWrap = Utils.el("div", { class: "panel" });
    resultsWrap.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Resultados"),
      Utils.el("span", { class: "tag", id: "resultCount" }, "")
    ]));
    const listDiv = Utils.el("div", { id: "resultsList" });
    resultsWrap.appendChild(listDiv);
    container.appendChild(resultsWrap);

    this.applyFilters(inspecoes, listDiv);
  },

  selectField(label, key, options, isDate = false) {
    const field = Utils.el("div", { class: "field" });
    field.appendChild(Utils.el("label", {}, label));
    if (isDate) {
      const input = Utils.el("input", { type: "date", value: this.filters[key] });
      input.addEventListener("change", (e) => { this.filters[key] = e.target.value; this.refresh(); });
      field.appendChild(input);
    } else {
      const sel = Utils.el("select", {});
      sel.appendChild(Utils.el("option", { value: "" }, "Todos"));
      options.forEach(o => {
        const opt = Utils.el("option", { value: o }, o);
        if (this.filters[key] === o) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", (e) => { this.filters[key] = e.target.value; this.refresh(); });
      field.appendChild(sel);
    }
    return field;
  },

  refresh() {
    const listDiv = Utils.qs("#resultsList");
    if (!listDiv) return;
    this.applyFilters(DB.getInspecoes(), listDiv);
  },

  applyFilters(inspecoes, listDiv) {
    const f = this.filters;
    let results = inspecoes.filter(i => {
      if (f.data && i.dataInspecao !== f.data) return false;
      if (f.municipio && i.municipio !== f.municipio) return false;
      if (f.fiscal && i.fiscalNome !== f.fiscal) return false;
      if (f.equipe && i.equipePrefixo !== f.equipe) return false;
      if (f.processo && i.processo !== f.processo) return false;
      if (f.veiculo && i.veiculoTipo !== f.veiculo) return false;
      return true;
    }).sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));

    Utils.qs("#resultCount").textContent = `${results.length} inspeção(ões)`;
    listDiv.innerHTML = "";

    if (results.length === 0) {
      listDiv.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-magnifying-glass" }),
        Utils.el("h3", {}, "Nenhuma inspeção encontrada"),
        Utils.el("p", {}, "Ajuste os filtros acima para tentar novamente.")
      ]));
      return;
    }

    const table = Utils.el("table");
    table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
      Utils.el("th", {}, "Data da Inspeção"), Utils.el("th", {}, "Equipe"), Utils.el("th", {}, "Município"),
      Utils.el("th", {}, "Processo"), Utils.el("th", {}, "Fiscal"), Utils.el("th", {}, "Veículo"), Utils.el("th", {}, "")
    ])]));
    const tbody = Utils.el("tbody");
    results.forEach(insp => {
      tbody.appendChild(Utils.el("tr", {}, [
        Utils.el("td", { class: "mono" }, insp.dataInspecao ? Utils.formatDate(insp.dataInspecao) : "—"),
        Utils.el("td", {}, insp.equipePrefixo),
        Utils.el("td", {}, insp.municipio),
        Utils.el("td", {}, [Utils.el("span", { class: "badge badge-info" }, insp.processo)]),
        Utils.el("td", {}, insp.fiscalNome),
        Utils.el("td", {}, insp.veiculoTipo || "—"),
        Utils.el("td", { class: "flex gap-8" }, [
          Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => this.openDetail(insp) }, [Utils.el("i", { class: "fa-solid fa-eye" }), " Ver"]),
          Utils.el("button", { class: "btn btn-danger btn-sm", onclick: () => this.excluirInspecao(insp) }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir"])
        ])
      ]));
    });
    table.appendChild(tbody);
    listDiv.appendChild(table);
  },

  async excluirInspecao(insp) {
    const ok = await Utils.confirm(`Excluir a inspeção de ${insp.equipePrefixo}?`, "Esta ação não pode ser desfeita.");
    if (!ok) return;
    DB.deleteInspecao(insp.id);
    Utils.toast("Inspeção excluída.");
    this.refresh();
  },

  renderChecklistDetail(insp) {
    const wrap = Utils.el("div", { class: "mt-8" });

    const buildTable = (titulo, itens) => {
      const box = Utils.el("div", { class: "mb-16" });
      box.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, titulo));
      const tableWrap = Utils.el("div", { class: "checklist-wrap mt-8" });
      const table = Utils.el("table", { class: "checklist-table" });
      table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "Item"), Utils.el("th", {}, "Qtd."), Utils.el("th", {}, "Validade"),
        Utils.el("th", {}, "Situação"), Utils.el("th", {}, "Foto"), Utils.el("th", {}, "Resolução")
      ])]));
      const tbody = Utils.el("tbody");
      itens.forEach(item => {
        tbody.appendChild(Utils.el("tr", { class: item.estado === "danificado" ? "row-danger" : "" }, [
          Utils.el("td", { class: "item-name" }, item.nome),
          Utils.el("td", {}, String(item.quantidade ?? "—")),
          Utils.el("td", {}, item.validade ? Utils.formatDate(item.validade) : "—"),
          Utils.el("td", {}, [
            item.estado === "danificado"
              ? Utils.el("span", { class: "badge badge-danger" }, "Danificado")
              : item.estado === "de_acordo"
                ? Utils.el("span", { class: "badge badge-success" }, "De acordo")
                : Utils.el("span", { class: "badge badge-warning" }, "—")
          ]),
          Utils.el("td", {}, item.foto ? [Utils.el("img", { src: item.foto, style: "width:36px;height:36px;object-fit:cover;border-radius:6px;cursor:pointer;", onclick: () => Gallery.lightbox(item.foto) })] : "—"),
          this.resolucaoCell(insp, item)
        ]));
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      box.appendChild(tableWrap);
      return box;
    };

    (insp.epiPorColaborador || []).forEach(c => {
      wrap.appendChild(buildTable(`EPIs — ${c.colaborador || "Colaborador"}`, c.itens));
    });
    if (insp.epc) wrap.appendChild(buildTable("EPCs do veículo", insp.epc.itens));

    return wrap;
  },

  /**
   * Célula de "Resolução" da não-conformidade. Só é relevante para itens
   * marcados como "danificado" — para os demais, mostra apenas "—".
   * Quando o fiscal anexa a foto de resolução, salva direto no banco
   * (DB.saveInspecao faz upsert) e atualiza a célula sem fechar o modal.
   */
  resolucaoCell(insp, item) {
    const td = Utils.el("td", {});

    if (item.estado !== "danificado") {
      td.textContent = "—";
      return td;
    }

    const desenhar = () => {
      td.innerHTML = "";
      if (item.resolucao?.resolvido) {
        const wrap = Utils.el("div", {});
        wrap.appendChild(Utils.el("span", { class: "badge badge-success" }, "Resolvida"));
        wrap.appendChild(Utils.el("div", { class: "text-muted", style: "font-size:.7rem;margin-top:4px;" }, `${Utils.formatDateTime(item.resolucao.dataResolucao)} · ${item.resolucao.resolvidoPor}`));
        if (item.resolucao.fotoResolucao) {
          wrap.appendChild(Utils.el("img", {
            src: item.resolucao.fotoResolucao,
            style: "width:32px;height:32px;object-fit:cover;border-radius:6px;cursor:pointer;margin-top:4px;",
            onclick: () => Gallery.lightbox(item.resolucao.fotoResolucao)
          }));
        }
        td.appendChild(wrap);
      } else {
        const label = Utils.el("label", { class: "btn btn-secondary btn-sm" }, [Utils.el("i", { class: "fa-solid fa-camera" }), " Marcar resolvida"]);
        const input = Utils.el("input", {
          type: "file", accept: "image/*", capture: "environment", style: "display:none;",
          onchange: async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const foto = await Utils.fileToCompressedBase64(file);
              const user = Auth.current();
              item.resolucao = { resolvido: true, fotoResolucao: foto, dataResolucao: Utils.nowISO(), resolvidoPor: user ? user.nome : "—" };
              DB.saveInspecao(insp);
              Utils.toast("Não conformidade marcada como resolvida.");
              desenhar();
            } catch (err) {
              Utils.error("Erro ao processar imagem", err.message);
            }
          }
        });
        label.appendChild(input);
        td.appendChild(label);
      }
    };
    desenhar();
    return td;
  },

  openDetail(insp) {
    const cadastro = DB.getCadastros().find(c => c.id === insp.cadastroId) || null;

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `Inspeção — ${insp.equipePrefixo}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const grid = Utils.el("div", { class: "detail-grid" });
    const items = [
      ["Data da inspeção", insp.dataInspecao ? Utils.formatDate(insp.dataInspecao) : "—"],
      ["Registrado em", Utils.formatDateTime(insp.dataHoraISO)],
      ["Fiscal (inspeção)", insp.fiscalNome],
      ["Município", insp.municipio],
      ["Processo", insp.processo],
      ["Veículo", `${insp.veiculoTipo || "—"} · ${insp.veiculoPlaca || "—"}`],
      ["Comunicação", `${insp.comunicacaoTipo || "—"} · S/N ${insp.comunicacaoSerie || "—"}${cadastro?.comunicacao?.dispositivo ? " · " + cadastro.comunicacao.dispositivo : ""}`],
      ["Colaboradores", (insp.colaboradores || []).map(c => `${c.nome} (${c.funcao})`).join(", ")]
    ];
    if (cadastro) {
      items.splice(3, 0, ["Horário de trabalho", (cadastro.horarioInicial && cadastro.horarioFinal) ? `${cadastro.horarioInicial} às ${cadastro.horarioFinal}` : "—"]);
      items.push(["GPS do cadastro", cadastro.gps ? `${cadastro.gps.lat.toFixed(5)}, ${cadastro.gps.lng.toFixed(5)}` : "—"]);
      items.push(["Fiscal (cadastro)", cadastro.fiscalNome]);
    }
    items.forEach(([k, v]) => grid.appendChild(Utils.el("div", { class: "detail-item" }, [Utils.el("div", { class: "k" }, k), Utils.el("div", { class: "v" }, v || "—")])));
    body.appendChild(grid);

    if (cadastro) {
      const photos = [
        ...Object.entries(cadastro.veiculo?.fotos || {}).map(([k, v]) => v && { label: `Veículo — ${k}`, src: v }),
        cadastro.comunicacao?.foto && { label: "Equipamento de comunicação", src: cadastro.comunicacao.foto },
        cadastro.comunicacao?.fotoDispositivo && { label: `Dispositivo — ${cadastro.comunicacao.dispositivo || ""}`, src: cadastro.comunicacao.fotoDispositivo },
        cadastro.fotoEquipe && { label: "Foto da equipe", src: cadastro.fotoEquipe }
      ].filter(Boolean);

      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Fotos do cadastro"));
      const photoGrid = Utils.el("div", { class: "detail-photos" });
      photos.forEach(p => photoGrid.appendChild(Utils.el("img", { src: p.src, title: p.label, onclick: () => Gallery.lightbox(p.src) })));
      body.appendChild(photoGrid);
    }

    // ---------- Resumo dos checklists de EPI / EPC ----------
    body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Checklists de EPI / EPC"));
    const checklistSummary = Utils.el("div", { class: "detail-grid mt-8" });

    const resumoBadge = (itensDanificados) => {
      if (itensDanificados.length === 0) return Utils.el("span", { class: "badge badge-success" }, "Tudo de acordo");
      const pendentes = itensDanificados.filter(i => !i.resolucao?.resolvido).length;
      if (pendentes === 0) return Utils.el("span", { class: "badge badge-success" }, `${itensDanificados.length} resolvida(s)`);
      return Utils.el("span", { class: "badge badge-danger" }, `${pendentes} pendente(s) de ${itensDanificados.length}`);
    };

    (insp.epiPorColaborador || []).forEach(c => {
      const danificados = c.itens.filter(i => i.estado === "danificado");
      checklistSummary.appendChild(Utils.el("div", { class: "detail-item" }, [
        Utils.el("div", { class: "k" }, `EPIs — ${c.colaborador || "Colaborador"}`),
        Utils.el("div", { class: "v" }, [resumoBadge(danificados)])
      ]));
    });
    if (insp.epc) {
      const danificadosEpc = insp.epc.itens.filter(i => i.estado === "danificado");
      checklistSummary.appendChild(Utils.el("div", { class: "detail-item" }, [
        Utils.el("div", { class: "k" }, "EPCs do veículo"),
        Utils.el("div", { class: "v" }, [resumoBadge(danificadosEpc)])
      ]));
    }
    body.appendChild(checklistSummary);

    const verChecklistBtn = Utils.el("button", {
      class: "btn btn-ghost btn-sm mt-8",
      onclick: (e) => { e.target.closest("button").style.display = "none"; body.appendChild(this.renderChecklistDetail(insp)); }
    }, [Utils.el("i", { class: "fa-solid fa-list-check" }), " Ver checklist completo"]);
    body.appendChild(verChecklistBtn);

    const exportRow = Utils.el("div", { class: "flex gap-8 mt-8" }, [
      Utils.el("button", { class: "btn btn-secondary btn-sm", onclick: () => Exporter.exportInspecaoPDF(insp) }, [Utils.el("i", { class: "fa-solid fa-file-pdf" }), " Exportar PDF"])
    ]);
    if (Auth.isAdmin() || Auth.isLider()) {
      exportRow.appendChild(Utils.el("button", {
        class: "btn btn-danger btn-sm",
        onclick: async () => {
          const ok = await Utils.confirm(`Excluir a inspeção de ${insp.equipePrefixo}?`, "Esta ação não pode ser desfeita.");
          if (!ok) return;
          DB.deleteInspecao(insp.id);
          Utils.toast("Inspeção excluída.");
          overlay.remove();
          this.refresh();
        }
      }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir Inspeção"]));
    }
    body.appendChild(exportRow);

    box.appendChild(body);
    overlay.appendChild(box);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }
};
