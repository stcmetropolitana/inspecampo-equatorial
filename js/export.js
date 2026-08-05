/**
 * ==========================================================================
 * EXPORTAÇÕES — PDF (jsPDF) e Excel (SheetJS)
 * ==========================================================================
 */

const Exporter = {
  exportInspecaoPDF(insp) {
    const cadastro = DB.getCadastros().find(c => c.id === insp.cadastroId) || null;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(10, 77, 166);
    doc.text("Relatório de Inspeção de Equipe", 14, y);
    y += 6;
    doc.setDrawColor(10, 77, 166);
    doc.line(14, y, 196, y);
    y += 10;

    doc.setFontSize(11);
    doc.setTextColor(20, 30, 45);
    doc.setFont("helvetica", "normal");

    const rows = [
      ["Equipe (prefixo)", insp.equipePrefixo],
      ["Data da inspeção", insp.dataInspecao ? Utils.formatDate(insp.dataInspecao) : "—"],
      ["Registrado em", Utils.formatDateTime(insp.dataHoraISO)],
      ["Fiscal (inspeção)", insp.fiscalNome],
      ["Município", insp.municipio], ["Processo de atuação", insp.processo],
      ["Veículo", `${insp.veiculoTipo || "—"} — Placa ${insp.veiculoPlaca || "—"}`],
      ["Documento do veículo", cadastro?.veiculo?.documentoNumero ? `${cadastro.veiculo.documentoNumero}${cadastro.veiculo?.documentoValidade ? " — validade em " + Utils.formatDate(cadastro.veiculo.documentoValidade) : ""}` : "—"],
      ["Comunicação", `${insp.comunicacaoTipo || "—"} — S/N ${insp.comunicacaoSerie || "—"}${cadastro?.comunicacao?.dispositivo ? " — Dispositivo: " + cadastro.comunicacao.dispositivo : ""}`],
      ["Colaboradores", (insp.colaboradores || []).map(c => `${c.nome} (${c.matricula}) - ${c.funcao}`).join("; ")]
    ];
    if (cadastro) {
      rows.splice(4, 0, ["Horário de trabalho", (cadastro.horarioInicial && cadastro.horarioFinal) ? `${cadastro.horarioInicial} às ${cadastro.horarioFinal}` : "—"]);
      rows.splice(5, 0, ["GPS do cadastro", cadastro.gps ? `${cadastro.gps.lat.toFixed(5)}, ${cadastro.gps.lng.toFixed(5)}` : "—"]);
      rows.push(["Fiscal (cadastro)", cadastro.fiscalNome]);
    }

    (insp.epiPorColaborador || []).forEach(c => {
      const total = c.itens.length;
      const danificados = c.itens.filter(i => i.estado === "danificado").length;
      rows.push([`EPIs — ${c.colaborador || "Colaborador"}`, `${total - danificados}/${total} de acordo${danificados ? ` — ${danificados} danificado(s)` : ""}`]);
    });
    if (insp.epc) {
      const totalEpc = insp.epc.itens.length;
      const danificadosEpc = insp.epc.itens.filter(i => i.estado === "danificado").length;
      rows.push(["EPCs do veículo", `${totalEpc - danificadosEpc}/${totalEpc} de acordo${danificadosEpc ? ` — ${danificadosEpc} danificado(s)` : ""}`]);
    }

    const labelWidth = 42; // mm reservados pro rótulo — evita ele "vazar" em cima do valor
    const valueX = 60;
    const valueWidth = 132;
    rows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      const keyLines = doc.splitTextToSize(`${k}:`, labelWidth);
      doc.text(keyLines, 14, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(String(v || "—"), valueWidth);
      doc.text(valueLines, valueX, y);
      const linhas = Math.max(keyLines.length, valueLines.length);
      y += 6.5 * linhas + 2.5;
      if (y > 275) { doc.addPage(); y = 18; }
    });

    y += 4;
    const photos = cadastro ? [
      ...Object.entries(cadastro.veiculo?.fotos || {}).map(([k, v]) => v && { label: `Veículo - ${k}`, src: v }),
      cadastro.comunicacao?.foto && { label: "Equipamento", src: cadastro.comunicacao.foto },
      cadastro.comunicacao?.fotoDispositivo && { label: cadastro.comunicacao.dispositivo || "Dispositivo", src: cadastro.comunicacao.fotoDispositivo },
      cadastro.fotoEquipe && { label: "Equipe", src: cadastro.fotoEquipe },
      ...(cadastro.colaboradores || []).map(c => c.foto && { label: c.nome || "Colaborador", src: c.foto })
    ].filter(Boolean) : [];

    let x = 14;
    photos.forEach((p, idx) => {
      if (y > 250) { doc.addPage(); y = 18; x = 14; }
      try {
        doc.addImage(p.src, "JPEG", x, y, 42, 32);
        doc.setFontSize(8);
        doc.text(p.label, x, y + 36);
      } catch (e) { /* ignora imagem inválida */ }
      x += 46;
      if ((idx + 1) % 4 === 0) { x = 14; y += 44; }
    });
    if (photos.length % 4 !== 0) y += 44;

    // ---------- Fotos dos itens de EPI/EPC danificados ----------
    const fotosDanificados = [
      ...(insp.epiPorColaborador || []).flatMap(c => c.itens
        .filter(it => it.estado === "danificado" && it.foto)
        .map(it => ({ label: `EPI — ${c.colaborador || ""} — ${it.nome}`, src: it.foto }))),
      ...(insp.epc ? insp.epc.itens.filter(it => it.estado === "danificado" && it.foto).map(it => ({ label: `EPC — ${it.nome}`, src: it.foto })) : [])
    ];
    if (fotosDanificados.length) {
      if (y > 240) { doc.addPage(); y = 18; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(215, 38, 61);
      doc.text("Itens de EPI/EPC Danificados", 14, y);
      y += 8;
      x = 14;
      doc.setTextColor(20, 30, 45);
      fotosDanificados.forEach((p, idx) => {
        if (y > 250) { doc.addPage(); y = 18; x = 14; }
        try {
          doc.addImage(p.src, "JPEG", x, y, 42, 32);
          doc.setFontSize(7.5);
          const lines = doc.splitTextToSize(p.label, 42);
          doc.text(lines, x, y + 36);
        } catch (e) { /* ignora imagem inválida */ }
        x += 46;
        if ((idx + 1) % 4 === 0) { x = 14; y += 44; }
      });
    }

    doc.save(`inspecao_${insp.equipePrefixo}_${insp.id}.pdf`);
    Utils.toast("PDF gerado com sucesso.");
  },

  exportAllExcel() {
    const inspecoes = DB.getInspecoes();
    if (!inspecoes.length) { Utils.toast("Nenhuma inspeção para exportar.", "warning"); return; }
    const cadastrosById = Object.fromEntries(DB.getCadastros().map(c => [c.id, c]));

    const rows = inspecoes.map(i => {
      const cad = cadastrosById[i.cadastroId];
      const epiDanificados = (i.epiPorColaborador || []).reduce((acc, c) => acc + c.itens.filter(it => it.estado === "danificado").length, 0);
      const epcDanificados = i.epc ? i.epc.itens.filter(it => it.estado === "danificado").length : 0;
      return {
        "Data da Inspeção": i.dataInspecao ? Utils.formatDate(i.dataInspecao) : "—",
        "Registrado em": Utils.formatDateTime(i.dataHoraISO),
        "Fiscal (inspeção)": i.fiscalNome,
        "Equipe": i.equipePrefixo,
        "Município": i.municipio,
        "Processo": i.processo,
        "Horário Inicial": cad?.horarioInicial || "—",
        "Horário Final": cad?.horarioFinal || "—",
        "Veículo": i.veiculoTipo,
        "Placa": i.veiculoPlaca,
        "Documento do Veículo": cad?.veiculo?.documentoNumero || "—",
        "Validade do Documento": cad?.veiculo?.documentoValidade ? Utils.formatDate(cad.veiculo.documentoValidade) : "—",
        "Comunicação": i.comunicacaoTipo,
        "Nº Série Comunicação": i.comunicacaoSerie,
        "Colaboradores": (i.colaboradores || []).map(c => c.nome).join(", "),
        "EPIs Danificados": epiDanificados,
        "EPCs Danificados": epcDanificados,
        "Fiscal (cadastro)": cad?.fiscalNome || "—",
        "GPS Lat": cad?.gps?.lat, "GPS Lng": cad?.gps?.lng
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inspeções");
    XLSX.writeFile(wb, `inspecoes_geral_${new Date().toISOString().slice(0, 10)}.xlsx`);
    Utils.toast("Excel exportado com sucesso.");
  },

  exportByFiscalExcel() {
    const inspecoes = DB.getInspecoes();
    const cadastros = DB.getCadastros();
    const fiscais = DB.getFiscais().filter(f => f.perfil === "fiscal");
    const rows = fiscais.map(f => ({
      "Fiscal": f.nome,
      "Matrícula": f.matricula,
      "Equipes cadastradas": cadastros.filter(c => c.fiscalId === f.id).length,
      "Inspeções realizadas": inspecoes.filter(i => i.fiscalId === f.id).length
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Por Fiscal");
    XLSX.writeFile(wb, `relatorio_por_fiscal_${new Date().toISOString().slice(0, 10)}.xlsx`);
    Utils.toast("Relatório por fiscal exportado.");
  },

  exportByMunicipioExcel() {
    const inspecoes = DB.getInspecoes();
    const cadastros = DB.getCadastros();
    const municipios = [...new Set(cadastros.map(c => c.municipio))];
    const cadastroIdsVistoriados = new Set(inspecoes.map(i => i.cadastroId));
    const rows = municipios.map(m => ({
      "Município": m,
      "Equipes cadastradas": cadastros.filter(c => c.municipio === m).length,
      "Equipes vistoriadas": cadastros.filter(c => c.municipio === m && cadastroIdsVistoriados.has(c.id)).length,
      "Inspeções realizadas": inspecoes.filter(i => i.municipio === m).length
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Por Município");
    XLSX.writeFile(wb, `relatorio_por_municipio_${new Date().toISOString().slice(0, 10)}.xlsx`);
    Utils.toast("Relatório por município exportado.");
  },

  exportItensDanificadosExcel() {
    const inspecoes = DB.getInspecoes();
    const rows = [];

    const linhaResolucao = (it) => it.resolucao?.resolvido
      ? { "Status": "Resolvida", "Resolvida em": Utils.formatDateTime(it.resolucao.dataResolucao), "Resolvida por": it.resolucao.resolvidoPor }
      : { "Status": "Pendente", "Resolvida em": "—", "Resolvida por": "—" };

    inspecoes.forEach(i => {
      (i.epiPorColaborador || []).forEach(c => {
        c.itens.filter(it => it.estado === "danificado").forEach(it => {
          rows.push({
            "Data": i.dataInspecao ? Utils.formatDate(i.dataInspecao) : "—", "Equipe": i.equipePrefixo, "Município": i.municipio,
            "Categoria": "EPI", "Colaborador": c.colaborador, "Item": it.nome,
            "Quantidade": it.quantidade, "Validade do laudo": it.validade || "—",
            ...linhaResolucao(it)
          });
        });
      });
      if (i.epc) {
        i.epc.itens.filter(it => it.estado === "danificado").forEach(it => {
          rows.push({
            "Data": i.dataInspecao ? Utils.formatDate(i.dataInspecao) : "—", "Equipe": i.equipePrefixo, "Município": i.municipio,
            "Categoria": "EPC", "Colaborador": "—", "Item": it.nome,
            "Quantidade": it.quantidade, "Validade do laudo": it.validade || "—",
            ...linhaResolucao(it)
          });
        });
      }
    });

    if (!rows.length) { Utils.toast("Nenhum item danificado registrado até o momento.", "info"); return; }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Itens Danificados");
    XLSX.writeFile(wb, `itens_danificados_${new Date().toISOString().slice(0, 10)}.xlsx`);
    Utils.toast("Relatório de itens danificados exportado.");
  },

  /** Linhas do checklist (EPI + EPC) de UMA inspeção, item por item — usado nas duas exportações abaixo. */
  _linhasChecklist(insp) {
    const linhaResolucao = (it) => it.estado !== "danificado"
      ? { "Status da Correção": "—", "Corrigido em": "—", "Corrigido por": "—" }
      : it.resolucao?.resolvido
        ? { "Status da Correção": "Corrigida", "Corrigido em": Utils.formatDateTime(it.resolucao.dataResolucao), "Corrigido por": it.resolucao.resolvidoPor }
        : { "Status da Correção": "Pendente", "Corrigido em": "—", "Corrigido por": "—" };

    const base = {
      "Data": insp.dataInspecao ? Utils.formatDate(insp.dataInspecao) : "—",
      "Equipe": insp.equipePrefixo, "Fiscal": insp.fiscalNome, "Município": insp.municipio
    };
    const linhas = [];
    (insp.epiPorColaborador || []).forEach(c => {
      c.itens.forEach(it => linhas.push({
        ...base, "Categoria": "EPI", "Colaborador": c.colaborador || "—", "Item": it.nome,
        "Situação": it.estado === "danificado" ? "Danificado" : it.estado === "de_acordo" ? "De acordo" : "—",
        "Quantidade": it.quantidade, "Validade do Laudo": it.validade || "—", ...linhaResolucao(it)
      }));
    });
    if (insp.epc) {
      insp.epc.itens.forEach(it => linhas.push({
        ...base, "Categoria": "EPC", "Colaborador": "—", "Item": it.nome,
        "Situação": it.estado === "danificado" ? "Danificado" : it.estado === "de_acordo" ? "De acordo" : "—",
        "Quantidade": it.quantidade, "Validade do Laudo": it.validade || "—", ...linhaResolucao(it)
      }));
    }
    return linhas;
  },

  /** Checklist item a item (o que está de acordo e o que está danificado) de UMA inspeção/equipe. */
  exportChecklistExcel(insp) {
    const linhas = this._linhasChecklist(insp);
    if (!linhas.length) { Utils.toast("Essa inspeção não tem itens de checklist.", "warning"); return; }
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklist");
    XLSX.writeFile(wb, `checklist_${insp.equipePrefixo}_${insp.dataInspecao || ""}.xlsx`);
    Utils.toast("Checklist exportado com sucesso.");
  },

  /** Checklist item a item de VÁRIAS inspeções (equipes), tudo na mesma planilha. */
  exportChecklistsExcel(lista) {
    const inspecoes = lista && lista.length ? lista : DB.getInspecoes();
    if (!inspecoes.length) { Utils.toast("Nenhuma inspeção para exportar.", "warning"); return; }
    const linhas = inspecoes.flatMap(insp => this._linhasChecklist(insp));
    if (!linhas.length) { Utils.toast("Nenhum item de checklist encontrado.", "warning"); return; }
    const ws = XLSX.utils.json_to_sheet(linhas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Checklists");
    XLSX.writeFile(wb, `checklists_todas_equipes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    Utils.toast(`Checklist de ${inspecoes.length} inspeção(ões) exportado com sucesso.`);
  },

  /** Relatório em PDF de uma Ordem de Inspeção: dados, linha do tempo dos passos seguidos e fotos. */
  exportOrdemPDF(ordem) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 18;

    const garantirEspaco = (altura) => { if (y + altura > 280) { doc.addPage(); y = 18; } };

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(10, 77, 166);
    doc.text("Relatório de Ordem de Inspeção", 14, y);
    y += 6;
    doc.setDrawColor(10, 77, 166);
    doc.line(14, y, 196, y);
    y += 10;

    const perfilLabel = { analista: "Analista", lider: "Líder", admin: "Administrador" };
    const rows = [
      ["Equipamento/UC", ordem.tipoAtivo],
      ["Identificação", ordem.identificacao || "—"],
      ["Município", ordem.municipio],
      ["Endereço/Referência", ordem.endereco || "—"],
      ["Prioridade", ordem.prioridade],
      ["Prazo", ordem.prazo ? Utils.formatDate(ordem.prazo) : "—"],
      ["Fiscal", ordem.fiscalNome],
      ["Enviada por", `${ordem.criadoPorNome || "—"}${ordem.criadoPorPerfil ? ` (${perfilLabel[ordem.criadoPorPerfil] || ordem.criadoPorPerfil})` : ""}`],
      ["Status atual", OrdensPage.STATUS_INFO[ordem.status]?.label || ordem.status]
    ];
    if (ordem.motivo) rows.push(["Instruções originais", ordem.motivo]);
    if (ordem.observacoesFiscal) rows.push(["Observações do fiscal", ordem.observacoesFiscal]);

    doc.setFontSize(11);
    doc.setTextColor(20, 30, 45);
    const labelWidth = 42, valueX = 60, valueWidth = 132;
    rows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      const keyLines = doc.splitTextToSize(`${k}:`, labelWidth);
      doc.text(keyLines, 14, y);
      doc.setFont("helvetica", "normal");
      const valueLines = doc.splitTextToSize(String(v || "—"), valueWidth);
      doc.text(valueLines, valueX, y);
      const linhas = Math.max(keyLines.length, valueLines.length);
      y += 6.5 * linhas + 2.5;
      garantirEspaco(20);
    });

    // ---------- Linha do tempo (passos seguidos) ----------
    y += 5;
    garantirEspaco(20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(10, 77, 166);
    doc.text("Linha do Tempo", 14, y);
    y += 9;

    const passos = [];
    passos.push(`Ordem enviada por ${ordem.criadoPorNome || "—"} em ${Utils.formatDateTime(ordem.dataEnvioISO)}.`);
    if (ordem.dataExecucaoISO) {
      passos.push(`Fiscal ${ordem.fiscalNome} realizou a inspeção em campo em ${Utils.formatDateTime(ordem.dataExecucaoISO)}${(ordem.fotos || []).length ? ` (${ordem.fotos.length} foto(s) anexada(s))` : ""}.`);
    }
    if (ordem.revisao) {
      const acaoRev = ordem.revisao.status === "aprovada" ? "aprovou" : "recusou";
      passos.push(`${ordem.revisao.revisorNome || "—"} ${acaoRev} a inspeção em ${Utils.formatDateTime(ordem.revisao.dataISO)}${ordem.revisao.comentario ? ` — "${ordem.revisao.comentario}"` : ""}.`);
    }
    (ordem.acoesSelecionadas || []).forEach(a => {
      const nome = OrdensPage.nomeAcao(a);
      if (nome === "Sem irregularidades encontradas") return;
      const reparo = (typeof a === "object" && a.reparo) ? a.reparo : {};
      if (reparo.equipeEnviada) passos.push(`[${nome}] Equipe ${reparo.equipeEnviada.equipe} enviada para o reparo em ${Utils.formatDate(reparo.equipeEnviada.data)}${reparo.equipeEnviada.observacao ? ` — ${reparo.equipeEnviada.observacao}` : ""}.`);
      if (reparo.equipeConcluiu) passos.push(`[${nome}] Equipe concluiu o reparo em ${Utils.formatDate(reparo.equipeConcluiu.data)}${reparo.equipeConcluiu.observacao ? ` — ${reparo.equipeConcluiu.observacao}` : ""}.`);
      if (OrdensPage.resolvidoAcao(a) && a.resolucao) {
        passos.push(`[${nome}] Correção confirmada pelo fiscal em ${a.resolucao.dataCorrecao ? Utils.formatDate(a.resolucao.dataCorrecao) : "—"}${a.resolucao.descricao ? ` — ${a.resolucao.descricao}` : ""}.`);
      } else if (!reparo.equipeEnviada) {
        passos.push(`[${nome}] Ainda aguardando o envio de uma equipe para o reparo.`);
      }
    });

    doc.setFontSize(10);
    doc.setTextColor(20, 30, 45);
    passos.forEach((texto, idx) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${idx + 1}.`, 14, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(texto, 172);
      doc.text(lines, 22, y);
      y += 6 * lines.length + 2;
      garantirEspaco(20);
    });

    // ---------- Fotos ----------
    const fotos = [
      ...(ordem.fotos || []).map((src, i) => ({ label: `Registro fotográfico ${i + 1}`, src })),
      ...(ordem.acoesSelecionadas || [])
        .filter(a => OrdensPage.resolvidoAcao(a) && a.resolucao?.fotoResolucao)
        .map(a => ({ label: `Correção — ${OrdensPage.nomeAcao(a)}`, src: a.resolucao.fotoResolucao }))
    ];

    if (fotos.length) {
      y += 5;
      garantirEspaco(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(10, 77, 166);
      doc.text("Fotos", 14, y);
      y += 9;
      doc.setTextColor(20, 30, 45);

      let x = 14;
      fotos.forEach((p, idx) => {
        if (y > 250) { doc.addPage(); y = 18; x = 14; }
        try {
          doc.addImage(p.src, "JPEG", x, y, 42, 32);
          doc.setFontSize(7.5);
          const lines = doc.splitTextToSize(p.label, 42);
          doc.text(lines, x, y + 36);
        } catch (e) { /* ignora imagem inválida */ }
        x += 46;
        if ((idx + 1) % 4 === 0) { x = 14; y += 44; }
      });
    }

    doc.save(`ordem_inspecao_${ordem.tipoAtivo.replace(/\s+/g, "_")}_${ordem.id}.pdf`);
    Utils.toast("PDF da ordem gerado com sucesso.");
  }
};
