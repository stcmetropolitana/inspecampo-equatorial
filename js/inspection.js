/**
 * ==========================================================================
 * INSPEÇÃO DE EQUIPE — Checklist de EPIs e EPCs
 * ==========================================================================
 * Aqui o fiscal seleciona uma equipe já cadastrada (por prefixo) e realiza
 * a verificação de EPIs (por eletricista) e EPCs (do veículo).
 * ==========================================================================
 */

const InspectionPage = {
  state: null,
  activeColabTab: 0,

  makeChecklist(items) {
    return items.map(nome => ({ nome, quantidade: 1, validade: "", estado: "", foto: null }));
  },

  reset() {
    this.activeColabTab = 0;
    this.state = {
      id: Utils.uid("insp"),
      cadastroId: "",
      dataInspecao: new Date().toISOString().slice(0, 10),
      epiPorColaborador: [],
      epc: { itens: this.makeChecklist(EPC_ITEMS) }
    };
  },

  /** Pré-seleciona uma equipe cadastrada (usado pelo atalho "Inspecionar" do Painel Fiscal) */
  startFor(cadastroId) {
    this.reset();
    this.state.cadastroId = cadastroId;
    const cad = DB.getCadastros().find(c => c.id === cadastroId);
    this.activeColabTab = 0;
    this.state.epiPorColaborador = cad ? cad.colaboradores.map(() => ({ itens: this.makeChecklist(EPI_ITEMS) })) : [];
  },

  render(container) {
    const user = Auth.current();
    if (!this.state) this.reset();
    const s = this.state;
    const cadastros = [...DB.getCadastros()].sort((a, b) => new Date(b.dataHoraISO) - new Date(a.dataHoraISO));

    container.innerHTML = "";
    container.classList.add("fade-in");

    if (cadastros.length === 0) {
      container.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-clipboard-user" }),
        Utils.el("h3", {}, "Nenhuma equipe cadastrada ainda"),
        Utils.el("p", {}, 'Acesse "Cadastro de Equipe" primeiro para registrar a equipe antes de realizar a inspeção.')
      ]));
      return;
    }

    const cadastroAtivo = cadastros.find(c => c.id === s.cadastroId) || null;
    const wrap = Utils.el("div", {});

    // ---------- Seção 1 — Identificação da Inspeção ----------
    const secId = Utils.el("div", { class: "form-section" });
    secId.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "1"), "Identificação da Inspeção"]));

    const grid1 = Utils.el("div", { class: "form-grid" });
    grid1.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-user" }), ` Fiscal: ${user.nome}`]));

    grid1.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Data da inspeção *"),
      Utils.el("input", { type: "date", value: s.dataInspecao, oninput: (e) => s.dataInspecao = e.target.value })
    ]));

    grid1.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Equipe (prefixo) *"),
      (() => {
        const sel = Utils.el("select", {});
        sel.appendChild(Utils.el("option", { value: "" }, "Selecione a equipe cadastrada"));
        cadastros.forEach(c => {
          const opt = Utils.el("option", { value: c.id }, `${c.prefixo} — ${c.municipio} (cadastrada em ${Utils.formatDate(c.dataHoraISO)})`);
          if (c.id === s.cadastroId) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", () => {
          s.cadastroId = sel.value;
          const cad = cadastros.find(c => c.id === sel.value);
          this.activeColabTab = 0;
          s.epiPorColaborador = cad ? cad.colaboradores.map(() => ({ itens: this.makeChecklist(EPI_ITEMS) })) : [];
          this.render(container);
        });
        return sel;
      })()
    ]));
    secId.appendChild(grid1);

    if (cadastroAtivo) {
      const grid2 = Utils.el("div", { class: "form-grid mt-8" });
      grid2.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-hashtag" }), ` Prefixo: ${cadastroAtivo.prefixo}`]));
      grid2.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-location-dot" }), ` ${cadastroAtivo.municipio}`]));
      grid2.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-truck-pickup" }), ` ${cadastroAtivo.veiculo?.tipo || "—"} · ${cadastroAtivo.veiculo?.placa || "—"}`]));
      secId.appendChild(grid2);
    }
    wrap.appendChild(secId);

    if (!cadastroAtivo) {
      wrap.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-arrow-up" }),
        Utils.el("h3", {}, "Selecione uma equipe para continuar"),
        Utils.el("p", {}, "Os checklists de EPI e EPC aparecem depois que você escolher o prefixo da equipe acima.")
      ]));
      container.appendChild(wrap);
      return;
    }

    // ---------- Seção 2 — Checklist de EPIs por eletricista ----------
    const secEpi = Utils.el("div", { class: "form-section" });
    secEpi.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "2"), "EPIs — Verificação por Eletricista"]));

    const epiTabs = Utils.el("div", { class: "gallery-tabs" });
    cadastroAtivo.colaboradores.forEach((c, idx) => {
      const tab = Utils.el("button", {
        type: "button", class: "gallery-tab" + (this.activeColabTab === idx ? " active" : ""),
        onclick: () => { this.activeColabTab = idx; this.render(container); }
      }, c.nome.trim() || `Colaborador ${idx + 1}`);
      epiTabs.appendChild(tab);
    });
    secEpi.appendChild(epiTabs);

    if (this.activeColabTab >= cadastroAtivo.colaboradores.length) this.activeColabTab = 0;
    if (!s.epiPorColaborador[this.activeColabTab]) s.epiPorColaborador[this.activeColabTab] = { itens: this.makeChecklist(EPI_ITEMS) };
    secEpi.appendChild(this.renderChecklistTable(s.epiPorColaborador[this.activeColabTab].itens, container));
    wrap.appendChild(secEpi);

    // ---------- Seção 3 — Checklist de EPCs do veículo ----------
    const secEpc = Utils.el("div", { class: "form-section" });
    secEpc.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "3"), "EPCs — Verificação do Veículo"]));
    secEpc.appendChild(this.renderChecklistTable(s.epc.itens, container));
    wrap.appendChild(secEpc);

    // ---------- Rodapé ----------
    const footer = Utils.el("div", { class: "form-footer" }, [
      Utils.el("button", { type: "button", class: "btn btn-ghost", onclick: () => { this.reset(); this.render(container); } }, "Limpar formulário"),
      Utils.el("button", {
        type: "button", class: "btn btn-primary",
        onclick: () => this.trySave(cadastroAtivo, container)
      }, [Utils.el("i", { class: "fa-solid fa-check" }), " Finalizar Inspeção"])
    ]);
    wrap.appendChild(footer);

    container.appendChild(wrap);
  },

  renderChecklistTable(itens, container) {
    const wrapTable = Utils.el("div", { class: "checklist-wrap" });
    const table = Utils.el("table", { class: "checklist-table" });
    table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
      Utils.el("th", {}, "Item"), Utils.el("th", {}, "Qtd."), Utils.el("th", {}, "Validade do laudo"),
      Utils.el("th", {}, "Situação *"), Utils.el("th", {}, "Foto")
    ])]));
    const tbody = Utils.el("tbody");

    itens.forEach(item => {
      const row = Utils.el("tr", { class: item.estado === "danificado" ? "row-danger" : "" });
      row.appendChild(Utils.el("td", { class: "item-name" }, item.nome));
      row.appendChild(Utils.el("td", {}, [
        Utils.el("input", { type: "number", min: "0", class: "qty-input", value: item.quantidade, oninput: (e) => item.quantidade = Number(e.target.value) })
      ]));
      row.appendChild(Utils.el("td", {}, [
        Utils.el("input", { type: "date", class: "date-input", value: item.validade, oninput: (e) => item.validade = e.target.value })
      ]));
      row.appendChild(Utils.el("td", {}, [this.estadoToggle(item, container)]));
      row.appendChild(Utils.el("td", {}, [this.miniPhotoButton(item, container)]));
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrapTable.appendChild(table);
    return wrapTable;
  },

  estadoToggle(item, container) {
    const group = Utils.el("div", { class: "estado-toggle" });
    [["de_acordo", "De acordo", "fa-check"], ["danificado", "Danificado", "fa-triangle-exclamation"]].forEach(([val, label, icon]) => {
      const btn = Utils.el("button", {
        type: "button",
        class: "estado-btn " + val + (item.estado === val ? " active" : ""),
        title: label,
        onclick: () => { item.estado = val; this.render(container); }
      }, [Utils.el("i", { class: `fa-solid ${icon}` })]);
      group.appendChild(btn);
    });
    return group;
  },

  miniPhotoButton(item, container) {
    const wrapper = Utils.el("label", { class: "mini-photo-btn" + (item.foto ? " filled" : "") });
    if (item.foto) {
      wrapper.appendChild(Utils.el("img", { src: item.foto }));
      wrapper.appendChild(Utils.el("button", {
        type: "button", class: "mini-photo-remove",
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); item.foto = null; this.render(container); }
      }, [Utils.el("i", { class: "fa-solid fa-xmark" })]));
    } else {
      wrapper.appendChild(Utils.el("i", { class: "fa-solid fa-camera" }));
    }
    wrapper.appendChild(Utils.el("input", {
      type: "file", accept: "image/*", capture: "environment",
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          item.foto = await Utils.fileToCompressedBase64(file);
          this.render(container);
        } catch (err) {
          Utils.error("Erro ao processar imagem", err.message);
        }
      }
    }));
    return wrapper;
  },

  trySave(cadastro, container) {
    const s = this.state;
    const user = Auth.current();
    const missing = [];

    if (!s.dataInspecao) missing.push("Data da inspeção");
    if (!cadastro) missing.push("Equipe (prefixo)");

    s.epiPorColaborador.forEach((checklist, idx) => {
      const nomeColab = cadastro.colaboradores[idx]?.nome.trim() || `Colaborador ${idx + 1}`;
      if (checklist.itens.some(item => !item.estado)) missing.push(`Checklist de EPIs de ${nomeColab} — informe a situação de todos os itens`);
    });
    if (s.epc.itens.some(item => !item.estado)) missing.push("Checklist de EPCs do veículo — informe a situação de todos os itens");

    if (missing.length) {
      Utils.error("Não é possível finalizar a inspeção", "Campos pendentes:\n\n• " + [...new Set(missing)].join("\n• "));
      return;
    }

    const inspecao = {
      id: s.id,
      fiscalId: user.id,
      fiscalNome: user.nome,
      cadastroId: cadastro.id,
      equipePrefixo: cadastro.prefixo,
      municipio: cadastro.municipio,
      processo: cadastro.processo,
      veiculoTipo: cadastro.veiculo?.tipo || "",
      veiculoPlaca: cadastro.veiculo?.placa || "",
      comunicacaoTipo: cadastro.comunicacao?.tipo || "",
      comunicacaoSerie: cadastro.comunicacao?.numeroSerie || "",
      colaboradores: cadastro.colaboradores,
      dataInspecao: s.dataInspecao,
      dataHoraISO: Utils.nowISO(),
      epiPorColaborador: cadastro.colaboradores.map((c, idx) => ({
        colaborador: c.nome, itens: s.epiPorColaborador[idx].itens
      })),
      epc: s.epc,
      status: "concluida"
    };

    const salvo = DB.saveInspecao(inspecao);
    if (!salvo) return; // erro já mostrado pelo DB (ex: armazenamento local cheio)
    Utils.toast("Inspeção salva com sucesso!");
    this.reset();
    this.render(container);
  }
};
