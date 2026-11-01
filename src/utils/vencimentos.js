import { formatarData } from './meses'

const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// quantos dias de antecedência entram nos avisos (sino, faixa do Resumo)
export const DIAS_DE_AVISO = 3

export const hojeLocal = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD no fuso local

export const plural = (n) => `${n} ${n === 1 ? 'dia' : 'dias'}`

// "2026-11-05" -> 5 (dias a partir de hoje; negativo = já passou)
export function diasAte(iso) {
  const [a, m, d] = iso.split('-').map(Number)
  const [ha, hm, hd] = hojeLocal().split('-').map(Number)
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
}

// Estado visual de uma conta: { chave, texto, dias }
// chave: 'paga' | 'atrasada' | 'hoje' | 'breve' | 'normal' | 'sem'
export function estadoConta({ venc, paga, pagaEm }) {
  if (paga) return { chave: 'paga', texto: pagaEm ? `Paga em ${formatarData(pagaEm)}` : 'Paga', dias: null }
  if (!venc) return { chave: 'sem', texto: 'Sem vencimento', dias: null }
  const dias = diasAte(venc)
  if (dias < 0) return { chave: 'atrasada', texto: `Atrasada há ${plural(-dias)}`, dias }
  if (dias === 0) return { chave: 'hoje', texto: 'Vence hoje', dias }
  if (dias === 1) return { chave: 'breve', texto: 'Vence amanhã', dias }
  if (dias <= DIAS_DE_AVISO) return { chave: 'breve', texto: `Vence em ${plural(dias)}`, dias }
  return { chave: 'normal', texto: `Vence em ${plural(dias)}`, dias }
}

// Grupo da lista de Contas a pagar
export function grupoConta(est) {
  if (est.chave === 'paga') return 'Pagas'
  if (est.dias < 0) return 'Atrasadas'
  if (est.dias === 0) return 'Vencem hoje'
  if (est.dias <= 7) return 'Próximos 7 dias'
  return 'Mais adiante'
}
export const ORDEM_GRUPOS = ['Atrasadas', 'Vencem hoje', 'Próximos 7 dias', 'Mais adiante', 'Pagas']

// Vencimento de uma fatura: o mês dela (AAAA-MM-01) com o dia de vencimento do cartão.
// Em meses curtos, vai para o último dia do mês.
export function vencimentoDaFatura(mesISO, diaVencimento) {
  const [ano, mes] = mesISO.split('-').map(Number)
  const ultimo = new Date(ano, mes, 0).getDate()
  const dia = Math.min(diaVencimento, ultimo)
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

// "2026-11-05" -> { dia: '05', mes: 'nov' }
export function diaEMes(iso) {
  const [, m, d] = iso.split('-')
  return { dia: d, mes: MESES_CURTOS[Number(m) - 1] }
}

// "2026-10-31" somado a n dias -> "2026-12-30"
export function somarDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d + n).toLocaleDateString('en-CA')
}
