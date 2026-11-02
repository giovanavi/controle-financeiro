import { normalizar } from './importacao'

// "Mercado Pago" -> "mercado pago" (minúsculo, sem acento, espaços únicos)
export const normalizarPalavra = (texto) => normalizar(texto)

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// A regra casa quando a palavra COMEÇA uma palavra da descrição:
// "uber" casa com "uber trip" e "pagamento uber", mas não com "suber".
export function casaRegra(descricaoNormalizada, palavra) {
  return new RegExp(`(^|[^a-z0-9])${escapar(palavra)}`).test(descricaoNormalizada)
}

// Devolve a regra que vale para a descrição (a de palavra mais longa vence), ou null.
export function categoriaPorRegras(descricao, regras) {
  const normalizada = normalizar(descricao)
  const achadas = regras.filter((r) => casaRegra(normalizada, r.palavra))
  achadas.sort((a, b) => b.palavra.length - a.palavra.length)
  return achadas[0] ?? null
}

// Palavras que aparecem em 2 ou mais descrições e ainda não são regra (para sugerir novas regras).
export function palavrasComuns(descricoes, regras) {
  const contagem = new Map()
  descricoes.forEach((descricao) => {
    const unicas = new Set(
      normalizar(descricao)
        .split(/[^a-z0-9]+/)
        .filter((p) => p.length >= 3)
    )
    unicas.forEach((p) => contagem.set(p, (contagem.get(p) ?? 0) + 1))
  })
  const existentes = new Set(regras.map((r) => r.palavra))
  return [...contagem]
    .filter(([palavra, quantas]) => quantas >= 2 && !existentes.has(palavra))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([palavra]) => palavra)
}

// Atualiza a categoria de várias compras, em blocos para não estourar o tamanho da URL.
// categoriaId = null remove a categoria. Devolve true se tudo deu certo.
export async function atualizarCategoria(supabase, ids, categoriaId) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase
      .from('despesas')
      .update({ categoria_id: categoriaId })
      .in('id', ids.slice(i, i + 100))
    if (error) return false
  }
  return true
}
