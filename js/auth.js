/**
 * ==========================================================================
 * AUTENTICAÇÃO
 * ==========================================================================
 * Modo demo: login por matrícula (sem senha real — em produção, trocar
 * por Firebase Authentication). A sessão fica em sessionStorage.
 * ==========================================================================
 */

const Auth = {
  SESSION_KEY: "sessao_ativa",

  current() {
    try { return JSON.parse(sessionStorage.getItem(this.SESSION_KEY)); }
    catch { return null; }
  },

  login(matricula, senha) {
    const fiscal = DB.getFiscais().find(f => f.matricula.toLowerCase() === matricula.trim().toLowerCase());
    if (!fiscal) return { ok: false, reason: "matricula" };
    if (String(fiscal.senha) !== String(senha)) return { ok: false, reason: "senha" };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(fiscal));
    return { ok: true, user: fiscal };
  },

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  changePassword(senhaAtual, novaSenha) {
    const user = this.current();
    if (!user) return { ok: false, reason: "sem-sessao" };
    const fiscal = DB.getFiscais().find(f => f.id === user.id);
    if (!fiscal || String(fiscal.senha) !== String(senhaAtual)) return { ok: false, reason: "senha-atual" };
    DB.updateSenha(user.id, novaSenha);
    const updated = { ...user, senha: novaSenha };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(updated));
    return { ok: true };
  },

  isAdmin() {
    const u = this.current();
    return !!u && u.perfil === "admin";
  },

  isLider() {
    const u = this.current();
    return !!u && u.perfil === "lider";
  },

  isAnalista() {
    const u = this.current();
    return !!u && u.perfil === "analista";
  },

  /** Fiscais vinculados ao líder logado (ou ao líder do analista logado, ou todos, se admin) */
  meusFiscais() {
    const u = this.current();
    if (!u) return [];
    if (u.perfil === "admin") return DB.getFiscais().filter(f => f.perfil === "fiscal");
    if (u.perfil === "lider") return DB.getFiscais().filter(f => f.perfil === "fiscal" && f.liderId === u.id);
    if (u.perfil === "analista") return DB.getFiscais().filter(f => f.perfil === "fiscal" && f.liderId === u.liderId);
    return [];
  }
};
