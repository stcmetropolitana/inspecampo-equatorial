/**
 * ==========================================================================
 * ORDENS DE INSPEÇÃO DE ATIVO
 * ==========================================================================
 * Fluxo:
 *   1. Líder (ou Admin) cria uma ordem e envia para um fiscal específico,
 *      indicando o equipamento/UC (Transformador, Chave de Proteção ou
 *      Unidade Consumidora) e instruções.
 *   2. O fiscal recebe a ordem no seu painel, vai a campo, registra fotos
 *      e marca as ações necessárias (+ observações) e envia para revisão.
 *   3. O líder revisa o que foi enviado e aprova ou recusa (recusada volta
 *      para o fiscal, que pode refazer e reenviar).
 * ==========================================================================
 */

const OrdensPage = {
  TIPOS_ATIVO: ["Transformador", "Chave de Proteção", "Unidade Consumidora"],
  ACAO_OUTRO: "Outro (especificar)",
  ACOES_PADRAO: [
    "Substituir equipamento",
    "Realizar religamento",
    "Realizar poda de árvore/vegetação",
    "Realizar poda",
    "Realizar faixa",
    "Notificar cliente/consumidor",
    "Regularizar ligação",
    "Realizar revitalização de ramal",
    "Trocar medidor",
    "Instalar espaçador MT",
    "Instalar espaçador BT",
    "Trocar poste",
    "Trocar cruzeta",
    "Substituir transformador",
    "Substituir chave fusível",
    "Substituir para-raio",
    "Sem irregularidades encontradas",
    "Outro (especificar)"
  ],
  STATUS_INFO: {
    pendente: { label: "Pendente", cls: "badge-warning" },
    aguardando_revisao: { label: "Aguardando revisão", cls: "badge-info" },
    aprovada: { label: "Aprovada", cls: "badge-success" },
    recusada: { label: "Recusada", cls: "badge-danger" }
  },
  filtroStatus: "",
  filtroTipoAtivo: "",
  filtroMunicipio: "",
  filtroFiscalId: "",

  // ------------------------------------------------------------------
  // Ações necessárias — cada uma vira uma pendência de correção que o
  // fiscal resolve depois, com foto comprovando (mesmo padrão do EPI/EPC).
  // Compatível com dados antigos, salvos como string simples.
  // ------------------------------------------------------------------
  nomeAcao(a) { return typeof a === "object" && a !== null ? a.acao : a; },
  resolvidoAcao(a) {
    if (typeof a === "object" && a !== null) return !!a.resolvido;
    return a === "Sem irregularidades encontradas"; // string antiga: nada a corrigir só nesse caso
  },
  contarPendenciasCorrecao(ordem) {
    return (ordem.acoesSelecionadas || []).filter(a => !this.resolvidoAcao(a)).length;
  },

  /** Lista as ações necessárias com status de correção; se podeResolver, o fiscal pode marcar corrigida (com foto). */
  renderAcoesLista(ordem, podeResolver, redesenharPai, container) {
    const acoes = ordem.acoesSelecionadas || [];
    if (!acoes.length) return Utils.el("p", {}, "—");
    const wrap = Utils.el("div", {});
    acoes.forEach((a, idx) => {
      const nome = this.nomeAcao(a);
      const linha = Utils.el("div", { class: "mt-8" });
      const cabecalho = Utils.el("div", { class: "flex items-center gap-8", style: "flex-wrap:wrap;" }, [Utils.el("span", {}, nome)]);
      linha.appendChild(cabecalho);

      if (nome === "Sem irregularidades encontradas") {
        wrap.appendChild(linha);
        return;
      }

      if (this.resolvidoAcao(a)) {
        const res = (typeof a === "object" ? a.resolucao : null);
        cabecalho.appendChild(Utils.el("span", { class: "badge badge-success" }, "Corrigida"));
        if (res) {
          const detalhe = Utils.el("div", { class: "readonly-chip mt-8", style: "align-items:flex-start;flex-direction:column;gap:4px;" });
          if (res.descricao) detalhe.appendChild(Utils.el("div", {}, [Utils.el("i", { class: "fa-solid fa-pen" }), " " + res.descricao]));
          detalhe.appendChild(Utils.el("div", { class: "text-muted", style: "font-size:.78rem;" }, [
            Utils.el("i", { class: "fa-solid fa-calendar" }), ` Corrigido em ${res.dataCorrecao ? Utils.formatDate(res.dataCorrecao) : "—"}`,
            res.equipeResponsavel ? ` · Equipe: ${res.equipeResponsavel}` : "",
            ` · Registrado por ${res.resolvidoPor || "—"} em ${Utils.formatDateTime(res.dataResolucao)}`
          ]));
          if (res.fotoResolucao) {
            detalhe.appendChild(Utils.el("img", { src: res.fotoResolucao, style: "width:60px;height:60px;object-fit:cover;border-radius:6px;cursor:pointer;margin-top:4px;", onclick: () => Gallery.lightbox(res.fotoResolucao) }));
          }
          linha.appendChild(detalhe);
        }
      } else {
        cabecalho.appendChild(Utils.el("span", { class: "badge badge-danger" }, "Pendente de correção"));
        if (podeResolver) {
          cabecalho.appendChild(Utils.el("button", {
            type: "button", class: "btn btn-secondary btn-sm",
            onclick: () => this.abrirResolucaoAcao(ordem, idx, nome, redesenharPai, container)
          }, [Utils.el("i", { class: "fa-solid fa-check" }), " Registrar correção"]));
        }
      }
      wrap.appendChild(linha);
    });
    return wrap;
  },

  /** Modal para o fiscal registrar a correção de uma ação pendente: foto + descrição + data + equipe. */
  abrirResolucaoAcao(ordem, idx, nomeAcao, redesenharPai, container) {
    const user = Auth.current();
    const equipesFiscal = [...new Set(DB.getCadastros().filter(c => c.fiscalId === user.id).map(c => (c.prefixo || "").trim().toUpperCase()).filter(Boolean))];

    const dado = { foto: null, descricao: "", dataCorrecao: new Date().toISOString().slice(0, 10), equipeResponsavel: "" };

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `Registrar correção — ${nomeAcao}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const desenharFoto = () => {
      fotoWrap.innerHTML = "";
      const slot = Utils.el("label", { class: "photo-slot" + (dado.foto ? " filled" : "") });
      if (dado.foto) {
        slot.appendChild(Utils.el("img", { src: dado.foto }));
        slot.appendChild(Utils.el("button", {
          type: "button", class: "remove-btn",
          onclick: (e) => { e.preventDefault(); e.stopPropagation(); dado.foto = null; desenharFoto(); }
        }, [Utils.el("i", { class: "fa-solid fa-trash" })]));
      } else {
        slot.appendChild(Utils.el("i", { class: "fa-solid fa-camera" }));
        slot.appendChild(Utils.el("span", { class: "label" }, "Foto da correção *"));
      }
      slot.appendChild(Utils.el("input", {
        type: "file", accept: "image/*", capture: "environment",
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try { dado.foto = await Utils.fileToCompressedBase64(file); desenharFoto(); }
          catch (err) { Utils.error("Erro ao processar imagem", err.message); }
        }
      }));
      fotoWrap.appendChild(slot);
    };
    body.appendChild(Utils.el("div", { class: "detail-item k" }, "Foto da correção *"));
    const fotoWrap = Utils.el("div", { class: "photo-upload-grid mt-8" });
    body.appendChild(fotoWrap);
    desenharFoto();

    body.appendChild(Utils.el("div", { class: "field mt-8" }, [
      Utils.el("label", {}, "Descrição da correção realizada *"),
      Utils.el("textarea", { rows: 3, placeholder: "O que foi feito para corrigir…", oninput: (e) => dado.descricao = e.target.value })
    ]));

    const grid = Utils.el("div", { class: "form-grid" });
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Data da correção *"),
      Utils.el("input", { type: "date", value: dado.dataCorrecao, oninput: (e) => dado.dataCorrecao = e.target.value })
    ]));
    const campoEquipe = Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Equipe que realizou *"),
      Utils.el("input", { type: "text", list: "equipesFiscalDatalist", placeholder: "Prefixo da equipe", oninput: (e) => dado.equipeResponsavel = e.target.value.toUpperCase() })
    ]);
    const datalist = Utils.el("datalist", { id: "equipesFiscalDatalist" });
    equipesFiscal.forEach(p => datalist.appendChild(Utils.el("option", { value: p })));
    campoEquipe.appendChild(datalist);
    grid.appendChild(campoEquipe);
    body.appendChild(grid);

    body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:16px;" }, [
      Utils.el("button", {
        type: "button", class: "btn btn-primary",
        onclick: () => {
          if (!dado.foto) { Utils.error("Faltam informações", "Anexe uma foto comprovando a correção."); return; }
          if (!dado.descricao.trim()) { Utils.error("Faltam informações", "Descreva a correção realizada."); return; }
          if (!dado.dataCorrecao) { Utils.error("Faltam informações", "Informe a data da correção."); return; }
          if (!dado.equipeResponsavel.trim()) { Utils.error("Faltam informações", "Informe a equipe que realizou a correção."); return; }

          ordem.acoesSelecionadas[idx] = {
            acao: nomeAcao, resolvido: true,
            resolucao: {
              fotoResolucao: dado.foto,
              descricao: dado.descricao.trim(),
              dataCorrecao: dado.dataCorrecao,
              equipeResponsavel: dado.equipeResponsavel.trim(),
              dataResolucao: Utils.nowISO(),
              resolvidoPor: user ? user.nome : "—"
            }
          };
          const salvo = DB.saveOrdem(ordem);
          if (!salvo) return;
          Utils.toast("Correção registrada!");
          overlay.remove();
          if (redesenharPai) redesenharPai();
        }
      }, [Utils.el("i", { class: "fa-solid fa-check" }), " Salvar correção"])
    ]));

    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  render(container) {
    const user = Auth.current();
    container.innerHTML = "";
    container.classList.add("fade-in");
    if (user.perfil === "fiscal") this.renderFiscal(container, user);
    else this.renderLiderAdmin(container, user);
  },

  // ======================================================================
  // VISÃO DO FISCAL
  // ======================================================================
  renderFiscal(container, user) {
    const minhasOrdens = DB.getOrdens().filter(o => o.fiscalId === user.id)
      .sort((a, b) => new Date(b.dataEnvioISO) - new Date(a.dataEnvioISO));

    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    [
      { label: "Pendentes de preenchimento", value: minhasOrdens.filter(o => o.status === "pendente" || o.status === "recusada").length, icon: "fa-hourglass-half", cls: "c-amber" },
      { label: "Aguardando revisão do líder", value: minhasOrdens.filter(o => o.status === "aguardando_revisao").length, icon: "fa-magnifying-glass", cls: "c-teal" },
      { label: "Aprovadas", value: minhasOrdens.filter(o => o.status === "aprovada").length, icon: "fa-check", cls: "c-green" },
      { label: "Ações pendentes de correção", value: minhasOrdens.reduce((s, o) => s + this.contarPendenciasCorrecao(o), 0), icon: "fa-screwdriver-wrench", cls: "c-red" }
    ].forEach(k => kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
      Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
      Utils.el("div", { class: "value" }, String(k.value)),
      Utils.el("div", { class: "label" }, k.label)
    ])));
    container.appendChild(kpiGrid);

    container.appendChild(this.filterBar(container, minhasOrdens, false));

    const panel = Utils.el("div", { class: "panel" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Minhas Ordens de Inspeção"),
      Utils.el("span", { class: "tag" }, `${minhasOrdens.length} ordem(ns)`)
    ]));

    const lista = minhasOrdens.filter(o =>
      (!this.filtroStatus || o.status === this.filtroStatus) &&
      (!this.filtroTipoAtivo || o.tipoAtivo === this.filtroTipoAtivo) &&
      (!this.filtroMunicipio || o.municipio === this.filtroMunicipio)
    );

    if (lista.length === 0) {
      panel.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-clipboard-list" }),
        Utils.el("h3", {}, "Nenhuma ordem de inspeção encontrada"),
        Utils.el("p", {}, "Quando seu líder enviar uma ordem de inspeção de ativo, ela aparece aqui.")
      ]));
    } else {
      const table = Utils.el("table");
      table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "Enviada em"), Utils.el("th", {}, "Equipamento/UC"), Utils.el("th", {}, "Identificação"),
        Utils.el("th", {}, "Município"), Utils.el("th", {}, "Prioridade"), Utils.el("th", {}, "Prazo"),
        Utils.el("th", {}, "Status"), Utils.el("th", {}, "")
      ])]));
      const tbody = Utils.el("tbody");
      lista.forEach(o => {
        const st = this.STATUS_INFO[o.status] || this.STATUS_INFO.pendente;
        const podePreencher = o.status === "pendente" || o.status === "recusada";
        const pendCorrecao = this.contarPendenciasCorrecao(o);
        const statusCell = [Utils.el("span", { class: `badge ${st.cls}` }, st.label)];
        if (pendCorrecao > 0) statusCell.push(Utils.el("span", { class: "badge badge-danger", style: "margin-left:4px;" }, `${pendCorrecao} p/ corrigir`));
        tbody.appendChild(Utils.el("tr", {}, [
          Utils.el("td", { class: "mono" }, Utils.formatDateTime(o.dataEnvioISO)),
          Utils.el("td", {}, [Utils.el("b", {}, o.tipoAtivo)]),
          Utils.el("td", {}, o.identificacao || "—"),
          Utils.el("td", {}, o.municipio),
          Utils.el("td", {}, o.prioridade),
          Utils.el("td", { class: "mono" }, o.prazo ? Utils.formatDate(o.prazo) : "—"),
          Utils.el("td", {}, statusCell),
          Utils.el("td", {}, [Utils.el("button", {
            class: `btn btn-sm ${podePreencher ? "btn-primary" : "btn-ghost"}`,
            onclick: () => this.abrirExecucao(o, container)
          }, [Utils.el("i", { class: `fa-solid ${podePreencher ? "fa-camera" : "fa-eye"}` }), podePreencher ? " Preencher Inspeção" : " Ver"])])
        ]));
      });
      table.appendChild(tbody);
      panel.appendChild(table);
    }
    container.appendChild(panel);
  },

  /** ordensParaOpcoes alimenta as opções de Município/Fiscal; mostrarFiscal só aparece na visão de líder/analista/admin. */
  filterBar(container, ordensParaOpcoes, mostrarFiscal) {
    const municipios = [...new Set(ordensParaOpcoes.map(o => o.municipio).filter(Boolean))].sort();
    const fiscais = [...new Map(ordensParaOpcoes.map(o => [o.fiscalId, o.fiscalNome])).entries()].sort((a, b) => (a[1] || "").localeCompare(b[1] || ""));

    const bar = Utils.el("div", { class: "filter-bar" });

    const campoSelect = (label, valorAtual, opcoes, onChange) => {
      const f = Utils.el("div", { class: "field" }, [Utils.el("label", {}, label)]);
      const sel = Utils.el("select", {});
      sel.appendChild(Utils.el("option", { value: "" }, "Todos"));
      opcoes.forEach(([val, texto]) => {
        const opt = Utils.el("option", { value: val }, texto);
        if (valorAtual === val) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener("change", (e) => { onChange(e.target.value); this.render(container); });
      f.appendChild(sel);
      return f;
    };

    bar.appendChild(campoSelect("Status", this.filtroStatus, Object.entries(this.STATUS_INFO).map(([k, v]) => [k, v.label]), (v) => this.filtroStatus = v));
    bar.appendChild(campoSelect("Equipamento", this.filtroTipoAtivo, this.TIPOS_ATIVO.map(t => [t, t]), (v) => this.filtroTipoAtivo = v));
    bar.appendChild(campoSelect("Município", this.filtroMunicipio, municipios.map(m => [m, m]), (v) => this.filtroMunicipio = v));
    if (mostrarFiscal) bar.appendChild(campoSelect("Fiscal", this.filtroFiscalId, fiscais.map(([id, nome]) => [id, nome]), (v) => this.filtroFiscalId = v));

    bar.appendChild(Utils.el("button", {
      class: "btn btn-ghost btn-sm",
      onclick: () => { this.filtroStatus = ""; this.filtroTipoAtivo = ""; this.filtroMunicipio = ""; this.filtroFiscalId = ""; this.render(container); }
    }, "Limpar filtros"));
    return bar;
  },

  /** Grid de fotos editável (array de base64), reaproveitando o visual de photo-slot */
  fotoSlotArray(fotos, idx, redesenhar) {
    const value = fotos[idx];
    const slot = Utils.el("label", { class: "photo-slot" + (value ? " filled" : "") });
    if (value) slot.appendChild(Utils.el("img", { src: value }));
    else {
      slot.appendChild(Utils.el("i", { class: "fa-solid fa-camera" }));
      slot.appendChild(Utils.el("span", { class: "label" }, "Foto"));
    }
    if (value) {
      slot.appendChild(Utils.el("button", {
        type: "button", class: "remove-btn",
        onclick: (e) => { e.preventDefault(); e.stopPropagation(); fotos.splice(idx, 1); redesenhar(); }
      }, [Utils.el("i", { class: "fa-solid fa-trash" })]));
    }
    slot.appendChild(Utils.el("input", {
      type: "file", accept: "image/*", capture: "environment",
      onchange: async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try { fotos[idx] = await Utils.fileToCompressedBase64(file); redesenhar(); }
        catch (err) { Utils.error("Erro ao processar imagem", err.message); }
      }
    }));
    return slot;
  },

  renderFotosGrid(fotos, redesenhar, max = 8) {
    const grid = Utils.el("div", { class: "photo-upload-grid mt-8" });
    fotos.forEach((_, idx) => grid.appendChild(this.fotoSlotArray(fotos, idx, redesenhar)));
    if (fotos.length < max) {
      const addSlot = Utils.el("label", { class: "photo-slot" }, [
        Utils.el("i", { class: "fa-solid fa-plus" }),
        Utils.el("span", { class: "label" }, `Adicionar foto (${fotos.length}/${max})`)
      ]);
      addSlot.appendChild(Utils.el("input", {
        type: "file", accept: "image/*", capture: "environment",
        onchange: async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try { fotos.push(await Utils.fileToCompressedBase64(file)); redesenhar(); }
          catch (err) { Utils.error("Erro ao processar imagem", err.message); }
        }
      }));
      grid.appendChild(addSlot);
    }
    return grid;
  },

  /** Abre o modal de preenchimento (pendente/recusada) ou visualização (demais status) */
  abrirExecucao(ordem, container) {
    const editavel = ordem.status === "pendente" || ordem.status === "recusada";
    const nomesSalvos = (ordem.acoesSelecionadas || []).map(a => this.nomeAcao(a));
    const extras = nomesSalvos.filter(n => !this.ACOES_PADRAO.includes(n));
    const exec = {
      fotos: [...(ordem.fotos || [])],
      acoesSelecionadas: nomesSalvos.filter(n => this.ACOES_PADRAO.includes(n)).concat(extras.length ? [this.ACAO_OUTRO] : []),
      outroTexto: extras.join("; "),
      observacoesFiscal: ordem.observacoesFiscal || "",
      gps: ordem.gpsFiscal || null
    };

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `${ordem.tipoAtivo} — ${ordem.identificacao || ordem.municipio}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });
    box.appendChild(body);

    const desenhar = () => {
      body.innerHTML = "";

      const grid = Utils.el("div", { class: "detail-grid" });
      [
        ["Equipamento/UC", ordem.tipoAtivo], ["Identificação", ordem.identificacao || "—"],
        ["Município", ordem.municipio], ["Endereço/Referência", ordem.endereco || "—"],
        ["Prioridade", ordem.prioridade], ["Prazo", ordem.prazo ? Utils.formatDate(ordem.prazo) : "—"],
        ["Enviado por", `${ordem.criadoPorNome || "—"}${ordem.criadoPorPerfil === "analista" ? " (Analista)" : ordem.criadoPorPerfil === "lider" ? " (Líder)" : ""}`], ["Data de envio", Utils.formatDateTime(ordem.dataEnvioISO)]
      ].forEach(([k, v]) => grid.appendChild(Utils.el("div", { class: "detail-item" }, [Utils.el("div", { class: "k" }, k), Utils.el("div", { class: "v" }, v || "—")])));
      body.appendChild(grid);

      if (ordem.motivo) {
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Instruções do líder"));
        body.appendChild(Utils.el("p", { class: "mt-8" }, ordem.motivo));
      }

      if (!editavel) {
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Registro fotográfico"));
        if ((ordem.fotos || []).length) {
          const pg = Utils.el("div", { class: "detail-photos" });
          ordem.fotos.forEach(src => pg.appendChild(Utils.el("img", { src, onclick: () => Gallery.lightbox(src) })));
          body.appendChild(pg);
        } else {
          body.appendChild(Utils.el("p", { class: "text-muted" }, "Nenhuma foto registrada ainda."));
        }
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Ações necessárias"));
        body.appendChild(this.renderAcoesLista(ordem, true, desenhar, container));
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Observações"));
        body.appendChild(Utils.el("p", {}, ordem.observacoesFiscal || "—"));

        if (ordem.status === "aguardando_revisao") {
          body.appendChild(Utils.el("div", { class: "readonly-chip mt-8" }, [Utils.el("i", { class: "fa-solid fa-hourglass-half" }), " Aguardando revisão do líder"]));
        } else if (ordem.revisao) {
          body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Revisão do líder"));
          body.appendChild(Utils.el("span", { class: `badge ${this.STATUS_INFO[ordem.status].cls}` }, this.STATUS_INFO[ordem.status].label));
          if (ordem.revisao.comentario) body.appendChild(Utils.el("p", { class: "mt-8" }, ordem.revisao.comentario));
        }
        return;
      }

      if (ordem.status === "recusada" && ordem.revisao?.comentario) {
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Motivo da recusa (líder)"));
        body.appendChild(Utils.el("p", { class: "mt-8", style: "color:var(--color-danger);" }, ordem.revisao.comentario));
      }

      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Registro fotográfico *"));
      body.appendChild(this.renderFotosGrid(exec.fotos, desenhar));

      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Ações necessárias"));
      const acoesWrap = Utils.el("div", { class: "radio-group mt-8" });
      this.ACOES_PADRAO.forEach(acao => {
        const checked = exec.acoesSelecionadas.includes(acao);
        const chip = Utils.el("label", { class: "radio-chip" + (checked ? " checked" : "") }, [
          Utils.el("input", { type: "checkbox", ...(checked ? { checked: "checked" } : {}) }),
          acao
        ]);
        chip.querySelector("input").addEventListener("change", (e) => {
          if (e.target.checked) exec.acoesSelecionadas.push(acao);
          else exec.acoesSelecionadas = exec.acoesSelecionadas.filter(a => a !== acao);
          chip.classList.toggle("checked", e.target.checked);
          if (acao === this.ACAO_OUTRO) desenhar();
        });
        acoesWrap.appendChild(chip);
      });
      body.appendChild(acoesWrap);

      if (exec.acoesSelecionadas.includes(this.ACAO_OUTRO)) {
        body.appendChild(Utils.el("div", { class: "field mt-8" }, [
          Utils.el("label", {}, 'Especifique a(s) ação(ões) de "Outro" *'),
          Utils.el("textarea", { rows: 2, placeholder: "Descreva a ação necessária que não está na lista…", oninput: (e) => exec.outroTexto = e.target.value }, exec.outroTexto)
        ]));
      }

      body.appendChild(Utils.el("div", { class: "field mt-8" }, [
        Utils.el("label", {}, "Observações"),
        Utils.el("textarea", { rows: 3, oninput: (e) => exec.observacoesFiscal = e.target.value }, exec.observacoesFiscal)
      ]));

      body.appendChild(Utils.el("div", { class: "readonly-chip mt-8" }, [
        Utils.el("i", { class: "fa-solid fa-location-crosshairs" }),
        Utils.el("span", {}, exec.gps ? `${exec.gps.lat.toFixed(5)}, ${exec.gps.lng.toFixed(5)}` : "GPS não capturado (opcional)")
      ]));
      body.appendChild(Utils.el("button", {
        type: "button", class: "btn btn-secondary btn-sm mt-8",
        onclick: async () => {
          try { exec.gps = await Utils.captureGPS(); desenhar(); }
          catch (err) { Utils.error("Não foi possível capturar o GPS", err.message || "Verifique as permissões de localização."); }
        }
      }, [Utils.el("i", { class: "fa-solid fa-location-crosshairs" }), " Capturar GPS"]));

      body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:16px;" }, [
        Utils.el("button", {
          type: "button", class: "btn btn-primary",
          onclick: () => this.enviarExecucao(ordem, exec, overlay, container)
        }, [Utils.el("i", { class: "fa-solid fa-paper-plane" }), " Enviar para revisão"])
      ]));
    };

    desenhar();
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  enviarExecucao(ordem, exec, overlay, container) {
    if (!exec.fotos.length) { Utils.error("Faltam informações", "Adicione ao menos uma foto do registro fotográfico."); return; }
    if (!exec.acoesSelecionadas.length && !exec.observacoesFiscal.trim()) {
      Utils.error("Faltam informações", "Marque ao menos uma ação necessária ou escreva uma observação.");
      return;
    }
    let acoesSelecionadas = [...exec.acoesSelecionadas];
    if (acoesSelecionadas.includes(this.ACAO_OUTRO)) {
      const texto = (exec.outroTexto || "").trim();
      if (!texto) { Utils.error("Faltam informações", 'Descreva a ação em "Outro (especificar)" ou desmarque a opção.'); return; }
      acoesSelecionadas = acoesSelecionadas.filter(a => a !== this.ACAO_OUTRO).concat([texto]);
    }
    // Cada ação marcada (exceto "Sem irregularidades") vira uma pendência de
    // correção que o próprio fiscal precisa resolver depois, com foto —
    // preserva o que já tiver sido corrigido antes, em caso de reenvio.
    const anterioresPorNome = new Map((ordem.acoesSelecionadas || []).map(a => [this.nomeAcao(a), a]));
    const acoesFinal = acoesSelecionadas.map(nome => {
      if (nome === "Sem irregularidades encontradas") return { acao: nome, resolvido: true, resolucao: null };
      const anterior = anterioresPorNome.get(nome);
      if (anterior && this.resolvidoAcao(anterior)) return anterior;
      return { acao: nome, resolvido: false, resolucao: null };
    });
    const atualizado = {
      ...ordem,
      fotos: exec.fotos,
      acoesSelecionadas: acoesFinal,
      observacoesFiscal: exec.observacoesFiscal.trim(),
      gpsFiscal: exec.gps,
      dataExecucaoISO: Utils.nowISO(),
      status: "aguardando_revisao",
      revisao: null
    };
    const salvo = DB.saveOrdem(atualizado);
    if (!salvo) return;
    Utils.toast("Inspeção enviada para revisão do líder!");
    overlay.remove();
    this.render(container);
  },

  // ======================================================================
  // VISÃO DO LÍDER / ADMINISTRADOR
  // ======================================================================
  renderLiderAdmin(container, user) {
    // Escopo único: líder, analista e administrador enxergam e enviam
    // ordens para QUALQUER fiscal do sistema — não é mais restrito por
    // líder vinculado. (O Painel do Líder de cadastros/inspeções, em
    // js/lider.js, é outra tela e continua organizado por equipe.)
    const todasOrdens = DB.getOrdens().sort((a, b) => new Date(b.dataEnvioISO) - new Date(a.dataEnvioISO));
    const minhasOrdens = todasOrdens;
    const fiscaisDisponiveis = DB.getFiscais().filter(f => f.perfil === "fiscal");

    const kpiGrid = Utils.el("div", { class: "kpi-grid" });
    [
      { label: "Total de ordens", value: minhasOrdens.length, icon: "fa-clipboard-list", cls: "c-blue" },
      { label: "Pendentes (fiscal ainda não enviou)", value: minhasOrdens.filter(o => o.status === "pendente").length, icon: "fa-hourglass-half", cls: "c-amber" },
      { label: "Aguardando revisão", value: minhasOrdens.filter(o => o.status === "aguardando_revisao").length, icon: "fa-magnifying-glass", cls: "c-teal" },
      { label: "Aprovadas", value: minhasOrdens.filter(o => o.status === "aprovada").length, icon: "fa-check", cls: "c-green" },
      { label: "Ações pendentes de correção", value: minhasOrdens.reduce((s, o) => s + this.contarPendenciasCorrecao(o), 0), icon: "fa-screwdriver-wrench", cls: "c-red" }
    ].forEach(k => kpiGrid.appendChild(Utils.el("div", { class: `kpi-card ${k.cls}` }, [
      Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${k.icon}` })]),
      Utils.el("div", { class: "value" }, String(k.value)),
      Utils.el("div", { class: "label" }, k.label)
    ])));
    container.appendChild(kpiGrid);

    container.appendChild(Utils.el("button", {
      class: "btn btn-primary mb-16",
      onclick: () => this.abrirFormNovaOrdem(container, user, fiscaisDisponiveis)
    }, [Utils.el("i", { class: "fa-solid fa-paper-plane" }), " Nova Ordem de Inspeção"]));

    container.appendChild(this.filterBar(container, minhasOrdens, true));

    const panel = Utils.el("div", { class: "panel" });
    panel.appendChild(Utils.el("div", { class: "panel-head" }, [
      Utils.el("h3", {}, "Todas as Ordens de Inspeção"),
      Utils.el("span", { class: "tag" }, `${minhasOrdens.length} ordem(ns)`)
    ]));

    const lista = minhasOrdens.filter(o =>
      (!this.filtroStatus || o.status === this.filtroStatus) &&
      (!this.filtroTipoAtivo || o.tipoAtivo === this.filtroTipoAtivo) &&
      (!this.filtroMunicipio || o.municipio === this.filtroMunicipio) &&
      (!this.filtroFiscalId || o.fiscalId === this.filtroFiscalId)
    );

    if (lista.length === 0) {
      panel.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-clipboard-list" }),
        Utils.el("h3", {}, "Nenhuma ordem de inspeção encontrada"),
        Utils.el("p", {}, 'Clique em "Nova Ordem de Inspeção" para enviar uma para um fiscal.')
      ]));
    } else {
      const table = Utils.el("table");
      table.appendChild(Utils.el("thead", {}, [Utils.el("tr", {}, [
        Utils.el("th", {}, "Enviada em"), Utils.el("th", {}, "Enviado por"), Utils.el("th", {}, "Fiscal"), Utils.el("th", {}, "Equipamento/UC"),
        Utils.el("th", {}, "Identificação"), Utils.el("th", {}, "Prioridade"), Utils.el("th", {}, "Status"), Utils.el("th", {}, "")
      ])]));
      const tbody = Utils.el("tbody");
      lista.forEach(o => {
        const st = this.STATUS_INFO[o.status] || this.STATUS_INFO.pendente;
        const precisaRevisar = o.status === "aguardando_revisao";
        const botoes = [Utils.el("button", {
          class: `btn btn-sm ${precisaRevisar ? "btn-primary" : "btn-ghost"}`,
          onclick: () => this.abrirRevisao(o, container)
        }, [Utils.el("i", { class: `fa-solid ${precisaRevisar ? "fa-magnifying-glass" : "fa-eye"}` }), precisaRevisar ? " Revisar" : " Ver"])];
        if (o.status === "pendente") {
          botoes.push(Utils.el("button", {
            class: "btn btn-danger btn-sm",
            onclick: () => this.excluirOrdem(o, container)
          }, [Utils.el("i", { class: "fa-solid fa-trash" }), " Excluir"]));
        }
        const perfilTag = o.criadoPorPerfil === "analista" ? " (Analista)" : o.criadoPorPerfil === "lider" ? " (Líder)" : "";
        const pendCorrecao = this.contarPendenciasCorrecao(o);
        const statusCell = [Utils.el("span", { class: `badge ${st.cls}` }, st.label)];
        if (pendCorrecao > 0) statusCell.push(Utils.el("span", { class: "badge badge-danger", style: "margin-left:4px;" }, `${pendCorrecao} p/ corrigir`));
        tbody.appendChild(Utils.el("tr", {}, [
          Utils.el("td", { class: "mono" }, Utils.formatDateTime(o.dataEnvioISO)),
          Utils.el("td", {}, `${o.criadoPorNome || "—"}${perfilTag}`),
          Utils.el("td", {}, o.fiscalNome),
          Utils.el("td", {}, [Utils.el("b", {}, o.tipoAtivo)]),
          Utils.el("td", {}, o.identificacao || "—"),
          Utils.el("td", {}, o.prioridade),
          Utils.el("td", {}, statusCell),
          Utils.el("td", { class: "flex gap-8" }, botoes)
        ]));
      });
      table.appendChild(tbody);
      panel.appendChild(table);
    }
    container.appendChild(panel);
  },

  abrirFormNovaOrdem(container, user, fiscaisDisponiveis) {
    if (!fiscaisDisponiveis.length) {
      Utils.error("Nenhum fiscal disponível", "Não há fiscais vinculados a você para enviar uma ordem de inspeção.");
      return;
    }
    const nova = { fiscalId: "", tipoAtivo: this.TIPOS_ATIVO[0], identificacao: "", municipio: "", endereco: "", prioridade: "Média", prazo: "", motivo: "" };

    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, "Nova Ordem de Inspeção"),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const grid = Utils.el("div", { class: "form-grid" });
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Fiscal *"),
      (() => {
        const sel = Utils.el("select", {});
        sel.appendChild(Utils.el("option", { value: "" }, "Selecione"));
        fiscaisDisponiveis.forEach(f => sel.appendChild(Utils.el("option", { value: f.id }, f.nome)));
        sel.addEventListener("change", (e) => nova.fiscalId = e.target.value);
        return sel;
      })()
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Equipamento/UC *"),
      (() => {
        const sel = Utils.el("select", {});
        this.TIPOS_ATIVO.forEach(t => sel.appendChild(Utils.el("option", { value: t }, t)));
        sel.addEventListener("change", (e) => nova.tipoAtivo = e.target.value);
        return sel;
      })()
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Identificação (nº poste, UC, série…)"),
      Utils.el("input", { type: "text", oninput: (e) => nova.identificacao = e.target.value })
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Município *"),
      Utils.el("input", { type: "text", oninput: (e) => nova.municipio = e.target.value })
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Endereço/Referência"),
      Utils.el("input", { type: "text", oninput: (e) => nova.endereco = e.target.value })
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Prioridade"),
      (() => {
        const sel = Utils.el("select", {});
        ["Baixa", "Média", "Alta"].forEach(p => {
          const opt = Utils.el("option", { value: p }, p);
          if (p === "Média") opt.selected = true;
          sel.appendChild(opt);
        });
        sel.addEventListener("change", (e) => nova.prioridade = e.target.value);
        return sel;
      })()
    ]));
    grid.appendChild(Utils.el("div", { class: "field" }, [
      Utils.el("label", {}, "Prazo"),
      Utils.el("input", { type: "date", oninput: (e) => nova.prazo = e.target.value })
    ]));
    body.appendChild(grid);

    body.appendChild(Utils.el("div", { class: "field mt-8" }, [
      Utils.el("label", {}, "Motivo / Instruções para o fiscal *"),
      Utils.el("textarea", { rows: 3, oninput: (e) => nova.motivo = e.target.value })
    ]));

    body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:16px;" }, [
      Utils.el("button", {
        type: "button", class: "btn btn-primary",
        onclick: () => this.enviarNovaOrdem(nova, user, overlay, container)
      }, [Utils.el("i", { class: "fa-solid fa-paper-plane" }), " Enviar para o Fiscal"])
    ]));

    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  enviarNovaOrdem(nova, user, overlay, container) {
    const missing = [];
    if (!nova.fiscalId) missing.push("Fiscal");
    if (!nova.municipio.trim()) missing.push("Município");
    if (!nova.motivo.trim()) missing.push("Motivo / Instruções");
    if (missing.length) { Utils.error("Campos obrigatórios", "Preencha: " + missing.join(", ")); return; }

    const fiscal = DB.getFiscais().find(f => f.id === nova.fiscalId);
    const ordem = {
      id: Utils.uid("ord"),
      liderId: fiscal ? fiscal.liderId : null, // líder responsável pelo fiscal (define quem vê/revisa)
      criadoPorId: user.id, criadoPorNome: user.nome, criadoPorPerfil: user.perfil,
      fiscalId: nova.fiscalId, fiscalNome: fiscal ? fiscal.nome : "",
      tipoAtivo: nova.tipoAtivo,
      identificacao: nova.identificacao.trim(),
      municipio: nova.municipio.trim(),
      endereco: nova.endereco.trim(),
      prioridade: nova.prioridade,
      prazo: nova.prazo,
      motivo: nova.motivo.trim(),
      dataEnvioISO: Utils.nowISO(),
      status: "pendente",
      fotos: [], acoesSelecionadas: [], observacoesFiscal: "", gpsFiscal: null, dataExecucaoISO: null,
      revisao: null
    };
    const salvo = DB.saveOrdem(ordem);
    if (!salvo) return;
    Utils.toast(`Ordem de inspeção enviada para ${ordem.fiscalNome}!`);
    overlay.remove();
    this.render(container);
  },

  abrirRevisao(ordem, container) {
    const overlay = Utils.el("div", { class: "modal-overlay" });
    const box = Utils.el("div", { class: "modal-box" });
    box.appendChild(Utils.el("div", { class: "modal-head" }, [
      Utils.el("h3", {}, `${ordem.tipoAtivo} — ${ordem.fiscalNome}`),
      Utils.el("button", { class: "modal-close", onclick: () => overlay.remove() }, [Utils.el("i", { class: "fa-solid fa-xmark" })])
    ]));
    const body = Utils.el("div", { class: "modal-body" });

    const grid = Utils.el("div", { class: "detail-grid" });
    [
      ["Identificação", ordem.identificacao || "—"], ["Município", ordem.municipio],
      ["Endereço/Referência", ordem.endereco || "—"], ["Prioridade", ordem.prioridade],
      ["Enviada por", `${ordem.criadoPorNome || "—"}${ordem.criadoPorPerfil === "analista" ? " (Analista)" : ordem.criadoPorPerfil === "lider" ? " (Líder)" : ""}`],
      ["Enviada ao fiscal em", Utils.formatDateTime(ordem.dataEnvioISO)],
      ["Executada em", ordem.dataExecucaoISO ? Utils.formatDateTime(ordem.dataExecucaoISO) : "—"],
      ["GPS do fiscal", ordem.gpsFiscal ? `${ordem.gpsFiscal.lat.toFixed(5)}, ${ordem.gpsFiscal.lng.toFixed(5)}` : "—"]
    ].forEach(([k, v]) => grid.appendChild(Utils.el("div", { class: "detail-item" }, [Utils.el("div", { class: "k" }, k), Utils.el("div", { class: "v" }, v || "—")])));
    body.appendChild(grid);

    if (ordem.motivo) {
      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Instruções originais"));
      body.appendChild(Utils.el("p", { class: "mt-8" }, ordem.motivo));
    }

    if (ordem.status === "pendente") {
      body.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-hourglass-half" }),
        Utils.el("h3", {}, "Aguardando o fiscal"),
        Utils.el("p", {}, "O fiscal ainda não iniciou o preenchimento desta ordem.")
      ]));
    } else {
      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Registro fotográfico"));
      if ((ordem.fotos || []).length) {
        const pg = Utils.el("div", { class: "detail-photos" });
        ordem.fotos.forEach(src => pg.appendChild(Utils.el("img", { src, onclick: () => Gallery.lightbox(src) })));
        body.appendChild(pg);
      } else {
        body.appendChild(Utils.el("p", { class: "text-muted" }, "Nenhuma foto registrada."));
      }
      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Ações necessárias"));
      body.appendChild(this.renderAcoesLista(ordem, false, null, container));
      body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Observações do fiscal"));
      body.appendChild(Utils.el("p", {}, ordem.observacoesFiscal || "—"));

      if (ordem.status === "aguardando_revisao") {
        const comentarioField = Utils.el("textarea", { rows: 2, placeholder: "Comentário (obrigatório para recusar)" });
        body.appendChild(Utils.el("div", { class: "field mt-16" }, [Utils.el("label", {}, "Comentário da revisão"), comentarioField]));
        body.appendChild(Utils.el("div", { class: "flex gap-8", style: "justify-content:flex-end;margin-top:8px;" }, [
          Utils.el("button", { type: "button", class: "btn btn-danger", onclick: () => this.revisarOrdem(ordem, "recusada", comentarioField.value, overlay, container) }, [Utils.el("i", { class: "fa-solid fa-xmark" }), " Recusar"]),
          Utils.el("button", { type: "button", class: "btn btn-primary", onclick: () => this.revisarOrdem(ordem, "aprovada", comentarioField.value, overlay, container) }, [Utils.el("i", { class: "fa-solid fa-check" }), " Aprovar"])
        ]));
      } else if (ordem.revisao) {
        body.appendChild(Utils.el("div", { class: "detail-item k mt-8" }, "Sua revisão"));
        body.appendChild(Utils.el("span", { class: `badge ${this.STATUS_INFO[ordem.status].cls}` }, this.STATUS_INFO[ordem.status].label));
        if (ordem.revisao.comentario) body.appendChild(Utils.el("p", { class: "mt-8" }, ordem.revisao.comentario));
      }
    }

    box.appendChild(body);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  },

  revisarOrdem(ordem, status, comentario, overlay, container) {
    if (status === "recusada" && !comentario.trim()) {
      Utils.error("Comentário obrigatório", "Explique o motivo da recusa para o fiscal poder corrigir.");
      return;
    }
    const user = Auth.current();
    const atualizado = { ...ordem, status, revisao: { status, comentario: comentario.trim(), revisorId: user.id, revisorNome: user.nome, revisorPerfil: user.perfil, dataISO: Utils.nowISO() } };
    const salvo = DB.saveOrdem(atualizado);
    if (!salvo) return;
    Utils.toast(status === "aprovada" ? "Inspeção aprovada!" : "Inspeção recusada — o fiscal poderá corrigir e reenviar.");
    overlay.remove();
    this.render(container);
  },

  async excluirOrdem(ordem, container) {
    const ok = await Utils.confirm("Excluir ordem de inspeção?", `A ordem de "${ordem.tipoAtivo}" para ${ordem.fiscalNome} será excluída.`);
    if (!ok) return;
    DB.deleteOrdem(ordem.id);
    Utils.toast("Ordem de inspeção excluída.");
    this.render(container);
  }
};
