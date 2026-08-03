/**
 * ==========================================================================
 * APP.JS — Bootstrap, roteamento e integração dos módulos
 * ==========================================================================
 */

const Router = {
  routes: {
    dashboard: { title: "Dashboard", render: (c) => DashboardPage.render(c), roles: ["admin"], icon: "fa-chart-line", label: "Dashboard", live: true },
    usuarios: { title: "Gestão de Usuários", render: (c) => UsersPage.render(c), roles: ["admin"], icon: "fa-users-gear", label: "Usuários", live: true },
    painel: { title: "Meu Painel", render: (c) => FiscalPanelPage.render(c), roles: ["fiscal"], icon: "fa-gauge", label: "Meu Painel", live: true },
    cadastro: { title: "Cadastro de Equipe", render: (c) => CadastroPage.render(c), roles: ["fiscal"], icon: "fa-id-card", label: "Cadastro de Equipe", live: false },
    inspecao: { title: "Inspeção de Equipe", render: (c) => InspectionPage.render(c), roles: ["fiscal"], icon: "fa-clipboard-list", label: "Inspeção de Equipe", live: false },
    lider: { title: "Painel do Líder", render: (c) => LiderPage.render(c), roles: ["lider", "admin"], icon: "fa-user-tie", label: "Painel do Líder", live: true },
    producao: { title: "Produção das Equipes", render: (c) => ProducaoPage.render(c), roles: ["admin", "lider", "fiscal"], icon: "fa-chart-column", label: "Produção", live: true },
    ordens: { title: "Ordens de Inspeção de Ativo", render: (c) => OrdensPage.render(c), roles: ["admin", "lider", "fiscal", "analista"], icon: "fa-bolt", label: "Ordens de Inspeção", live: true },
    historico: { title: "Histórico", render: (c) => HistoryPage.render(c), roles: ["admin"], icon: "fa-clock-rotate-left", label: "Histórico", live: true },
    galeria: { title: "Galeria de Fotos", render: (c) => Gallery.render(c), roles: ["admin"], icon: "fa-images", label: "Galeria", live: true },
    exportacoes: { title: "Exportações", render: (c) => App.renderExportPage(c), roles: ["admin"], icon: "fa-file-export", label: "Exportações", live: false }
  },
  current: "dashboard",

  go(key) {
    this.current = key;
    App.renderMenu();
    App.renderPage();
    App.startLivePolling();
    if (window.innerWidth <= 960) Utils.qs("#sidebar").classList.remove("open");
  }
};

