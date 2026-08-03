/**
 * ==========================================================================
 * GALERIA DE FOTOS
 * ==========================================================================
 */

const Gallery = {
  activeTab: "veiculo",

  render(container) {
    container.innerHTML = "";
    container.classList.add("fade-in");

    const tabs = Utils.el("div", { class: "gallery-tabs" });
    [
      ["veiculo", "Veículo", "fa-truck-pickup"],
      ["comunicacao", "Comunicação", "fa-satellite-dish"],
      ["equipe", "Equipe", "fa-people-group"],
      ["checklist", "Checklist (EPI/EPC)", "fa-list-check"]
    ].forEach(([key, label, icon]) => {
      const tab = Utils.el("button", {
        class: "gallery-tab" + (this.activeTab === key ? " active" : ""),
        onclick: () => { this.activeTab = key; this.render(container); }
      }, [Utils.el("i", { class: `fa-solid ${icon}` }), " " + label]);
      tabs.appendChild(tab);
    });
    container.appendChild(tabs);

    const cadastros = DB.getCadastros();
    const inspecoes = DB.getInspecoes();
    let items = [];

    if (this.activeTab === "veiculo") {
      cadastros.forEach(c => Object.entries(c.veiculo?.fotos || {}).forEach(([k, v]) => {
        if (v) items.push({ src: v, cap: `${c.prefixo} · ${k}` });
      }));
    } else if (this.activeTab === "comunicacao") {
      cadastros.forEach(c => {
        if (c.comunicacao?.foto) items.push({ src: c.comunicacao.foto, cap: `${c.prefixo} · ${c.comunicacao.tipo}` });
        if (c.comunicacao?.fotoDispositivo) items.push({ src: c.comunicacao.fotoDispositivo, cap: `${c.prefixo} · ${c.comunicacao.dispositivo || "Dispositivo"}` });
      });
    } else if (this.activeTab === "equipe") {
      cadastros.forEach(c => {
        if (c.fotoEquipe) items.push({ src: c.fotoEquipe, cap: `${c.prefixo} · Equipe` });
        (c.colaboradores || []).forEach(colab => {
          if (colab.foto) items.push({ src: colab.foto, cap: `${c.prefixo} · ${colab.nome || "Colaborador"}` });
        });
      });
    } else {
      inspecoes.forEach(i => {
        (i.epiPorColaborador || []).forEach(c => {
          c.itens.filter(it => it.foto).forEach(it => items.push({ src: it.foto, cap: `${i.equipePrefixo} · ${c.colaborador || "Colaborador"} · ${it.nome}` }));
        });
        if (i.epc) i.epc.itens.filter(it => it.foto).forEach(it => items.push({ src: it.foto, cap: `${i.equipePrefixo} · EPC · ${it.nome}` }));
      });
    }

    if (items.length === 0) {
      container.appendChild(Utils.el("div", { class: "empty-state" }, [
        Utils.el("i", { class: "fa-solid fa-images" }),
        Utils.el("h3", {}, "Nenhuma foto nesta categoria ainda"),
        Utils.el("p", {}, "As fotos aparecerão aqui assim que os cadastros e inspeções forem registrados.")
      ]));
      return;
    }

    const grid = Utils.el("div", { class: "gallery-grid" });
    items.reverse().forEach(item => {
      const cell = Utils.el("div", { class: "gallery-item", onclick: () => this.lightbox(item.src) }, [
        Utils.el("img", { src: item.src }),
        Utils.el("div", { class: "cap" }, item.cap)
      ]);
      grid.appendChild(cell);
    });
    container.appendChild(grid);
  },

  lightbox(src) {
    const overlay = Utils.el("div", { class: "modal-overlay", onclick: function () { this.remove(); } }, [
      Utils.el("div", { class: "lightbox-img-wrap" }, [Utils.el("img", { src })])
    ]);
    document.body.appendChild(overlay);
  }
};
