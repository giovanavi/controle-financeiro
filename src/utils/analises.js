import { mesAtual, mesParaISO, somarMeses } from './meses'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// { ano: 2026, mes: 10 } -> "nov/26"
export const rotuloCurto = ({ ano, mes }) => `${MESES_CURTOS[mes]}/${String(ano).slice(2)}`

// Lista os `quantidade` meses terminando em `fim`, do mais antigo ao mais novo
export function listarMeses(fim, quantidade) {
  return Array.from({ length: quantidade }, (_, i) => somarMeses(fim, i - (quantidade - 1)))
}

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// O banco devolve no máximo 1000 linhas por consulta: busca em páginas até acabar.
// `fabrica` deve devolver uma consulta nova a cada chamada (já com .order('id')).
export async function buscarTudo(fabrica) {
  const tamanho = 1000
  let tudo = []
  for (let inicio = 0; ; inicio += tamanho) {
    const { data, error } = await fabrica().range(inicio, inicio + tamanho - 1)
    if (error) return { erro: true, dados: [] }
    tudo = tudo.concat(data)
    if (data.length < tamanho) break
  }
  return { erro: false, dados: tudo }
}

// Receitas x gasto mês a mês e gasto por categoria, nos `quantidade` meses até `fim`.
// O gasto é SÓ a sua parte (cartões, gastos fixos e extras), como no resto do app.
export async function carregarAnalises(supabase, fim, quantidade) {
  const meses = listarMeses(fim, quantidade)
  const primeiro = mesParaISO(meses[0])
  const ultimo = mesParaISO(meses[meses.length - 1])

  const [part, rec, enc, cats, orc] = await Promise.all([
    buscarTudo(() =>
      supabase
        .from('lancamento_participacoes')
        .select('valor_centavos, pessoas!inner(eh_eu), lancamentos!inner(mes_referencia, despesas(categoria_id))')
        .eq('pessoas.eh_eu', true)
        .gte('lancamentos.mes_referencia', primeiro)
        .lte('lancamentos.mes_referencia', ultimo)
        .order('id')
    ),
    supabase.from('receitas').select('valor_centavos, mes_referencia').gte('mes_referencia', primeiro).lte('mes_referencia', ultimo),
    supabase
      .from('fatura_encargos')
      .select('valor_centavos, faturas!inner(mes_referencia)')
      .gte('faturas.mes_referencia', primeiro)
      .lte('faturas.mes_referencia', ultimo),
    supabase.from('categorias').select('id, nome').order('nome'),
    supabase.from('orcamentos').select('*'),
  ])

  if (part.erro || cats.error) return { erro: true }

  const porMes = new Map(
    meses.map((m) => [mesParaISO(m), { iso: mesParaISO(m), rotulo: rotuloCurto(m), receita: 0, gasto: 0, encargos: 0 }])
  )
  const catJanela = new Map()
  const catUltimo = new Map()
  let semJanela = 0
  let semUltimo = 0

  part.dados.forEach((x) => {
    const iso = x.lancamentos.mes_referencia
    const mes = porMes.get(iso)
    if (!mes) return
    mes.gasto += x.valor_centavos
    const categoria = x.lancamentos.despesas?.categoria_id
    if (!categoria) {
      semJanela += x.valor_centavos
      if (iso === ultimo) semUltimo += x.valor_centavos
    } else {
      catJanela.set(categoria, (catJanela.get(categoria) ?? 0) + x.valor_centavos)
      if (iso === ultimo) catUltimo.set(categoria, (catUltimo.get(categoria) ?? 0) + x.valor_centavos)
    }
  })
  ;(rec.error ? [] : rec.data).forEach((r) => {
    const mes = porMes.get(r.mes_referencia)
    if (mes) mes.receita += r.valor_centavos
  })
  ;(enc.error ? [] : enc.data).forEach((e) => {
    const mes = porMes.get(e.faturas.mes_referencia)
    if (mes) mes.encargos += e.valor_centavos
  })

  // limite efetivo de cada categoria em cada mês (exceção do mês, senão o padrão)
  const limites = orc.error ? [] : orc.data
  const limiteDe = (categoriaId, iso) => {
    const excecao = limites.find((l) => l.categoria_id === categoriaId && l.mes_referencia === iso)
    const padrao = limites.find((l) => l.categoria_id === categoriaId && l.mes_referencia === null)
    return (excecao ?? padrao)?.valor_centavos ?? 0
  }

  const categorias = cats.data.map((c) => ({
    id: c.id,
    nome: c.nome,
    gastoJanela: catJanela.get(c.id) ?? 0,
    gastoMes: catUltimo.get(c.id) ?? 0,
    limiteJanela: soma(meses, (m) => limiteDe(c.id, mesParaISO(m))),
    limiteMes: limiteDe(c.id, ultimo),
  }))

  return { erro: false, meses: [...porMes.values()], categorias, semJanela, semUltimo }
}

// Parcelas de cartão já comprometidas nos próximos `quantidade` meses:
// quanto é sua e quanto é das outras pessoas, e a receita prevista de cada mês.
export async function carregarParcelasFuturas(supabase, quantidade) {
  const atual = mesAtual()
  const meses = Array.from({ length: quantidade }, (_, i) => somarMeses(atual, i + 1))
  const primeiro = mesParaISO(meses[0])
  const ultimo = mesParaISO(meses[meses.length - 1])

  const [part, rec] = await Promise.all([
    buscarTudo(() =>
      supabase
        .from('lancamento_participacoes')
        .select('valor_centavos, pessoas(eh_eu), lancamentos!inner(mes_referencia, despesas!inner(tipo))')
        .eq('lancamentos.despesas.tipo', 'cartao')
        .gte('lancamentos.mes_referencia', primeiro)
        .lte('lancamentos.mes_referencia', ultimo)
        .order('id')
    ),
    supabase.from('receitas').select('valor_centavos, mes_referencia').gte('mes_referencia', primeiro).lte('mes_referencia', ultimo),
  ])
  if (part.erro) return { erro: true }

  const porMes = new Map(
    meses.map((m) => [mesParaISO(m), { iso: mesParaISO(m), rotulo: rotuloCurto(m), minha: 0, terceiros: 0, receita: 0 }])
  )
  part.dados.forEach((x) => {
    const mes = porMes.get(x.lancamentos.mes_referencia)
    if (!mes) return
    if (x.pessoas?.eh_eu) mes.minha += x.valor_centavos
    else mes.terceiros += x.valor_centavos
  })
  ;(rec.error ? [] : rec.data).forEach((r) => {
    const mes = porMes.get(r.mes_referencia)
    if (mes) mes.receita += r.valor_centavos
  })

  return { erro: false, meses: [...porMes.values()] }
}
