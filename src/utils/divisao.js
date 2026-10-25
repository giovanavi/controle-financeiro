import { centavosParaReais, reaisParaCentavos } from './dinheiro'

const SEM_PARTES = { partes: [], ok: false }

// Calcula quanto cada pessoa paga. Tudo em centavos inteiros.
// modo: 'igual' | 'valor' | 'percentual'
// ids: pessoas marcadas (na ordem da tela)
// valores / percentuais: textos digitados, indexados pelo id da pessoa
export function calcularDivisao({ modo, total, ids, valores, percentuais }) {
  if (!ids.length) return { ...SEM_PARTES, aviso: 'Escolha ao menos uma pessoa.' }
  if (!total || total <= 0) {
    return { ...SEM_PARTES, aviso: 'Informe o valor total para calcular a divisão.' }
  }

  // Igual: os centavos que sobram vão um a um para as primeiras pessoas
  if (modo === 'igual') {
    const base = Math.floor(total / ids.length)
    const resto = total - base * ids.length
    const partes = ids.map((id, i) => ({
      pessoa_id: id,
      valor_centavos: base + (i < resto ? 1 : 0),
    }))
    return { partes, ok: true, aviso: '' }
  }

  // Porcentagem: 33,33% vira 3333 "pontos" (1% = 100 pontos); o total precisa ser 10000
  if (modo === 'percentual') {
    const pontos = ids.map((id) => reaisParaCentavos(percentuais[id]) ?? 0)
    const somaPontos = pontos.reduce((a, b) => a + b, 0)
    const partes = ids.map((id, i) => ({
      pessoa_id: id,
      valor_centavos: Math.floor((total * pontos[i]) / 10000),
    }))

    if (somaPontos !== 10000) {
      const atual = (somaPontos / 100).toLocaleString('pt-BR')
      return { partes, ok: false, aviso: `As porcentagens somam ${atual}%. Precisam somar 100%.` }
    }

    // distribui os centavos perdidos no arredondamento
    let resto = total - partes.reduce((a, p) => a + p.valor_centavos, 0)
    for (const parte of partes) {
      if (resto <= 0) break
      if (parte.valor_centavos > 0) {
        parte.valor_centavos += 1
        resto -= 1
      }
    }
    return { partes, ok: true, aviso: '' }
  }

  // Por valor: a soma digitada precisa bater com o total
  const partes = ids.map((id) => ({
    pessoa_id: id,
    valor_centavos: reaisParaCentavos(valores[id]) ?? 0,
  }))
  const soma = partes.reduce((a, p) => a + p.valor_centavos, 0)
  const diferenca = total - soma
  if (diferenca === 0) return { partes, ok: true, aviso: '' }
  return {
    partes,
    ok: false,
    aviso:
      diferenca > 0
        ? `Faltam ${centavosParaReais(diferenca)} para fechar o total.`
        : `A divisão passou ${centavosParaReais(-diferenca)} do total.`,
  }
}
