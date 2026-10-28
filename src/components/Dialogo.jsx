import { Fragment, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import '../dialogo.css'

const DialogoContext = createContext(null)

// Uso nas telas:
//   const { confirmar, perguntar } = useDialogo()
//   const ok = await confirmar({ titulo, mensagem, detalhes: [['Rótulo', 'valor']], aviso, confirmar: 'Excluir', perigo: true })
//   const texto = await perguntar({ titulo, mensagem, rotulo, valorInicial, placeholder, inputMode, confirmar: 'Salvar' })
//     (confirmar devolve true/false; perguntar devolve o texto, ou null se cancelar)
export function useDialogo() {
  return useContext(DialogoContext)
}

function Caixa({ tipo, opcoes, aoFechar }) {
  const dialogo = useRef(null)
  const campo = useRef(null)
  const [valor, setValor] = useState(opcoes.valorInicial ?? '')

  useEffect(() => {
    if (dialogo.current && !dialogo.current.open) dialogo.current.showModal()
    if (campo.current) {
      campo.current.focus()
      campo.current.select()
    }
  }, [])

  const cancelar = () => aoFechar(tipo === 'confirmar' ? false : null)

  const enviar = (evento) => {
    evento.preventDefault()
    aoFechar(tipo === 'confirmar' ? true : valor)
  }

  return (
    <dialog
      ref={dialogo}
      className="dialogo"
      aria-labelledby="dialogo-titulo"
      onCancel={(evento) => {
        evento.preventDefault()
        cancelar()
      }}
    >
      <form onSubmit={enviar}>
        <h2 id="dialogo-titulo">{opcoes.titulo}</h2>
        {opcoes.mensagem && <p>{opcoes.mensagem}</p>}

        {opcoes.detalhes && (
          <dl>
            {opcoes.detalhes.map(([rotulo, texto]) => (
              <Fragment key={rotulo}>
                <dt>{rotulo}</dt>
                <dd>{texto}</dd>
              </Fragment>
            ))}
          </dl>
        )}

        {opcoes.aviso && <p className="aviso">{opcoes.aviso}</p>}

        {tipo === 'perguntar' && (
          <label className="campo">
            {opcoes.rotulo}
            <input
              ref={campo}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={opcoes.placeholder}
              inputMode={opcoes.inputMode}
            />
          </label>
        )}

        <div className="acoes">
          <button type="button" className="botao-secundario" onClick={cancelar}>
            {opcoes.cancelar ?? 'Cancelar'}
          </button>
          <button type="submit" className={opcoes.perigo ? 'botao-perigo' : 'botao-primario pequeno'}>
            {opcoes.confirmar ?? (tipo === 'perguntar' ? 'Salvar' : 'Confirmar')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

export function DialogoProvider({ children }) {
  const [aberto, setAberto] = useState(null) // { tipo, opcoes, resolver }

  const abrir = useCallback(
    (tipo, opcoes) => new Promise((resolver) => setAberto({ tipo, opcoes, resolver })),
    []
  )
  const confirmar = useCallback((opcoes) => abrir('confirmar', opcoes), [abrir])
  const perguntar = useCallback((opcoes) => abrir('perguntar', opcoes), [abrir])
  const valor = useMemo(() => ({ confirmar, perguntar }), [confirmar, perguntar])

  function fechar(resultado) {
    aberto.resolver(resultado)
    setAberto(null)
  }

  return (
    <DialogoContext.Provider value={valor}>
      {children}
      {aberto && <Caixa tipo={aberto.tipo} opcoes={aberto.opcoes} aoFechar={fechar} />}
    </DialogoContext.Provider>
  )
}
