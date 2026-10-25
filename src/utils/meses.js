const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

// Um "mês" é sempre { ano, mes } com mes de 0 (janeiro) a 11 (dezembro)
export function mesAtual() {
  const d = new Date()
  return { ano: d.getFullYear(), mes: d.getMonth() }
}

export function somarMeses({ ano, mes }, n) {
  const indice = ano * 12 + mes + n
  return { ano: Math.floor(indice / 12), mes: ((indice % 12) + 12) % 12 }
}

// { ano: 2026, mes: 9 } -> "2026-10-01" (formato usado no banco)
export const mesParaISO = ({ ano, mes }) => `${ano}-${String(mes + 1).padStart(2, '0')}-01`

// "2026-10-01" -> { ano: 2026, mes: 9 }
export function mesDeISO(iso) {
  const [ano, mes] = iso.split('-').map(Number)
  return { ano, mes: mes - 1 }
}

// { ano: 2026, mes: 9 } -> "Outubro 2026"
export function rotuloMes({ ano, mes }) {
  const nome = MESES[mes]
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${ano}`
}

export const hojeISO = () => new Date().toLocaleDateString('en-CA')

// "2026-10-25" -> "25/10/2026"
export const formatarData = (iso) => (iso ? iso.split('-').reverse().join('/') : '')
