import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CircleCheck, CircleX, Info, X } from 'lucide-react'
import '../feedback.css'

const ToastContext = createContext(null)

// Uso nas telas:
//   const { avisar } = useToast()
//   avisar('Despesa lançada')
//   avisar('Despesa lançada', { desfazer: async () => { ... } })   // mostra o botão "Desfazer"
//   avisar('Algo deu errado', { tipo: 'erro' })                      // tipo: 'ok' (padrão) | 'erro' | 'info'
export function useToast() {
  return useContext(ToastContext)
}

const ICONES = { ok: CircleCheck, erro: CircleX, info: Info }
const MAXIMO_NA_TELA = 3

export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([])
  const contador = useRef(0)
  const temporizadores = useRef(new Map())

  const fechar = useCallback((id) => {
    clearTimeout(temporizadores.current.get(id))
    temporizadores.current.delete(id)
    setAvisos((lista) => lista.filter((a) => a.id !== id))
  }, [])

  const avisar = useCallback(
    (texto, opcoes = {}) => {
      const id = ++contador.current
      const tipo = opcoes.tipo ?? 'ok'
      const duracao = opcoes.duracao ?? (opcoes.desfazer ? 8000 : tipo === 'erro' ? 7000 : 4500)
      setAvisos((lista) => [...lista, { id, texto, tipo, desfazer: opcoes.desfazer }].slice(-MAXIMO_NA_TELA))
      temporizadores.current.set(id, setTimeout(() => fechar(id), duracao))
      return id
    },
    [fechar]
  )

  // limpa os temporizadores ao desmontar
  useEffect(() => {
    const mapa = temporizadores.current
    return () => mapa.forEach((t) => clearTimeout(t))
  }, [])

  async function desfazer(aviso) {
    fechar(aviso.id)
    try {
      await aviso.desfazer()
      avisar('Desfeito', { tipo: 'info' })
    } catch {
      avisar('Não foi possível desfazer.', { tipo: 'erro' })
    }
  }

  const valor = useMemo(() => ({ avisar }), [avisar])

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts" aria-live="polite">
        {avisos.map((a) => {
          const Icone = ICONES[a.tipo]
          return (
            <div key={a.id} className={`toast toast-${a.tipo}`} role={a.tipo === 'erro' ? 'alert' : 'status'}>
              <Icone size={20} aria-hidden="true" />
              <span className="toast-texto">{a.texto}</span>
              {a.desfazer && (
                <button type="button" className="toast-desfazer" onClick={() => desfazer(a)}>
                  Desfazer
                </button>
              )}
              <button type="button" className="toast-fechar" aria-label="Fechar aviso" onClick={() => fechar(a.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
