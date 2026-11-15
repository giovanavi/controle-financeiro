import { centavosParaReais } from './dinheiro'
import { formatarData, hojeISO, mesDeISO, mesParaISO, rotuloMes } from './meses'

// ---------- utilidades ----------
const reais = (centavos) => centavosParaReais(centavos).replace(/\u00A0/g, ' ')
const nomeSeguro = (texto) => texto.replace(/[\\/:*?"<>|]/g, '-').trim()
const letra = (n) => String.fromCharCode(64 + n)
const FORMATO_MOEDA = '"R$" #,##0.00'
const preenchimento = (hex) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex}` } })
const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

function baixar(blob, nome) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// cores dos estados (Excel em hex ARGB, PDF em RGB)
const EXCEL_STATUS = { Pago: ['EAF3DE', '27500A'], Pendente: ['FAEEDA', '633806'] }
const PDF_STATUS = { Pago: [[234, 243, 222], [39, 80, 10]], Pendente: [[250, 238, 218], [99, 56, 6]] }
const chaveStatus = (texto) => (texto === 'Pago' ? 'Pago' : texto === 'Pendente' || texto.startsWith('Parcial') ? 'Pendente' : null)

// =====================================================================
// EXPORTAÇÃO DA PESSOA (modelo 1: lista simples)
// Colunas: Tipo | [Mês] | Parcela | Descrição | Valor | Status
// =====================================================================
export function dadosExportacaoPessoa({ pessoa, itens, escopo, mes }) {
  const comMes = escopo === 'pendencias'

  const linhas = itens.map((x) => {
    const lanc = x.lancamentos
    const despesa = lanc.despesas
    return {
      tipo: despesa?.tipo === 'cartao' ? despesa.cartoes?.nome ?? 'Cartão' : despesa?.tipo === 'fixo' ? 'Fixo' : 'Extra',
      mes: lanc.mes_referencia,
      mesTexto: rotuloMes(mesDeISO(lanc.mes_referencia)),
      parcela: lanc.total_parcelas > 1 ? `${lanc.numero_parcela}/${lanc.total_parcelas}` : '—',
      descricao: despesa?.descricao ?? '',
      valor: x.valor_centavos,
      status: pessoa.eh_eu ? '—' : x.pago ? 'Pago' : 'Pendente',
    }
  })

  // cartões (em ordem alfabética), depois Fixo e Extra
  const peso = (tipo) => (tipo === 'Fixo' ? 2 : tipo === 'Extra' ? 3 : 1)
  linhas.sort(
    (a, b) =>
      peso(a.tipo) - peso(b.tipo) ||
      a.tipo.localeCompare(b.tipo) ||
      a.mes.localeCompare(b.mes) ||
      a.descricao.localeCompare(b.descricao)
  )

  const colunas = [
    { chave: 'tipo', titulo: 'Tipo', largura: 22 },
    ...(comMes ? [{ chave: 'mesTexto', titulo: 'Mês', largura: 18 }] : []),
    { chave: 'parcela', titulo: 'Parcela', largura: 10 },
    { chave: 'descricao', titulo: 'Descrição', largura: 34 },
    { chave: 'valor', titulo: 'Valor', largura: 16, moeda: true },
    { chave: 'status', titulo: 'Status', largura: 12 },
  ]

  const total = soma(linhas, (l) => l.valor)
  const pago = soma(linhas.filter((l) => l.status === 'Pago'), (l) => l.valor)
  const periodo = comMes ? 'Pendências (todos os meses)' : rotuloMes(mes)

  return {
    titulo: `${pessoa.nome} · ${periodo}`,
    arquivo: nomeSeguro(`${pessoa.nome} - ${comMes ? 'pendencias' : mesParaISO(mes).slice(0, 7)}`),
    colunas,
    linhas,
    total,
    pago,
    ehEu: !!pessoa.eh_eu,
  }
}

export async function exportarPessoaExcel(d) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Controle financeiro'
  const ws = wb.addWorksheet('Itens', { views: [{ state: 'frozen', ySplit: 4 }] })
  const n = d.colunas.length

  ws.mergeCells(1, 1, 1, n)
  ws.getCell(1, 1).value = d.titulo
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.mergeCells(2, 1, 2, n)
  ws.getCell(2, 1).value = `Gerado em ${formatarData(hojeISO())}`
  ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF6B6B66' } }

  const cabecalho = ws.getRow(4)
  d.colunas.forEach((c, i) => {
    const celula = cabecalho.getCell(i + 1)
    celula.value = c.titulo
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    celula.fill = preenchimento('0F6E56')
    celula.alignment = { vertical: 'middle', horizontal: c.moeda ? 'right' : 'left' }
    ws.getColumn(i + 1).width = c.largura
  })

  d.linhas.forEach((linha, k) => {
    const row = ws.getRow(5 + k)
    d.colunas.forEach((c, i) => {
      const celula = row.getCell(i + 1)
      if (c.moeda) {
        celula.value = linha[c.chave] / 100
        celula.numFmt = FORMATO_MOEDA
      } else {
        celula.value = linha[c.chave]
      }
    })
  })

  const primeira = 5
  const ultima = 4 + d.linhas.length
  const colValor = d.colunas.findIndex((c) => c.moeda) + 1
  const colStatus = d.colunas.findIndex((c) => c.chave === 'status') + 1
  const L = letra(colValor)
  const S = letra(colStatus)

  const escreverTotal = (linha, texto, valor, negrito) => {
    const row = ws.getRow(linha)
    row.getCell(1).value = texto
    const celula = row.getCell(colValor)
    celula.value = valor
    celula.numFmt = FORMATO_MOEDA
    for (let i = 1; i <= n; i++) {
      row.getCell(i).fill = preenchimento('F1EFE8')
      row.getCell(i).font = { bold: negrito }
    }
  }
  const linhaTotal = ultima + 1
  escreverTotal(linhaTotal, 'Total', { formula: `SUBTOTAL(109,${L}${primeira}:${L}${ultima})`, result: d.total / 100 }, true)
  if (!d.ehEu) {
    escreverTotal(
      linhaTotal + 1,
      'Já pago',
      { formula: `SUMIF(${S}${primeira}:${S}${ultima},"Pago",${L}${primeira}:${L}${ultima})`, result: d.pago / 100 },
      false
    )
    escreverTotal(
      linhaTotal + 2,
      'Pendente',
      { formula: `${L}${linhaTotal}-${L}${linhaTotal + 1}`, result: (d.total - d.pago) / 100 },
      false
    )
  }

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: ultima, column: n } }

  const buffer = await wb.xlsx.writeBuffer()
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${d.arquivo}.xlsx`
  )
}

