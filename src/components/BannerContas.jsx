import { Link } from 'react-router-dom'
import { ChevronRight, CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import { useAvisos } from './AvisosContext'
import { centavosParaReais } from '../utils/dinheiro'
import { DIAS_DE_AVISO } from '../utils/vencimentos'

const soma = (lista) => lista.reduce((total, i) => total + i.valor, 0)

// Faixa com o resumo dos vencimentos. Com "para", ela inteira vira um botão que leva a essa rota.
export default function BannerContas({ para }) {
  const { itens, alertas, carregando } = useAvisos()
  if (carregando || itens.length === 0) return null

  const atrasadas = alertas.filter((a) => a.est.chave === 'atrasada')
  const hoje = alertas.filter((a) => a.est.chave === 'hoje')
  const breves = alertas.filter((a) => a.est.chave === 'breve')

  const partes = []
  if (hoje.length) partes.push(`${hoje.length} ${hoje.length === 1 ? 'vence hoje' : 'vencem hoje'}`)
  if (breves.length) {
    partes.push(`${breves.length} ${breves.length === 1 ? 'vence' : 'vencem'} nos próximos ${DIAS_DE_AVISO} dias`)
  }

  let chave
  let Icone
  let titulo
  let sub
  if (atrasadas.length) {
    chave = 'atrasada'
    Icone = TriangleAlert
    titulo = `${atrasadas.length} ${atrasadas.length === 1 ? 'conta atrasada' : 'contas atrasadas'} · ${centavosParaReais(soma(atrasadas))}`
    sub = partes.join(' · ')
  } else if (partes.length) {
    chave = 'hoje'
    Icone = Clock
    titulo = partes[0]
    sub = partes.slice(1).join(' · ')
  } else {
    chave = 'paga'
    Icone = CircleCheck
    titulo = 'Tudo em dia'
    sub = `Nenhuma conta vence nos próximos ${DIAS_DE_AVISO} dias.`
  }

  const conteudo = (
    <>
      <Icone size={22} aria-hidden="true" />
      <div className="banner-texto">
        <div className="banner-titulo">{titulo}</div>
        {sub && <div className="banner-sub">{sub}</div>}
      </div>
      {para && <ChevronRight size={20} aria-hidden="true" />}
    </>
  )

  return para ? (
    <Link to={para} className={`banner-contas estado-${chave}`}>
      {conteudo}
    </Link>
  ) : (
    <div className={`banner-contas estado-${chave}`} role="status">
      {conteudo}
    </div>
  )
}
