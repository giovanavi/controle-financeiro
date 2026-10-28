import { useEffect, useState } from 'react'

// "2026-10-25" -> "25/10/2026"
const isoParaTexto = (iso) => (iso ? iso.split('-').reverse().join('/') : '')

// "25/10/2026" -> "2026-10-25" (ou "" se estiver incompleta ou for uma data inexistente)
function textoParaISO(texto) {
  const m = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return ''
  const [, dia, mes, ano] = m
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia))
  const existe =
    d.getFullYear() === Number(ano) && d.getMonth() === Number(mes) - 1 && d.getDate() === Number(dia)
  return existe ? `${ano}-${mes}-${dia}` : ''
}

// Aplica a máscara enquanto a pessoa digita: 25102026 -> 25/10/2026
function mascara(digitos) {
  const d = digitos.slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

// valor: data em formato ISO (AAAA-MM-DD) ou "" | aoMudar recebe ISO, ou "" se a data estiver incompleta/inválida
export default function CampoData({ valor, aoMudar, ...resto }) {
  const [texto, setTexto] = useState(isoParaTexto(valor))

  // acompanha mudanças vindas de fora (ex.: carregar uma despesa para editar, ou limpar o formulário)
  useEffect(() => {
    if (textoParaISO(texto) !== valor) setTexto(isoParaTexto(valor))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor])

  function digitar(evento) {
    const formatado = mascara(evento.target.value.replace(/\D/g, ''))
    setTexto(formatado)
    aoMudar(textoParaISO(formatado))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd/mm/aaaa"
      maxLength={10}
      value={texto}
      onChange={digitar}
      {...resto}
    />
  )
}
