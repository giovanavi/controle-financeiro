import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bell, Clock, Target, TriangleAlert } from 'lucide-react'
import { useAvisos } from './AvisosContext'
import { centavosParaReais } from '../utils/dinheiro'
import { DIAS_DE_AVISO } from '../utils/vencimentos'

// alinhar: lado em que o painel abre ('direita' no topo do celular, 'esquerda' no menu lateral)
export default function Sino({ alinhar = 'direita' }) {
  const { alertas, alertasOrcamento } = useAvisos()
  const [aberto, setAberto] = useState(false)
  const raiz = useRef(null)
  const local = useLocation()

  // fecha ao trocar de tela
  useEffect(() => {
    setAberto(false)
  }, [local.pathname])

  // fecha ao tocar fora ou apertar Esc
  useEffect(() => {
    if (!aberto) return
    const fora = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAberto(false)
    }
    const tecla = (evento) => {
      if (evento.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('touchstart', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('touchstart', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [aberto])

  const total = alertas.length + alertasOrcamento.length

  return (
    <div className="sino" ref={raiz}>
      <button
        type="button"
        className="menu-acoes-botao"
        aria-label={total > 0 ? `Avisos: ${total} conta(s) pedindo atenção` : 'Avisos'}
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <Bell size={20} aria-hidden="true" />
        {total > 0 && <span className="sino-contador">{total}</span>}
      </button>

      {aberto && (
        <div className={`sino-painel ${alinhar}`} role="dialog" aria-label="Avisos">
          <div className="sino-titulo">Avisos</div>

          {total === 0 ? (
            <p className="sino-vazio">
              Nenhuma conta atrasada ou vencendo nos próximos {DIAS_DE_AVISO} dias, e nenhuma categoria perto do limite.
            </p>
          ) : (
            <>
              {alertas.map((a) => {
                const Icone = a.est.chave === 'atrasada' ? TriangleAlert : Clock
                return (
                  <Link key={a.chave} to="/contas" className="sino-item">
                    <span className={`selo-mini estado-${a.est.chave}`}>
                      <Icone size={16} aria-hidden="true" />
                    </span>
                    <div className="item-texto">
                      <div className="titulo">{a.nome}</div>
                      <div className="detalhe">
                        {a.est.texto} · {centavosParaReais(a.valor)}
                      </div>
                    </div>
                  </Link>
                )
              })}
              {alertasOrcamento.map((o) => (
                <Link key={o.id} to="/orcamento" className="sino-item">
                  <span className={`selo-mini estado-${o.estado.chave}`}>
                    <Target size={16} aria-hidden="true" />
                  </span>
                  <div className="item-texto">
                    <div className="titulo">
                      {o.nome}: {o.estado.chave === 'atrasada' ? 'passou do limite' : `${o.estado.pct}% do limite`}
                    </div>
                    <div className="detalhe">
                      {centavosParaReais(o.gasto)} de {centavosParaReais(o.limite)} · {o.estado.texto}
                    </div>
                  </div>
                </Link>
              ))}
            </>
          )}

          <Link to="/contas" className="botao-secundario compacto">
            Ver contas a pagar
          </Link>
        </div>
      )}
    </div>
  )
}
