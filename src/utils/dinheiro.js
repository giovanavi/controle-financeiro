const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

// 2590 -> "R$ 25,90"
export function centavosParaReais(centavos) {
  return formatador.format((centavos ?? 0) / 100)
}

// 150050 -> "1500,50" (para preencher campos de digitação)
export function centavosParaCampo(centavos) {
  return ((centavos ?? 0) / 100).toFixed(2).replace('.', ',')
}

// "1.500,50" ou "1500,50" ou "1500.50" -> 150050. Retorna null se for inválido.
export function reaisParaCentavos(texto) {
  let t = String(texto ?? '').replace(/[^\d,.]/g, '')
  if (!t) return null

  if (t.includes(',')) {
    // vírgula é o decimal; pontos são separadores de milhar
    t = t.replace(/\./g, '').replace(',', '.')
  } else if (/\.\d{3}$/.test(t)) {
    // "1.500" -> mil e quinhentos
    t = t.replace(/\./g, '')
  }

  const partes = t.split('.')
  if (partes.length > 2) return null

  const inteiro = Number(partes[0] || '0')
  const decimais = Number(((partes[1] ?? '') + '00').slice(0, 2))
  const centavos = inteiro * 100 + decimais
  return Number.isSafeInteger(centavos) ? centavos : null
}
