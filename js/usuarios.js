/**
 * ==========================================================================
 * GESTÃO DE USUÁRIOS (somente Administrador)
 * ==========================================================================
 * Cria, edita e exclui usuários (Administrador, Líder, Analista, Fiscal) e
 * faz o vínculo de cada Analista/Fiscal a um Líder (campo liderId).
 * ==========================================================================
 */

const UsersPage = {
  filtroPerfil: "",

  PERFIL_LABEL: { admin: "Administrador", lider: "Líder", analista: "Analista", fiscal: "Fiscal" },
  PERFIL_BADGE: { admin: "badge-info", lider: "badge-success", analista: "badge-warning", fiscal: "badge-success" },

  render(container) {
    const todos = DB.getFiscais().sort((a, b) => a.nome.localeCompare(b.nome));
    const lideres = todos.filter(u => u.perfil === "lider");
    const semLider = todos.filter(u => (u.perfil === "fiscal" || u.perfil === "analista") && !u.liderId);

    container.innerHTML = "";
    container.classList.add("fade-in");

    // ---------- KPIs ----------
    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    [
      { label: "Total de usuários", value: todos.length, icon: "fa-users", cls: "c-blue" },
      { label: "Líderes", value: lideres.length, icon: "fa-user-tie", cls: "c-teal" },
      { label: "Analistas", value: todos.filter(u => u.perfil === "analista").length, icon: "fa-user-pen", cls: "c-amber" },
      { label: "Fiscais", value: todos.filter(u => u.perfil === "fiscal").length, icon: "fa-user-shield", cls: "c-green" }
    ].forEach(k => kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
      Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
      Utils.el("div", { class: "value" }, String(k.value)),
      Utils.el("div", { class: "label" }, k.label)
    ])));
    container.appendChild(kpiGrid);

    // ---------- Aviso: usuários sem líder vinculado ----------
    if (semLider.length > 0) {
      container.appendChild(Utils.el("div", { class: "panel mb-16", style: "border-left:4px solid var(--color-warning);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;" }, [
        Utils.el("div", { class: "flex items-center gap-8" }, [
          Utils.el("i", { class: "fa-solid fa-triangle-exclamation", style: "color:var(--color-warning);font-size:1.2rem;" }),
          Utils.el("div", {}, [
            Utils.el("b", {}, `${semLider.length} usuário(s) sem líder vinculado`),
            Utils.el("div", { class: "text-muted", style: "font-size:.82rem;" }, "Fiscais e analistas sem líder não aparecem no Painel do Líder correspondente. Use a coluna \"Líder vinculado\" na tabela abaixo para associar.")
          ])
        ])
      ]));
    }

    container.appendChild(Utils.el("button", {
      class: "btn btn-primary mb-16",
      onclick: () => this.abrirFormUsuario(null, container)
    }, [Utils.el("i", { class: "fa-solid fa-user-plus" }), " Novo Usuário"]));

    // ---------- Filtro por perfil ----------
    const bar = Utils.el("div", { class: "filter-bar" });
    const f = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Perfil")]);
    const sel = Utils.el("select", {});
    [["", "Todos"], ["lider", "Líderes"], ["analista", "Analistas"], ["fiscal", "Fiscais"], ["admin", "Administradores"]].forEach(([val, label]) => {
      const opt = Utils.el("option", { value: val }, label);
      if (this.filtroPerfil === val) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", (e) => { this.filtroPerfil = e.target.value; this.render(container); });
    f.appendChild(sel);
    bar.appendChild(f);
    container.appendChild(bar);

    // ---------- Tabela ----------
    const panel = Utils.el("div", { class: "panel" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Usuários"),
      Utils.el("span", { class: "tag" }, `${todos.length} usuário(s)`)
    ]));

    const lista = todos.filter(u => !this.filtroPerfil || u.perfil === this.filtroPerfil);

    if (lista.length === 0) {
      panel.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-users" }),
        Utils.el("h3", {}, "Nenhum usuário encontrado")
      ]));
    } else {
      const wrap = Utils.el("div", { class: "checklist-wrap" });
      const table = Utils.el("table");
      table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "Nome"), Utils.el("th", {}, "Matrícula"), Utils.el("th", {}, "Perfil"),
        Utils.el("th", {}, "Líder vinculado"), Utils.el("th", {}, "")
      ])]));
      const tbody = Utils.el("tbody");

      lista.forEach(u => {
        const precisaLider = u.perfil === "fiscal" || u.perfil === "analista";
        let celulaLider;
        if (!precisaLider) {
          celulaLider = Utils.el("span", { class: "text-muted" }, "—");
        } else {
          const selLider = Utils.el("select", { style: !u.liderId ? "border-color:var(--color-warning);" : "" });
          selLider.appendChild(Utils.el("option", { value: "" }, "Sem líder vinculado"));
          lideres.forEach(l => {
            const opt = Utils.el("option", { value: l.id }, l.nome);
            if (u.liderId === l.id) opt.selected = true;
            selLider.appendChild(opt);
          });
          selLider.addEventListener("change", (e) => this.alterarLider(u, e.target.value || null, container));
          celulaLider = selLider;
        }

        tbody.appendChild(Utils.el("tr", {}, [
          Utils.el("td", {}, [Utils.el("b", {}, u.nome)]),
          Utils.el("td", { class: "mono" }, u.matricula),
          Utils.el("td", {}, [Utils.el("span", { class: `badge ${this.PERFIL_BADGE[u.perfil] || "badge-info"}` }, this.PERFIL_LABEL[u.perfil] || u.perfil)]),
          Utils.el("td", {}, [celulaLider]),
          Utils.el("td", { class: "flex gap-8" }, [
            Utils.el("button", { class: "btn btn-ghost btn-sm", onclick: () => this.abrirFormUsuario(u, container) }, [Utils.el("i", { class: "fa-solid fa-pen" }), " Editar"]),
            Utils.el("button", { class: "btn btn-danger btn-sm", onclick: () => this.excluirUsuario(u, container) }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir"])
          ])
        ]));
      });
      table.appendChild(tbody);
      wrap.appendChild(table);
      panel.appendChild(wrap);
    }
    container.appendChild(panel);
  },

  alterarLider(user, novoLiderId, container) {
    const atualizado = { ...user, liderId: novoLiderId };
    const salvo = DB.saveFiscal(atualizado);
    if (!salvo) return;
    Utils.toast(novoLiderId ? `${user.nome} vinculado ao líder.` : `${user.nome} ficou sem líder vinculado.`);
    this.render(container);
  },

  abrirFormUsuario(usuario, container) {
    const editando = !!usuario;
    const lideres = DB.getFiscais().filter(f => f.perfil === "lider");
    const dado = usuario
      ? { ...usuario }
      : { nome: "", matricula: "", senha: "1234", perfil: "fiscal", liderId: null };

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, editando ? `Editar — ${usuario.nome}` : "Novo Usuário"),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const grid = Utils.el("div", { class: "form-grid" });
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Nome completo *"),
      Utils.el("input", { type: "text", value: dado.nome, oninput: (e) => dado.nome = e.target.value })
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Matrícula *"),
      Utils.el("input", { type: "text", value: dado.matricula, oninput: (e) => dado.matricula = e.target.value })
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, editando ? "Nova senha (deixe igual para não alterar)" : "Senha *"),
      Utils.el("input", { type: "text", value: dado.senha || "", oninput: (e) => dado.senha = e.target.value })
    ]));

    const campoPerfil = Utils.el("div", { class: "field" }, [Utils.el("label", {}, "Perfil *")]);
    const selPerfil = Utils.el("select", {});
    Object.entries(this.PERFIL_LABEL).forEach(([val, label]) => {
      const opt = Utils.el("option", { value: val }, label);
      if (dado.perfil === val) opt.selected = true;
      selPerfil.appendChild(opt);
    });
    selPerfil.addEventListener("change", (e) => { dado.perfil = e.target.value; redesenharCampoLider(); });
    campoPerfil.appendChild(selPerfil);
    grid.appendChild(campoPerfil);
    body.appendChild(grid);

    const campoLiderWrap = Utils.el("div", { class: "field mt-8" });
    body.appendChild(campoLiderWrap);
    const redesenharCampoLider = () => {
      campoLiderWrap.innerHTML = "";
      if (dado.perfil !== "fiscal" && dado.perfil !== "analista") { dado.liderId = null; return; }
      campoLiderWrap.appendChild(Utils.el("label", {}, "Líder vinculado"));
      const selLider = Utils.el("select", {});
      selLider.appendChild(Utils.el("option", { value: "" }, "Sem líder vinculado"));
      lideres.forEach(l => {
        const opt = Utils.el("option", { value: l.id }, l.nome);
        if (dado.liderId === l.id) opt.selected = true;
        selLider.appendChild(opt);
      });
      selLider.addEventListener("change", (e) => dado.liderId = e.target.value || null);
      campoLiderWrap.appendChild(selLider);
    };
    redesenharCampoLider();

    body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:16px;" }, [
      Utils.el("button", {
        type: "button", class: "btn btn-primary",
        onclick: () => this.salvarUsuario(dado, editando, overlay, container)
      }, [Utils.el("i", { class: "fa-solid fa-check" }), editando ? " Salvar alterações" : " Criar usuário"])
    ]));

    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  salvarUsuario(dado, editando, overlay, container) {
    const missing = [];
    if (!dado.nome.trim()) missing.push("Nome");
    if (!dado.matricula.trim()) missing.push("Matrícula");
    if (!editando && !String(dado.senha || "").trim()) missing.push("Senha");
    if (missing.length) { Utils.error("Campos obrigatórios", "Preencha: " + missing.join(", ")); return; }

    const todos = DB.getFiscais();
    const duplicada = todos.find(u => u.id !== dado.id && u.matricula.toLowerCase() === dado.matricula.trim().toLowerCase());
    if (duplicada) { Utils.error("Matrícula já cadastrada", `A matrícula ${dado.matricula} já pertence a ${duplicada.nome}.`); return; }

    const user = {
      id: dado.id || Utils.uid("U"),
      nome: dado.nome.trim(),
      matricula: dado.matricula.trim(),
      senha: dado.senha ? String(dado.senha) : "1234",
      perfil: dado.perfil,
      liderId: (dado.perfil === "fiscal" || dado.perfil === "analista") ? (dado.liderId || null) : null,
      email: slugEmail(dado.nome.trim())
    };
    const salvo = DB.saveFiscal(user);
    if (!salvo) return;
    Utils.toast(editando ? "Usuário atualizado!" : "Usuário criado!");
    overlay.remove();
    this.render(container);
  },

  async excluirUsuario(user, container) {
    const dependentes = DB.getFiscais().filter(f => f.liderId === user.id).length;
    const avisoDependentes = user.perfil === "lider" && dependentes > 0
      ? `\n\nAtenção: ${dependentes} usuário(s) estão vinculados a este líder e ficarão sem líder vinculado.`
      : "";
    const ok = await Utils.confirm("Excluir usuário?", `"${user.nome}" (${this.PERFIL_LABEL[user.perfil] || user.perfil}) será excluído.${avisoDependentes}`);
    if (!ok) return;
    DB.deleteFiscal(user.id);
    Utils.toast("Usuário excluído.");
    this.render(container);
  }
};