async function novoPdf(orientacao) {
  const { jsPDF } = await import('jspdf')
  const autoTable = (await import('jspdf-autotable')).default
  const doc = new jsPDF({ orientation: orientacao, unit: 'mm', format: 'a4' })
  return { doc, autoTable }
}

function cabecalhoPdf(doc, titulo, subtitulo) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(30)
  doc.text(titulo, 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(110)
  doc.text(subtitulo, 14, 24)
}

export async function exportarPessoaPDF(d) {
  const { doc, autoTable } = await novoPdf('portrait')
  cabecalhoPdf(doc, d.titulo, `Gerado em ${formatarData(hojeISO())}`)

  const colValor = d.colunas.findIndex((c) => c.moeda)
  const corpo = d.linhas.map((l) => d.colunas.map((c) => (c.moeda ? reais(l[c.chave]) : l[c.chave])))
  const estiloTotal = { fontStyle: 'bold', fillColor: [241, 239, 232] }
  const resto = d.colunas.length - colValor - 1
  const linhaDeTotal = (texto, valor) => [
    { content: texto, colSpan: colValor, styles: estiloTotal },
    { content: reais(valor), styles: { ...estiloTotal, halign: 'right' } },
    { content: '', colSpan: resto, styles: estiloTotal },
  ]
  corpo.push(linhaDeTotal('Total', d.total))
  if (!d.ehEu) {
    corpo.push(linhaDeTotal('Já pago', d.pago))
    corpo.push(linhaDeTotal('Pendente', d.total - d.pago))
  }

  autoTable(doc, {
    startY: 30,
    head: [d.colunas.map((c) => c.titulo)],
    body: corpo,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 110, 86], textColor: 255 },
    columnStyles: { [colValor]: { halign: 'right' } },
    didParseCell: (dados) => {
      if (dados.section === 'head' && dados.column.index === colValor) dados.cell.styles.halign = 'right'
    },
  })

  doc.save(`${d.arquivo}.pdf`)
}

