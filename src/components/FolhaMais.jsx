import { useEffect, useRef } from 'react'
import { NavLink } from 'react-router-dom'
import { LogOut } from 'lucide-react'

// Folha que sobe de baixo (celular) com todas as telas que não ficam na barra de navegação.
// grupos: [{ titulo, itens: [{ para, rotulo, Icone }] }]
export default function FolhaMais({ aberta, aoFechar, aoSair, grupos }) {
  const ref = useRef(null)

  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (aberta && !dialogo.open) dialogo.showModal()
    if (!aberta && dialogo.open) dialogo.close()
  }, [aberta])

  return (
    <dialog
      ref={ref}
      className="folha"
      aria-label="Mais telas"
      onCancel={(evento) => {
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(evento) => {
        // toque no fundo escuro fecha a folha
        if (evento.target === ref.current) aoFechar()
      }}
    >
      <div className="folha-alca" aria-hidden="true" />
      <div className="folha-titulo">Mais</div>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="folha-grupo">
          <div className="folha-grupo-titulo">{grupo.titulo}</div>
          <div className="folha-grade">
            {grupo.itens.map(({ para, rotulo, Icone }) => (
              <NavLink
                key={para}
                to={para}
                onClick={aoFechar}
                className={({ isActive }) => (isActive ? 'folha-item ativo' : 'folha-item')}
              >
                <Icone size={20} aria-hidden="true" />
                <span>{rotulo}</span>
              </NavLink>
            ))}
          </div>
        </div>
      ))}

      <button type="button" className="folha-sair" onClick={aoSair}>
        <LogOut size={20} aria-hidden="true" />
        Sair
      </button>
    </dialog>
  )
}
