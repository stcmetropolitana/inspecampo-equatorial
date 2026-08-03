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

    rows.forEach(([k, v]) => {
      doc.setFont("helvetica", "bold");
      doc.text(`${k}:`, 14, y);
      doc.setFont("helvetica", "normal");
      const lines = doc.splitTextToSize(String(v || "—"), 130);
      doc.text(lines, 60, y);
      y += 7 * lines.length;
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
  }
};