// =====================================================================
// EXPORTAÇÃO DO CARTÃO (modelo 2: resumo no topo, status colorido, aba por pessoa)
// Aba 1 "Compras": Parcela | Descrição | Valor | Pessoa(s) | Valor de cada um | Status
// Aba 2 "Por pessoa": Pessoa | Total | Pago | Pendente
// =====================================================================
export function dadosExportacaoCartao({ cartao, mes, lancs, encargos, vencimentoISO }) {
  const linhas = lancs.map((l) => {
    const partes = [...l.lancamento_participacoes].sort(
      (a, b) =>
        Number(!!b.pessoas?.eh_eu) - Number(!!a.pessoas?.eh_eu) ||
        (a.pessoas?.nome ?? '').localeCompare(b.pessoas?.nome ?? '')
    )
    const valores = partes.map((p) => p.valor_centavos)
    // divisão "igual" tolera 1 centavo de diferença (sobra do arredondamento)
    const igual = partes.length <= 1 || Math.max(...valores) - Math.min(...valores) <= 1
    const terceiros = partes.filter((p) => !p.pessoas?.eh_eu)
    const pagos = terceiros.filter((p) => p.pago).length
    const status =
      terceiros.length === 0
        ? '—'
        : pagos === terceiros.length
          ? 'Pago'
          : pagos === 0
            ? 'Pendente'
            : `Parcial (${pagos} de ${terceiros.length})`

    return {
      parcela: l.total_parcelas > 1 ? `${l.numero_parcela}/${l.total_parcelas}` : '—',
      descricao: l.despesas?.descricao ?? '',
      valor: l.valor_centavos,
      pessoas: partes.map((p) => p.pessoas?.nome ?? 'Sem pessoa').join(', '),
      cada: igual ? '—' : partes.map((p) => `${p.pessoas?.nome ?? 'Sem pessoa'} ${reais(p.valor_centavos)}`).join(' · '),
      status,
    }
  })

  // total de cada pessoa na fatura
  const mapa = new Map()
  lancs.forEach((l) =>
    l.lancamento_participacoes.forEach((p) => {
      const atual = mapa.get(p.pessoa_id) ?? {
        nome: p.pessoas?.nome ?? 'Sem pessoa',
        euMesmo: !!p.pessoas?.eh_eu,
        total: 0,
        pago: 0,
      }
      atual.total += p.valor_centavos
      if (p.pago) atual.pago += p.valor_centavos
      mapa.set(p.pessoa_id, atual)
    })
  )
  const porPessoa = [...mapa.values()].sort((a, b) => Number(b.euMesmo) - Number(a.euMesmo) || b.total - a.total)

  const totalCompras = soma(linhas, (l) => l.valor)
  const totalEncargos = soma(encargos, (e) => e.valor_centavos)
  const minha = soma(porPessoa.filter((p) => p.euMesmo), (p) => p.total)
  const terceiros = totalCompras - minha
  const falta = soma(porPessoa.filter((p) => !p.euMesmo), (p) => p.total - p.pago)

  return {
    titulo: `${cartao.nome} · Fatura de ${rotuloMes(mes)}`,
    subtitulo: `Vence em ${formatarData(vencimentoISO)} · Gerado em ${formatarData(hojeISO())}`,
    arquivo: nomeSeguro(`${cartao.nome} - fatura ${mesParaISO(mes).slice(0, 7)}`),
    linhas,
    porPessoa,
    totalCompras,
    totalEncargos,
    totalFatura: totalCompras + totalEncargos,
    minha,
    terceiros,
    falta,
  }
}

