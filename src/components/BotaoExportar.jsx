import { useEffect, useRef, useState } from 'react'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'

// aoExportar('xlsx' | 'pdf') deve devolver uma promessa; o botão mostra "Gerando…" enquanto ela roda.
export default function BotaoExportar({ aoExportar, desabilitado = false }) {
  const [aberto, setAberto] = useState(false)
  const [gerando, setGerando] = useState(false)
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

  async function escolher(formato) {
    setAberto(false)
    setGerando(true)
    try {
      await aoExportar(formato)
    } finally {
      setGerando(false)
    }
  }

  return (
    <div className="menu-acoes" ref={raiz}>
      <button
        type="button"
        className="botao-secundario compacto"
        disabled={desabilitado || gerando}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto(!aberto)}
      >
        <Download size={16} aria-hidden="true" />
        {gerando ? 'Gerando…' : 'Exportar'}
      </button>

      {aberto && (
        <div className="menu-acoes-lista" role="menu">
          <button type="button" role="menuitem" className="menu-acoes-item" onClick={() => escolher('xlsx')}>
            <FileSpreadsheet size={18} aria-hidden="true" />
            <span>Planilha Excel (.xlsx)</span>
          </button>
          <button type="button" role="menuitem" className="menu-acoes-item" onClick={() => escolher('pdf')}>
            <FileText size={18} aria-hidden="true" />
            <span>PDF</span>
          </button>
        </div>
      )}
    </div>
  )
}
