import { reaisParaCentavos } from '../utils/dinheiro'

const MAXIMO_DE_DIGITOS = 12 // até R$ 9.999.999.999,99

// "2590" -> "25,90" | "123456" -> "1.234,56" | "" -> ""
// Também aceita o texto de centavos de um número: formatarMoedaDigitada(String(150050)) -> "1.500,50"
export function formatarMoedaDigitada(texto) {
  const digitos = String(texto ?? '')
    .replace(/\D/g, '')
    .replace(/^0+/, '')
    .slice(0, MAXIMO_DE_DIGITOS)
  if (!digitos) return ''
  return (Number(digitos) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Você digita só os números (teclado numérico no celular) e o campo monta o valor:
// 2, 5, 9, 0 -> 0,02 -> 0,25 -> 2,59 -> 25,90
// valor: texto já formatado ("25,90") | aoMudar recebe o texto formatado, aceito por reaisParaCentavos
export default function CampoMoeda({ valor, aoMudar, ...resto }) {
  function aoColar(evento) {
    // texto colado com vírgula ou ponto (ex.: "1500" ou "25.90") é lido como valor em reais, não como centavos
    const centavos = reaisParaCentavos(evento.clipboardData.getData('text'))
    if (centavos === null) return
    evento.preventDefault()
    aoMudar(formatarMoedaDigitada(String(centavos)))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="0,00"
      value={valor}
      onChange={(e) => aoMudar(formatarMoedaDigitada(e.target.value))}
      onPaste={aoColar}
      {...resto}
    />
  )
}