export async function exportarCartaoExcel(d) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Controle financeiro'

  // ----- Aba 1: Compras -----
  const ws = wb.addWorksheet('Compras', { views: [{ state: 'frozen', ySplit: 7 }] })
  const titulos = ['Parcela', 'Descrição', 'Valor', 'Pessoa(s)', 'Valor de cada um', 'Status']
  const larguras = [14, 32, 16, 28, 40, 18]
  larguras.forEach((l, i) => (ws.getColumn(i + 1).width = l))

  ws.mergeCells(1, 1, 1, 6)
  ws.getCell(1, 1).value = d.titulo
  ws.getCell(1, 1).font = { bold: true, size: 14 }
  ws.mergeCells(2, 1, 2, 6)
  ws.getCell(2, 1).value = d.subtitulo
  ws.getCell(2, 1).font = { size: 10, color: { argb: 'FF6B6B66' } }

  const quadros = [
    ['Total da fatura', d.totalFatura],
    ['Minha parte', d.minha],
    ['De terceiros', d.terceiros],
    ['Falta receber', d.falta],
  ]
  quadros.forEach(([rotulo, valor], i) => {
    const r = ws.getCell(4, i + 1)
    r.value = rotulo
    r.font = { size: 10, color: { argb: 'FF085041' } }
    r.fill = preenchimento('E1F5EE')
    const v = ws.getCell(5, i + 1)
    v.value = valor / 100
    v.numFmt = FORMATO_MOEDA
    v.font = { bold: true, size: 13 }
    v.fill = preenchimento('E1F5EE')
    v.alignment = { horizontal: 'left' }
  })

  const cabecalho = ws.getRow(7)
  titulos.forEach((t, i) => {
    const c = cabecalho.getCell(i + 1)
    c.value = t
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = preenchimento('0F6E56')
    c.alignment = { horizontal: i === 2 ? 'right' : 'left' }
  })

  d.linhas.forEach((l, k) => {
    const row = ws.getRow(8 + k)
    row.getCell(1).value = l.parcela
    row.getCell(2).value = l.descricao
    row.getCell(3).value = l.valor / 100
    row.getCell(3).numFmt = FORMATO_MOEDA
    row.getCell(4).value = l.pessoas
    row.getCell(5).value = l.cada
    const status = row.getCell(6)
    status.value = l.status
    const chave = chaveStatus(l.status)
    if (chave) {
      status.fill = preenchimento(EXCEL_STATUS[chave][0])
      status.font = { color: { argb: `FF${EXCEL_STATUS[chave][1]}` } }
    }
  })

  const primeira = 8
  const ultima = 7 + d.linhas.length
  const escreverTotal = (linha, texto, valor, negrito) => {
    const row = ws.getRow(linha)
    row.getCell(1).value = texto
    row.getCell(3).value = valor
    row.getCell(3).numFmt = FORMATO_MOEDA
    for (let i = 1; i <= 6; i++) {
      row.getCell(i).fill = preenchimento('F1EFE8')
      row.getCell(i).font = { bold: negrito }
    }
  }
  let proxima = ultima + 1
  escreverTotal(proxima, 'Total das compras', { formula: `SUBTOTAL(109,C${primeira}:C${ultima})`, result: d.totalCompras / 100 }, true)
  if (d.totalEncargos > 0) {
    escreverTotal(proxima + 1, 'Encargos (juros e taxas)', d.totalEncargos / 100, false)
    escreverTotal(proxima + 2, 'Total da fatura', d.totalFatura / 100, true)
  }
  ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: ultima, column: 6 } }

  // ----- Aba 2: Por pessoa -----
  const wp = wb.addWorksheet('Por pessoa', { views: [{ state: 'frozen', ySplit: 1 }] })
  const tp = ['Pessoa', 'Total', 'Pago', 'Pendente']
  ;[28, 16, 16, 16].forEach((l, i) => (wp.getColumn(i + 1).width = l))
  tp.forEach((t, i) => {
    const c = wp.getRow(1).getCell(i + 1)
    c.value = t
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    c.fill = preenchimento('0F6E56')
    c.alignment = { horizontal: i === 0 ? 'left' : 'right' }
  })
  d.porPessoa.forEach((p, k) => {
    const row = wp.getRow(2 + k)
    row.getCell(1).value = p.euMesmo ? `${p.nome} (você)` : p.nome
    row.getCell(2).value = p.total / 100
    row.getCell(3).value = p.euMesmo ? '—' : p.pago / 100
    row.getCell(4).value = p.euMesmo ? '—' : (p.total - p.pago) / 100
    ;[2, 3, 4].forEach((c) => {
      if (typeof row.getCell(c).value === 'number') row.getCell(c).numFmt = FORMATO_MOEDA
      row.getCell(c).alignment = { horizontal: 'right' }
    })
  })
  const linhaTotalPessoas = 2 + d.porPessoa.length
  const pagos = soma(d.porPessoa.filter((p) => !p.euMesmo), (p) => p.pago)
  const rowT = wp.getRow(linhaTotalPessoas)
  rowT.getCell(1).value = 'Total'
  rowT.getCell(2).value = d.totalCompras / 100
  rowT.getCell(3).value = pagos / 100
  rowT.getCell(4).value = d.falta / 100
  for (let i = 1; i <= 4; i++) {
    rowT.getCell(i).fill = preenchimento('F1EFE8')
    rowT.getCell(i).font = { bold: true }
    if (i > 1) {
      rowT.getCell(i).numFmt = FORMATO_MOEDA
      rowT.getCell(i).alignment = { horizontal: 'right' }
    }
  }

  const buffer = await wb.xlsx.writeBuffer()
  baixar(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `${d.arquivo}.xlsx`
  )
}