const App = {
  liveInterval: null,

  init() {
    seedDemoData();
    this.bindLogin();
    this.bindShell();
    this.startClock();
    this.watchDbPronto();

    const session = Auth.current();
    if (session) this.enterApp();

    DB.onChange(() => {
      if (!Auth.current() || Utils.qs("#appShell").classList.contains("hidden")) return;
      const route = Router.routes[Router.current];
      if (route && route.live) this.renderPage();
    });
  },

  /** Mantém o botão "Entrar" bloqueado até os usuários terminarem de carregar do servidor. */
  watchDbPronto() {
    const btn = Utils.qs("#btnLoginSubmit");
    const hint = Utils.qs("#loginHint");
    const liberar = () => {
      if (!btn) return;
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
      if (hint) hint.style.display = "none";
    };
    if (DB.pronto) { liberar(); return; }
    window.addEventListener("db:ready", liberar, { once: true });
    // Segurança extra: se a rede estiver lenta, libera mesmo assim depois de
    // um tempo, para a pessoa não ficar travada sem conseguir nem tentar.
    setTimeout(() => { if (!DB.pronto) liberar(); }, 8000);
  },

  /**
   * Reforço de sincronização: além de reagir a eventos de mudança do banco,
   * atualiza páginas "ao vivo" (Dashboard, painéis, listas) periodicamente.
   * Isso garante que, mesmo se algum evento não chegar a tempo, os dados
   * de todo mundo ficam corretos em poucos segundos.
   */
  startLivePolling() {
    clearInterval(this.liveInterval);
    const route = Router.routes[Router.current];
    if (!route || !route.live) return;
    this.liveInterval = setInterval(() => {
      if (Auth.current() && !Utils.qs("#appShell").classList.contains("hidden")) this.renderPage();
    }, 8000);
  },

  bindLogin() {
    Utils.qs("#loginForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const matricula = Utils.qs("#inputMatricula");
      const senha = Utils.qs("#inputSenha");
      const fieldMatricula = Utils.qs("#fieldMatricula");
      const fieldSenha = Utils.qs("#fieldSenha");
      fieldMatricula.classList.remove("error");
      fieldSenha.classList.remove("error");

      const result = Auth.login(matricula.value, senha.value);
      if (!result.ok) {
        if (result.reason === "matricula" && !DB.pronto) {
          Utils.error("Ainda carregando", "O sistema ainda está conectando ao servidor. Aguarde alguns segundos e tente novamente.");
          return;
        }
        if (result.reason === "matricula") fieldMatricula.classList.add("error");
        else fieldSenha.classList.add("error");
        return;
      }
      Utils.toast(`Bem-vindo(a), ${result.user.nome.split(" ")[0]}!`);
      this.enterApp();
    });
  },

  bindShell() {
    Utils.qs("#btnLogout").addEventListener("click", async () => {
      const ok = await Utils.confirm("Sair do sistema?", "Você precisará informar a matrícula novamente para entrar.");
      if (!ok) return;
      Auth.logout();
      location.reload();
    });
    Utils.qs("#menuToggle").addEventListener("click", () => Utils.qs("#sidebar").classList.toggle("open"));
    Utils.qs("#btnChangePassword").addEventListener("click", () => this.openChangePassword());
  },

  async openChangePassword() {
    const { value: form } = await Swal.fire({
      title: "Alterar senha",
      html:
        '<input id="swalSenhaAtual" type="password" class="swal2-input" placeholder="Senha atual">' +
        '<input id="swalSenhaNova" type="password" class="swal2-input" placeholder="Nova senha">' +
        '<input id="swalSenhaConfirma" type="password" class="swal2-input" placeholder="Confirmar nova senha">',
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: "Salvar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0A4DA6",
      preConfirm: () => {
        const atual = Utils.qs("#swalSenhaAtual").value;
        const nova = Utils.qs("#swalSenhaNova").value;
        const confirma = Utils.qs("#swalSenhaConfirma").value;
        if (!atual || !nova || !confirma) {
          Swal.showValidationMessage("Preencha todos os campos.");
          return false;
        }
        if (nova.length < 4) {
          Swal.showValidationMessage("A nova senha deve ter ao menos 4 caracteres.");
          return false;
        }
        if (nova !== confirma) {
          Swal.showValidationMessage("A confirmação não confere com a nova senha.");
          return false;
        }
        return { atual, nova };
      }
    });

    if (!form) return;
    const result = Auth.changePassword(form.atual, form.nova);
    if (!result.ok) {
      Utils.error("Não foi possível alterar a senha", "A senha atual informada está incorreta.");
      return;
    }
    Utils.toast("Senha alterada com sucesso.");
  },

  enterApp() {
    const user = Auth.current();
    Utils.qs("#loginScreen").classList.add("hidden");
    Utils.qs("#appShell").classList.remove("hidden");
    Utils.qs("#userName").textContent = user.nome;
    const rotulo = { admin: "Administrador", lider: "Líder", fiscal: "Fiscal de Campo", analista: "Analista" };
    Utils.qs("#userRole").textContent = rotulo[user.perfil] || user.perfil;
    Utils.qs("#userAvatar").textContent = user.nome.split(" ").map(n => n[0]).slice(0, 2).join("");

    const landing = { admin: "dashboard", lider: "lider", fiscal: "painel", analista: "ordens" };
    Router.current = landing[user.perfil] || "cadastro";
    this.renderMenu();
    this.renderPage();
    this.startLivePolling();
  },

  renderMenu() {
    const user = Auth.current();
    const nav = Utils.qs("#navMenu");
    nav.innerHTML = "";
    const rotuloSecao = { admin: "Gestão", lider: "Liderança", fiscal: "Campo", analista: "Análise" };
    nav.appendChild(Utils.el("div", { class: "nav-label" }, rotuloSecao[user.perfil] || "Menu"));
    Object.entries(Router.routes).forEach(([key, r]) => {
      if (!r.roles.includes(user.perfil)) return;
      const item = Utils.el("a", {
        href: "#", class: "nav-item" + (Router.current === key ? " active" : ""),
        onclick: (e) => { e.preventDefault(); Router.go(key); }
      }, [Utils.el("i", { class: `fa-solid ${r.icon}` }), r.label]);
      nav.appendChild(item);
    });
  },

  renderPage() {
    const route = Router.routes[Router.current];
    Utils.qs("#pageTitle").textContent = route.title;
    const content = Utils.qs("#pageContent");
    route.render(content);
  },

  renderExportPage(container) {
    container.innerHTML = "";
    container.classList.add("fade-in");
    const grid = Utils.el("div", { class: "panel-grid" });

    const cards = [
      { title: "Excel geral", desc: "Todas as inspeções registradas, com todos os campos.", icon: "fa-file-excel", action: () => Exporter.exportAllExcel(), color: "c-green" },
      { title: "Relatório por fiscal", desc: "Quantidade de inspeções realizadas por cada fiscal.", icon: "fa-user-check", action: () => Exporter.exportByFiscalExcel(), color: "c-blue" },
      { title: "Relatório por município", desc: "Cobertura e inspeções agrupadas por município.", icon: "fa-map-location-dot", action: () => Exporter.exportByMunicipioExcel(), color: "c-teal" },
      { title: "Itens danificados (EPI/EPC)", desc: "Lista de todos os itens marcados como danificados nas inspeções.", icon: "fa-triangle-exclamation", action: () => Exporter.exportItensDanificadosExcel(), color: "c-amber" }
    ];

    cards.forEach(c => {
      const panel = Utils.el("div", { class: "panel span-4" }, [
        Utils.el("div", { class: `kpi-card ${c.color}`, style: "border:none;box-shadow:none;padding:0;" }, [
          Utils.el("div", { class: "icon" }, [Utils.el("i", { class: `fa-solid ${c.icon}` })]),
          Utils.el("h3", { style: "margin:8px 0 4px;font-size:1rem;" }, c.title),
          Utils.el("p", { class: "text-muted", style: "font-size:.84rem;margin-bottom:14px;" }, c.desc),
          Utils.el("button", { class: "btn btn-primary btn-sm", onclick: c.action }, [Utils.el("i", { class: "fa-solid fa-download" }), " Exportar"])
        ])
      ]);
      grid.appendChild(panel);
    });

    container.appendChild(Utils.el("p", { class: "text-muted mb-16" }, "Para exportar o PDF de uma inspeção específica, acesse Histórico → abra a inspeção → Exportar PDF."));
    container.appendChild(grid);
  },

  startClock() {
    const el = Utils.qs("#clockNow");
    const tick = () => { el.textContent = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" }); };
    tick();
    setInterval(tick, 1000);
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
