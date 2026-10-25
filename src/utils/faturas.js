const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Mesma regra da função mes_fatura do banco:
// compra no dia do fechamento ou depois vai para o fechamento do mês seguinte;
// se o vencimento é no dia do fechamento ou antes, a fatura vence no mês seguinte ao fechamento.
// dataISO: "2026-10-25". Retorna { ano, mes } com mes de 0 a 11 (mês de vencimento).
export function mesDaFatura(dataISO, fechamento, vencimento) {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const deslocamento = (dia >= fechamento ? 1 : 0) + (vencimento <= fechamento ? 1 : 0)
  const indice = mes - 1 + deslocamento
  return { ano: ano + Math.floor(indice / 12), mes: indice % 12 }
}

export function nomeDoMes({ ano, mes }) {
  return `${MESES[mes]}/${ano}`
}
