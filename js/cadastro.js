/**
 * ==========================================================================
 * CADASTRO DE EQUIPE
 * ==========================================================================
 * Formulário onde o fiscal registra os dados de uma equipe em campo:
 * Identificação (prefixo manual), Veículo, Comunicação e Componentes.
 * ==========================================================================
 */

const CadastroPage = {
  state: null,

  reset() {
    this.state = {
      id: Utils.uid("cad"),
      gps: null,
      empresa: "",
      prefixo: "",
      municipio: "",
      horarioInicial: "",
      horarioFinal: "",
      processo: "",
      veiculo: {
        tipo: "Hilux 4x4", placa: "", documentoNumero: "", documentoValidade: "",
        fotos: { frente: null, traseira: null, lateral: null, placa: null, documento: null }
      },
      comunicacao: { tipo: "", numeroSerie: "", foto: null, dispositivo: "", fotoDispositivo: null },
      colaboradores: [{ nome: "", matricula: "", funcao: "", foto: null }],
      fotoEquipe: null
    };
  },

  render(container) {
    const user = Auth.current();
    if (!this.state) this.reset();
    const s = this.state;

    container.innerHTML = "";
    container.classList.add("fade-in");
    const wrap = Utils.el("div", {});

    // ---------- Seção 1 — Identificação ----------
    const secId = Utils.el("div", { class: "form-section" });
    secId.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "1"), "Identificação"]));

    const grid1 = Utils.el("div", { class: "form-grid" });
    grid1.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-user" }), ` Fiscal: ${user.nome}`]));
    grid1.appendChild(Utils.el("div", { class: "readonly-chip" }, [Utils.el("i", { class: "fa-solid fa-clock" }), ` ${Utils.formatDateTime(Utils.nowISO())}`]));

    const gpsChip = Utils.el("div", { class: "readonly-chip", id: "gpsChipCad" }, [
      Utils.el("i", { class: "fa-solid fa-location-crosshairs" }),
      Utils.el("span", { id: "gpsChipCadText" }, s.gps ? `${s.gps.lat.toFixed(5)}, ${s.gps.lng.toFixed(5)}` : "GPS não capturado")
    ]);
    grid1.appendChild(gpsChip);

    const btnGPS = Utils.el("button", {
      type: "button", class: "btn btn-secondary btn-sm",
      onclick: async () => {
        btnGPS.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Capturando…';
        try {
          s.gps = await Utils.captureGPS();
          Utils.qs("#gpsChipCadText").textContent = `${s.gps.lat.toFixed(5)}, ${s.gps.lng.toFixed(5)}`;
          Utils.qs("#gpsChipCad").style.borderColor = "var(--color-secondary)";
          Utils.toast("Localização capturada com sucesso.");
        } catch (e) {
          Utils.error("Não foi possível capturar o GPS", e.message || "Verifique as permissões de localização do navegador.");
        }
        btnGPS.innerHTML = '<i class="fa-solid fa-location-crosshairs"></i> Capturar GPS';
      }
    }, [Utils.el("i", { class: "fa-solid fa-location-crosshairs" }), " Capturar GPS"]);
    grid1.appendChild(btnGPS);
    secId.appendChild(grid1);

    const empLabel = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Empresa *")]);
    const empGroup = Utils.el("div", { class: "radio-group" });
    ["PSE ENGENHARIA", "EQUATORIAL"].forEach(emp => {
      const chip = Utils.el("label", { class: "radio-chip" + (s.empresa === emp ? " checked" : "") }, [
        Utils.el("input", { type: "radio", name: "empresaCad", value: emp, ...(s.empresa === emp ? { checked: "checked" } : {}) }),
        emp
      ]);
      chip.querySelector("input").addEventListener("change", () => {
        s.empresa = emp;
        Utils.qsa(".radio-chip", empGroup).forEach(c => c.classList.remove("checked"));
        chip.classList.add("checked");
      });
      empGroup.appendChild(chip);
    });
    empLabel.appendChild(empGroup);
    secId.appendChild(empLabel);

    const grid2 = Utils.el("div", { class: "form-grid mt-8" });
    grid2.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Prefixo da equipe *"),
      Utils.el("input", { type: "text", placeholder: "Ex: APA-07", value: s.prefixo, oninput: (e) => s.prefixo = e.target.value.toUpperCase() })
    ]));
    grid2.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Município *"),
      Utils.el("input", { type: "text", value: s.municipio, oninput: (e) => s.municipio = e.target.value })
    ]));
    grid2.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Horário inicial de trabalho *"),
      Utils.el("input", { type: "time", value: s.horarioInicial, oninput: (e) => s.horarioInicial = e.target.value })
    ]));
    grid2.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Horário final de trabalho *"),
      Utils.el("input", { type: "time", value: s.horarioFinal, oninput: (e) => s.horarioFinal = e.target.value })
    ]));
    secId.appendChild(grid2);

    const procLabel = Utils.el("div", { class: "field mt-8" }, [Utils.el("label", {}, "Processo de Atuação *")]);
    const radioGroup = Utils.el("div", { class: "radio-group" });
    ["Comercial", "Emergencial", "Comercial GD", "Corte/Religa"].forEach(p => {
      const chip = Utils.el("label", { class: "radio-chip" + (s.processo === p ? " checked" : "") }, [
        Utils.el("input", { type: "radio", name: "processoCad", value: p, ...(s.processo === p ? { checked: "checked" } : {}) }),
        p
      ]);
      chip.querySelector("input").addEventListener("change", () => {
        s.processo = p;
        Utils.qsa(".radio-chip", radioGroup).forEach(c => c.classList.remove("checked"));
        chip.classList.add("checked");
      });
      radioGroup.appendChild(chip);
    });
    procLabel.appendChild(radioGroup);
    secId.appendChild(procLabel);
    wrap.appendChild(secId);

    // ---------- Seção 2 — Veículo ----------
    const secVeic = Utils.el("div", { class: "form-section" });
    secVeic.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "2"), "Veículo"]));
    const gridV = Utils.el("div", { class: "form-grid" });
    gridV.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Tipo do veículo *"),
      (() => {
        const sel = Utils.el("select", {});
        ["Hilux 4x4", "Strada 4x2", "Moto", "Cesto Aéreo"].forEach(t => {
          const opt = Utils.el("option", { value: t }, t);
          if (t === s.veiculo.tipo) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", (e) => s.veiculo.tipo = e.target.value);
        return sel;
      })()
    ]));
    gridV.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Placa *"),
      Utils.el("input", { type: "text", placeholder: "AAA-0A00", value: s.veiculo.placa, oninput: (e) => s.veiculo.placa = e.target.value.toUpperCase() })
    ]));
    gridV.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Número do documento do veículo *"),
      Utils.el("input", { type: "text", placeholder: "Ex: CRLV nº…", value: s.veiculo.documentoNumero, oninput: (e) => s.veiculo.documentoNumero = e.target.value })
    ]));
    gridV.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Validade do documento *"),
      Utils.el("input", { type: "date", value: s.veiculo.documentoValidade, oninput: (e) => s.veiculo.documentoValidade = e.target.value })
    ]));
    secVeic.appendChild(gridV);

    const photoGridV = Utils.el("div", { class: "photo-upload-grid mt-8" });
    [["frente", "Frente"], ["traseira", "Traseira"], ["lateral", "Lateral"], ["placa", "Placa"], ["documento", "Documento do Veículo"]].forEach(([key, label]) => {
      photoGridV.appendChild(this.photoSlot(label, s.veiculo.fotos, key, container));
    });
    secVeic.appendChild(photoGridV);
    wrap.appendChild(secVeic);

    // ---------- Seção 3 — Comunicação ----------
    const secCom = Utils.el("div", { class: "form-section" });
    secCom.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "3"), "Comunicação"]));
    const gridC = Utils.el("div", { class: "form-grid" });
    gridC.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Tipo de comunicação *"),
      (() => {
        const sel = Utils.el("select", {});
        sel.appendChild(Utils.el("option", { value: "" }, "Selecione"));
        ["STARLINK", "AUTOTRACK", "Celular"].forEach(t => {
          const opt = Utils.el("option", { value: t }, t);
          if (t === s.comunicacao.tipo) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", (e) => s.comunicacao.tipo = e.target.value);
        return sel;
      })()
    ]));
    gridC.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Número de série do equipamento *"),
      Utils.el("input", { type: "text", value: s.comunicacao.numeroSerie, oninput: (e) => s.comunicacao.numeroSerie = e.target.value })
    ]));
    gridC.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Dispositivo utilizado *"),
      (() => {
        const sel = Utils.el("select", {});
        sel.appendChild(Utils.el("option", { value: "" }, "Selecione"));
        ["Tablet", "Celular"].forEach(t => {
          const opt = Utils.el("option", { value: t }, t);
          if (t === s.comunicacao.dispositivo) opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", (e) => s.comunicacao.dispositivo = e.target.value);
        return sel;
      })()
    ]));
    secCom.appendChild(gridC);
    const photoGridC = Utils.el("div", { class: "photo-upload-grid mt-8" });
    photoGridC.appendChild(this.photoSlot("Equipamento", s.comunicacao, "foto", container));
    photoGridC.appendChild(this.photoSlot("Dispositivo (Tablet/Celular)", s.comunicacao, "fotoDispositivo", container));
    secCom.appendChild(photoGridC);
    wrap.appendChild(secCom);

    // ---------- Seção 4 — Componentes da equipe ----------
    const secEq = Utils.el("div", { class: "form-section" });
    secEq.appendChild(Utils.el("div", { class: "sec-title" }, [Utils.el("span", { class: "num" }, "4"), "Componentes da Equipe"]));
    const colabWrap = Utils.el("div", { id: "colabWrapCad" });
    this.renderColaboradores(colabWrap, container);
    secEq.appendChild(colabWrap);

    const addBtn = Utils.el("button", {
      type: "button", class: "btn btn-ghost btn-sm mt-8",
      onclick: () => {
        if (s.colaboradores.length >= 3) { Utils.toast("Máximo de 3 colaboradores por equipe.", "warning"); return; }
        s.colaboradores.push({ nome: "", matricula: "", funcao: "", foto: null });
        this.renderColaboradores(colabWrap, container);
      }
    }, [Utils.el("i", { class: "fa-solid fa-plus" }), " Adicionar colaborador (opcional)"]);
    secEq.appendChild(addBtn);

    const photoGridEq = Utils.el("div", { class: "photo-upload-grid mt-8" });
    photoGridEq.appendChild(this.photoSlot("Foto da equipe", s, "fotoEquipe", container));
    secEq.appendChild(photoGridEq);
    wrap.appendChild(secEq);

    // ---------- Rodapé ----------
    const footer = Utils.el("div", { class: "form-footer" }, [
      Utils.el("button", { type: "button", class: "btn btn-ghost", onclick: () => { this.reset(); this.render(container); } }, "Limpar formulário"),
      Utils.el("button", {
        type: "button", class: "btn btn-primary",
        onclick: () => this.trySave(container)
      }, [Utils.el("i", { class: "fa-solid fa-check" }), " Salvar Cadastro"])
    ]);
    wrap.appendChild(footer);

    container.appendChild(wrap);
  },

  renderColaboradores(colabWrap, container) {
    const s = this.state;
    colabWrap.innerHTML = "";
    s.colaboradores.forEach((c, idx) => {
      const card = Utils.el("div", { class: "colaborador-card" });
      if (s.colaboradores.length > 1) {
        card.appendChild(Utils.el("button", {
          class: "remove-colab", type: "button",
          onclick: () => { s.colaboradores.splice(idx, 1); this.renderColaboradores(colabWrap, container); }
        }, [Utils.el("i", { class: "fa-solid fa-xmark" })]));
      }
      const g = Utils.el("div", { class: "form-grid" });
      g.appendChild(Utils.el("div", { class: "field" }, [
        Utils.el("label", {}, idx === 0 ? "Colaborador 1 — Nome *" : `Colaborador ${idx + 1} (opcional) — Nome *`),
        Utils.el("input", { type: "text", value: c.nome, oninput: (e) => c.nome = e.target.value })
      ]));
      g.appendChild(Utils.el("div", { class: "field" }, [
        Utils.el("label", {}, "Matrícula *"),
        Utils.el("input", { type: "text", value: c.matricula, oninput: (e) => c.matricula = e.target.value })
      ]));
      g.appendChild(Utils.el("div", { class: "field" }, [
        Utils.el("label", {}, "Função *"),
        Utils.el("input", { type: "text", placeholder: "Ex: Eletricista, Motorista…", value: c.funcao, oninput: (e) => c.funcao = e.target.value })
      ]));
      card.appendChild(g);
      const photoGridColab = Utils.el("div", { class: "photo-upload-grid mt-8" });
      photoGridColab.appendChild(this.photoSlot("Foto do colaborador", c, "foto", container, () => this.renderColaboradores(colabWrap, container)));
      card.appendChild(photoGridColab);
      colabWrap.appendChild(card);
    });
  },

  photoSlot(label, obj, key, container, onDone) {
    const value = obj[key];
    const slot = Utils.el("label", { class: "photo-slot required" + (value ? " filled" : "") });
    if (value) slot.appendChild(Utils.el("img", { src: value }));
    else {
      slot.appendChild(Utils.el("i", { class: "fa-solid fa-camera" }));
      slot.appendChild(Utils.el("span", { class: "label" }, label));
    }
    if (value) {
      const rm = Utils.el("button", {
        type: "button", class: "remove-btn",
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); obj[key] = null; onDone ? onDone() : this.render(container); }
      }, [Utils.el("i", { class: "fa-solid fa-trash" })]);
      slot.appendChild(rm);
    }
    const input = Utils.el("input", {
      type: "file", accept: "image/*", capture: "environment",
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          obj[key] = await Utils.fileToCompressedBase64(file);
          onDone ? onDone() : this.render(container);
        } catch (err) {
          Utils.error("Erro ao processar imagem", err.message);
        }
      }
    });
    slot.appendChild(input);
    return slot;
  },

  trySave(container) {
    const s = this.state;
    const user = Auth.current();
    const missing = [];

    if (!s.empresa) missing.push("Empresa");
    if (!s.prefixo.trim()) missing.push("Prefixo da equipe");
    if (!s.municipio.trim()) missing.push("Município");
    if (!s.horarioInicial) missing.push("Horário inicial de trabalho");
    if (!s.horarioFinal) missing.push("Horário final de trabalho");
    if (!s.processo) missing.push("Processo de Atuação");
    if (!s.veiculo.placa.trim()) missing.push("Placa do veículo");
    if (!s.veiculo.documentoNumero.trim()) missing.push("Número do documento do veículo");
    if (!s.veiculo.documentoValidade) missing.push("Validade do documento do veículo");
    if (!s.veiculo.fotos.frente || !s.veiculo.fotos.traseira || !s.veiculo.fotos.lateral || !s.veiculo.fotos.placa || !s.veiculo.fotos.documento)
      missing.push("Fotos do veículo (frente, traseira, lateral, placa, documento)");
    if (!s.comunicacao.tipo) missing.push("Tipo de comunicação");
    if (!s.comunicacao.numeroSerie.trim()) missing.push("Número de série do equipamento");
    if (!s.comunicacao.foto) missing.push("Foto do equipamento de comunicação");
    if (!s.comunicacao.dispositivo) missing.push("Dispositivo utilizado (Tablet/Celular)");
    if (!s.comunicacao.fotoDispositivo) missing.push("Foto do dispositivo (Tablet/Celular)");
    if (s.colaboradores.length < 1) missing.push("Ao menos 1 colaborador");
    s.colaboradores.forEach((c, i) => {
      if (!c.nome.trim() || !c.matricula.trim() || !c.funcao.trim()) missing.push(`Dados completos do colaborador ${i + 1}`);
      if (!c.foto) missing.push(`Foto do colaborador ${i + 1}`);
    });
    if (!s.fotoEquipe) missing.push("Foto da equipe");
    if (!s.gps) missing.push("Localização GPS");

    if (missing.length) {
      Utils.error("Não é possível salvar o cadastro", "Campos pendentes:\n\n• " + [...new Set(missing)].join("\n• "));
      return;
    }

    const cadastro = {
      id: s.id,
      fiscalId: user.id,
      fiscalNome: user.nome,
      dataHoraISO: Utils.nowISO(),
      gps: s.gps,
      empresa: s.empresa,
      prefixo: s.prefixo.trim(),
      municipio: s.municipio,
      horarioInicial: s.horarioInicial,
      horarioFinal: s.horarioFinal,
      processo: s.processo,
      veiculo: s.veiculo,
      comunicacao: s.comunicacao,
      colaboradores: s.colaboradores,
      fotoEquipe: s.fotoEquipe
    };

    const salvo = DB.saveCadastro(cadastro);
    if (!salvo) return; // erro já mostrado pelo DB (ex: armazenamento local cheio)
    Utils.toast("Equipe cadastrada com sucesso!");
    this.reset();
    this.render(container);
  },

  /**
   * Modal rápido para adicionar/remover/editar os eletricistas de um
   * cadastro JÁ SALVO — usado pelo fiscal (Painel do Fiscal) e por
   * líder/admin (Painel do Líder), sem precisar reabrir o formulário todo.
   */
  abrirGerenciarEletricistas(cadastro, container, onSalvo) {
    const colaboradores = cadastro.colaboradores.map(c => ({ ...c })); // edição isolada — só aplica ao salvar

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `Gerenciar Eletricistas — ${cadastro.prefixo}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });
    box.appendChild(body);

    const desenhar = () => {
      body.innerHTML = "";
      colaboradores.forEach((c, idx) => {
        const card = Utils.el("div", { class: "colaborador-card" });
        if (colaboradores.length > 1) {
          card.appendChild(Utils.el("button", {
            class: "remove-colab", type: "button",
            onclick: () => { colaboradores.splice(idx, 1); desenhar(); }
          }, [Utils.el("i", { class: "fa-solid fa-xmark" })]));
        }
        const g = Utils.el("div", { class: "form-grid" });
        g.appendChild(Utils.el("div", { class: "field" }, [
          Utils.el("label", {}, idx === 0 ? "Colaborador 1 — Nome *" : `Colaborador ${idx + 1} (opcional) — Nome *`),
          Utils.el("input", { type: "text", value: c.nome, oninput: (e) => c.nome = e.target.value })
        ]));
        g.appendChild(Utils.el("div", { class: "field" }, [
          Utils.el("label", {}, "Matrícula *"),
          Utils.el("input", { type: "text", value: c.matricula, oninput: (e) => c.matricula = e.target.value })
        ]));
        g.appendChild(Utils.el("div", { class: "field" }, [
          Utils.el("label", {}, "Função *"),
          Utils.el("input", { type: "text", placeholder: "Ex: Eletricista, Motorista…", value: c.funcao, oninput: (e) => c.funcao = e.target.value })
        ]));
        card.appendChild(g);
        const photoGridColab = Utils.el("div", { class: "photo-upload-grid mt-8" });
        photoGridColab.appendChild(this.photoSlot("Foto do colaborador", c, "foto", container, desenhar));
        card.appendChild(photoGridColab);
        body.appendChild(card);
      });

      body.appendChild(Utils.el("button", {
        type: "button", class: "btn btn-ghost btn-sm mt-8",
        onclick: () => {
          if (colaboradores.length >= 3) { Utils.toast("Máximo de 3 colaboradores por equipe.", "warning"); return; }
          colaboradores.push({ nome: "", matricula: "", funcao: "", foto: null });
          desenhar();
        }
      }, [Utils.el("i", { class: "fa-solid fa-plus" }), " Adicionar colaborador (opcional)"]));

      body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:16px;" }, [
        Utils.el("button", {
          type: "button", class: "btn btn-primary",
          onclick: () => {
            const missing = [];
            colaboradores.forEach((c, i) => {
              if (!c.nome.trim() || !c.matricula.trim() || !c.funcao.trim()) missing.push(`Dados completos do colaborador ${i + 1}`);
              if (!c.foto) missing.push(`Foto do colaborador ${i + 1}`);
            });
            if (missing.length) { Utils.error("Campos obrigatórios", "Preencha: " + [...new Set(missing)].join(", ")); return; }

            const salvo = DB.saveCadastro({ ...cadastro, colaboradores });
            if (!salvo) return;
            Utils.toast("Eletricistas atualizados com sucesso!");
            overlay.remove();
            if (onSalvo) onSalvo();
          }
        }, [Utils.el("i", { class: "fa-solid fa-check" }), " Salvar"])
      ]));
    };

    desenhar();
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }
};
