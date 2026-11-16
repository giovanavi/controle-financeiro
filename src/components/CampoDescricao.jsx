import { useState } from 'react'

// Campo de texto com lista de sugestões embaixo (descrições já usadas).
// sugestoes: [{ descricao, rotulo }]  |  aoEscolher(sugestao) é chamado ao tocar numa sugestão
export default function CampoDescricao({ valor, aoMudar, sugestoes, aoEscolher }) {
  const [focado, setFocado] = useState(false)
  const [ativa, setAtiva] = useState(-1)

  const aberto = focado && sugestoes.length > 0

  function aoTeclar(evento) {
    if (!aberto) return
    if (evento.key === 'ArrowDown') {
      evento.preventDefault()
      setAtiva((ativa + 1) % sugestoes.length)
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault()
      setAtiva((ativa - 1 + sugestoes.length) % sugestoes.length)
    } else if (evento.key === 'Enter' && ativa >= 0) {
      evento.preventDefault() // não envia o formulário
      escolher(sugestoes[ativa])
    } else if (evento.key === 'Escape') {
      setFocado(false)
    }
  }

  function escolher(sugestao) {
    aoEscolher(sugestao)
    setAtiva(-1)
    setFocado(false)
  }

  return (
    <div className="descricao-campo">
      <input
        value={valor}
        onChange={(e) => {
          aoMudar(e.target.value)
          setAtiva(-1)
        }}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        onKeyDown={aoTeclar}
        autoComplete="off"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
      />

      {aberto && (
        <ul className="descricao-sugestoes" role="listbox">
          {sugestoes.map((s, i) => (
            <li
              key={s.descricao}
              role="option"
              aria-selected={i === ativa}
              className={i === ativa ? 'ativa' : ''}
              // mouseDown + preventDefault evita que o campo perca o foco antes do toque ser lido
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => escolher(s)}
            >
              <span>{s.descricao}</span>
              {s.rotulo && <span className="detalhe">{s.rotulo}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
