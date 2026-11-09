import { centavosParaReais } from './dinheiro'

// Estado de uma categoria frente ao limite (reaproveita as cores dos estados das contas):
//   'paga' = dentro do limite | 'breve' = a partir de 80% | 'atrasada' = passou do limite | 'sem' = sem limite
export function estadoOrcamento(gasto, limite) {
  if (!limite) return { chave: 'sem', pct: 0, texto: 'Sem limite' }
  const pct = Math.round((gasto / limite) * 100)
  if (gasto > limite) return { chave: 'atrasada', pct, texto: `Passou ${centavosParaReais(gasto - limite)}` }
  if (pct >= 80) return { chave: 'breve', pct, texto: `Faltam ${centavosParaReais(limite - gasto)}` }
  return { chave: 'paga', pct, texto: `${centavosParaReais(limite - gasto)} livres` }
}

// Classe da barra de progresso conforme o estado
export const classeBarra = (estado) =>
  estado.chave === 'atrasada' ? 'barra alta' : estado.chave === 'breve' ? 'barra media' : 'barra'

// Carrega o orçamento de um mês (mesISO = "AAAA-MM-01").
// O gasto de cada categoria é SÓ a sua parte (cartões, gastos fixos e extras do mês).
// O limite vale o da exceção do mês, se existir; senão o padrão.
export async function carregarOrcamentoMes(supabase, mesISO) {
  const [c, o, g] = await Promise.all([
    supabase.from('categorias').select('id, nome').order('nome'),
    supabase.from('orcamentos').select('*').or(`mes_referencia.is.null,mes_referencia.eq.${mesISO}`),
    supabase
      .from('lancamento_participacoes')
      .select('valor_centavos, pessoas!inner(eh_eu), lancamentos!inner(mes_referencia, despesas(categoria_id))')
      .eq('pessoas.eh_eu', true)
      .eq('lancamentos.mes_referencia', mesISO),
  ])

  const disponivel = !o.error // false se o funcoes8.sql ainda não foi executado
  if (c.error || g.error) return { erro: true, disponivel, linhas: [], semCategoria: 0 }

  const gastos = new Map()
  let semCategoria = 0
  g.data.forEach((x) => {
    const categoria = x.lancamentos.despesas?.categoria_id
    if (!categoria) semCategoria += x.valor_centavos
    else gastos.set(categoria, (gastos.get(categoria) ?? 0) + x.valor_centavos)
  })

  const limites = disponivel ? o.data : []
  const linhas = c.data.map((cat) => {
    const padrao = limites.find((x) => x.categoria_id === cat.id && x.mes_referencia === null)
    const excecao = limites.find((x) => x.categoria_id === cat.id && x.mes_referencia === mesISO)
    const limite = (excecao ?? padrao)?.valor_centavos ?? 0
    const gasto = gastos.get(cat.id) ?? 0
    return {
      id: cat.id,
      nome: cat.nome,
      gasto,
      limite,
      limitePadrao: padrao?.valor_centavos ?? 0,
      limiteMes: excecao?.valor_centavos ?? 0,
      temPadrao: !!padrao,
      temExcecao: !!excecao,
      estado: estadoOrcamento(gasto, limite),
    }
  })

  return { erro: false, disponivel, linhas, semCategoria }
}
