import { reaisParaCentavos } from './dinheiro'

// "Márcia  " -> "marcia" (sem acento, minúsculo, espaços únicos)
export const normalizar = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Recebe a matriz de células do CSV e devolve as linhas de compras.
// A aba pode ter linhas de título antes do cabeçalho (ex.: "NOVEMBRO").
export function lerPlanilha(matriz) {
  const cab = matriz.findIndex((linha) => {
    const nomes = linha.map(normalizar)
    return nomes.includes('parcela') && nomes.includes('total') && nomes.includes('quem')
  })
  if (cab === -1) {
    return {
      linhas: [],
      erro: 'Não encontrei o cabeçalho com as colunas parcela, descr, total, outros, meu e quem.',
    }
  }

  const nomes = matriz[cab].map(normalizar)
  const coluna = (prefixo) => nomes.findIndex((n) => n.startsWith(prefixo))
  const idx = {
    parcela: coluna('parcela'),
    descricao: coluna('descr'),
    total: coluna('total'),
    outros: coluna('outros'),
    meu: coluna('meu'),
    quem: coluna('quem'),
  }
  const faltando = Object.entries(idx)
    .filter(([nome, posicao]) => posicao === -1 && nome !== 'outros')
    .map(([nome]) => nome)
  if (faltando.length > 0) {
    return { linhas: [], erro: `Faltam colunas no cabeçalho: ${faltando.join(', ')}.` }
  }

  const texto = (celulas, posicao) => (posicao === -1 ? '' : String(celulas[posicao] ?? '').trim())

  const linhas = []
  matriz.slice(cab + 1).forEach((celulas, i) => {
    const descricao = texto(celulas, idx.descricao)
    if (!descricao || ['total', 'totais'].includes(normalizar(descricao))) return
    linhas.push({
      numero: cab + i + 2, // número da linha no arquivo
      parcela: texto(celulas, idx.parcela),
      descricao,
      total: texto(celulas, idx.total),
      outros: texto(celulas, idx.outros),
      meu: texto(celulas, idx.meu),
      quem: texto(celulas, idx.quem),
    })
  })
  return { linhas, erro: '' }
}

// Valida cada linha e monta a divisão por parcela (eu + a pessoa de "quem").
export function analisarLinhas(linhas, pessoas) {
  const eu = pessoas.find((p) => p.eh_eu)
  const porNome = new Map(pessoas.map((p) => [normalizar(p.nome), p]))

  return linhas.map((l) => {
    const problemas = []
    const avisos = []

    // parcela: "8/9"; vazio = compra à vista (1/1)
    let atual = 1
    let totalParcelas = 1
    if (l.parcela) {
      const m = l.parcela.match(/^(\d{1,3})\s*\/\s*(\d{1,3})$/)
      if (!m) {
        problemas.push('Parcela inválida (use o formato 3/10)')
      } else {
        atual = Number(m[1])
        totalParcelas = Number(m[2])
        if (atual < 1 || atual > totalParcelas) problemas.push('Parcela maior que o total de parcelas')
      }
    }

    // valores (o "total" da planilha é o valor da parcela naquele mês)
    const total = reaisParaCentavos(l.total)
    if (!total || total <= 0) problemas.push('Valor total inválido')
    const meu = reaisParaCentavos(l.meu) ?? 0 // "-" vira zero
    if (total && meu > total) problemas.push('"Meu" é maior que o total')
    const outros = total && meu <= total ? total - meu : 0

    const outrosPlanilha = reaisParaCentavos(l.outros)
    if (total && outrosPlanilha !== null && outrosPlanilha !== outros) {
      avisos.push('A coluna "outros" não bate com total − meu; usei total − meu')
    }

    // quem
    const nomeQuem = l.quem
    let pessoaQuem = null
    let nomeDesconhecido = null
    if (outros > 0) {
      if (!nomeQuem) {
        problemas.push('Há valor de outra pessoa, mas "quem" está vazio')
      } else if (/[,;+&/]|\se\s/i.test(nomeQuem)) {
        problemas.push('Mais de uma pessoa em "quem": lance esta compra manualmente')
      } else {
        pessoaQuem = porNome.get(normalizar(nomeQuem)) ?? null
        if (!pessoaQuem) nomeDesconhecido = nomeQuem
      }
    }

    // divisão por parcela
    const mapa = new Map()
    const somar = (id, valor) => mapa.set(id, (mapa.get(id) ?? 0) + valor)
    if (meu > 0 && eu) somar(eu.id, meu)
    if (outros > 0 && pessoaQuem) somar(pessoaQuem.id, outros)
    const participacoes = [...mapa].map(([pessoa_id, valor_centavos]) => ({ pessoa_id, valor_centavos }))

    return {
      ...l,
      atual,
      totalParcelas,
      totalCent: total ?? 0,
      meuCent: meu,
      outrosCent: outros,
      nomeDesconhecido,
      problemas,
      avisos,
      participacoes,
      ok: problemas.length === 0 && !nomeDesconhecido,
    }
  })
}
