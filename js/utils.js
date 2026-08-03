/**
 * ==========================================================================
 * UTILITÁRIOS COMPARTILHADOS
 * ==========================================================================
 */

const Utils = {
  uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  },

  nowISO() {
    return new Date().toISOString();
  },

  formatDateTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
  },

  formatDate(iso) {
    return new Date(iso).toLocaleDateString("pt-BR");
  },

  isToday(iso) {
    const d = new Date(iso);
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  },

  /** Captura GPS via Geolocation API. Resolve {lat,lng} ou rejeita. */
  captureGPS() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocalização não suportada neste dispositivo."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, precisao: pos.coords.accuracy }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  },

  /**
   * Lê um arquivo de imagem, redimensiona e comprime para base64.
   * Padrão ajustado para caber mais fotos no plano gratuito do Supabase —
   * ainda perfeitamente legível na tela, só não fica em "qualidade de zoom".
   * Se um dia precisar de mais nitidez (ex: leitura de placa/etiqueta),
   * aumente maxDim/quality só na chamada específica.
   */
  fileToCompressedBase64(file, maxDim = 900, quality = 0.55) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Falha ao ler arquivo."));
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => reject(new Error("Arquivo inválido."));
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  },

  toast(msg, icon = "success") {
    Swal.fire({
      toast: true,
      position: "top-end",
      icon,
      title: msg,
      showConfirmButton: false,
      timer: 3200,
      timerProgressBar: true
    });
  },

  confirm(title, text) {
    return Swal.fire({
      title, text, icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#0A4DA6",
      cancelButtonColor: "#8896a6"
    }).then(r => r.isConfirmed);
  },

  error(title, text) {
    Swal.fire({ title, text, icon: "error", confirmButtonColor: "#0A4DA6" });
  },

  qs(sel, ctx = document) { return ctx.querySelector(sel); },
  qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; },

  /** Conta itens danificados de uma inspeção e quantos ainda estão pendentes de resolução */
  contarPendencias(insp) {
    const todos = [
      ...(insp.epiPorColaborador || []).flatMap(c => c.itens),
      ...(insp.epc ? insp.epc.itens : [])
    ];
    const danificados = todos.filter(i => i.estado === "danificado");
    const pendentes = danificados.filter(i => !i.resolucao?.resolvido);
    return { total: danificados.length, pendentes: pendentes.length };
  },

  el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v;
      else if (k === "html") node.innerHTML = v;
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach(c => {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }
};