export async function exportarCartaoPDF(d) {
  const { doc, autoTable } = await novoPdf('landscape')
  cabecalhoPdf(doc, d.titulo, d.subtitulo)

  // resumo no topo
  autoTable(doc, {
    startY: 29,
    head: [['Total da fatura', 'Minha parte', 'De terceiros', 'Falta receber']],
    body: [[reais(d.totalFatura), reais(d.minha), reais(d.terceiros), reais(d.falta)]],
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [225, 245, 238], textColor: [8, 80, 65], fontStyle: 'normal' },
    bodyStyles: { fontStyle: 'bold', fontSize: 12 },
    tableWidth: 180,
  })

  // compras
  const estiloTotal = { fontStyle: 'bold', fillColor: [241, 239, 232] }
  const corpo = d.linhas.map((l) => [l.parcela, l.descricao, reais(l.valor), l.pessoas, l.cada, l.status])
  const linhaDeTotal = (texto, valor) => [
    { content: texto, colSpan: 2, styles: estiloTotal },
    { content: reais(valor), styles: { ...estiloTotal, halign: 'right' } },
    { content: '', colSpan: 3, styles: estiloTotal },
  ]
  corpo.push(linhaDeTotal('Total das compras', d.totalCompras))
  if (d.totalEncargos > 0) {
    corpo.push(linhaDeTotal('Encargos (juros e taxas)', d.totalEncargos))
    corpo.push(linhaDeTotal('Total da fatura', d.totalFatura))
  }

  autoTable(doc, {
    startY: doc.lastAutoTable.finalY + 6,
    head: [['Parcela', 'Descrição', 'Valor', 'Pessoa(s)', 'Valor de cada um', 'Status']],
    body: corpo,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [15, 110, 86], textColor: 255 },
    columnStyles: { 2: { halign: 'right' } },
    didParseCell: (dados) => {
      if (dados.section === 'head' && dados.column.index === 2) dados.cell.styles.halign = 'right'
      if (dados.section === 'body' && dados.column.index === 5) {
        const chave = chaveStatus(String(dados.cell.raw ?? ''))
        if (chave) {
          dados.cell.styles.fillColor = PDF_STATUS[chave][0]
          dados.cell.styles.textColor = PDF_STATUS[chave][1]
        }
      }
    },
  })

  // página 2: por pessoa
  doc.addPage()
  cabecalhoPdf(doc, 'Por pessoa', d.titulo)
  const pagos = soma(d.porPessoa.filter((p) => !p.euMesmo), (p) => p.pago)
  const corpoPessoas = d.porPessoa.map((p) => [
    p.euMesmo ? `${p.nome} (você)` : p.nome,
    reais(p.total),
    p.euMesmo ? '—' : reais(p.pago),
    p.euMesmo ? '—' : reais(p.total - p.pago),
  ])
  corpoPessoas.push(
    ['Total', reais(d.totalCompras), reais(pagos), reais(d.falta)].map((t) => ({ content: t, styles: estiloTotal }))
  )
  autoTable(doc, {
    startY: 30,
    head: [['Pessoa', 'Total', 'Pago', 'Pendente']],
    body: corpoPessoas,
    styles: { fontSize: 10 },
    headStyles: { fillColor: [15, 110, 86], textColor: 255 },
    columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    tableWidth: 180,
    didParseCell: (dados) => {
      if (dados.section === 'head' && dados.column.index > 0) dados.cell.styles.halign = 'right'
    },
  })

  doc.save(`${d.arquivo}.pdf`)
}
