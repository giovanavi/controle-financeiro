import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { EllipsisVertical } from 'lucide-react'

// itens: [{ rotulo, Icone, aoClicar, para, perigo }]
// - "para" faz o item ser um link; "aoClicar" faz ser um botão
// - "perigo" pinta o item de vermelho (ex.: Excluir)
export default function MenuAcoes({ itens, rotulo = 'Mais ações' }) {
  const [aberto, setAberto] = useState(false)
  const [acima, setAcima] = useState(false)
  const raiz = useRef(null)

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

  function alternar() {
    if (!aberto && raiz.current) {
      // se estiver perto do fim da tela, o menu abre para cima
      const espaco = window.innerHeight - raiz.current.getBoundingClientRect().bottom
      setAcima(espaco < 240)
    }
    setAberto(!aberto)
  }

  function escolher(item) {
    setAberto(false)
    item.aoClicar?.()
  }

  return (
    <div className="menu-acoes" ref={raiz}>
      <button
        type="button"
        className="menu-acoes-botao"
        aria-label={rotulo}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={alternar}
      >
        <EllipsisVertical size={20} aria-hidden="true" />
      </button>

      {aberto && (
        <div className={acima ? 'menu-acoes-lista acima' : 'menu-acoes-lista'} role="menu">
          {itens.map((item) => {
            const classe = item.perigo ? 'menu-acoes-item perigo' : 'menu-acoes-item'
            const conteudo = (
              <>
                <item.Icone size={18} aria-hidden="true" />
                <span>{item.rotulo}</span>
              </>
            )
            return item.para ? (
              <Link
                key={item.rotulo}
                role="menuitem"
                to={item.para}
                className={classe}
                onClick={() => setAberto(false)}
              >
                {conteudo}
              </Link>
            ) : (
              <button
                key={item.rotulo}
                type="button"
                role="menuitem"
                className={classe}
                onClick={() => escolher(item)}
              >
                {conteudo}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
