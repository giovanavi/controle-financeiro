import { ChevronLeft, ChevronRight } from 'lucide-react'
import { rotuloMes, somarMeses } from '../utils/meses'

export default function SeletorMes({ mes, aoMudar }) {
  return (
    <div className="seletor-mes">
      <button
        type="button"
        className="botao-icone"
        aria-label="Mês anterior"
        onClick={() => aoMudar(somarMeses(mes, -1))}
      >
        <ChevronLeft size={20} aria-hidden="true" />
      </button>
      <strong>{rotuloMes(mes)}</strong>
      <button
        type="button"
        className="botao-icone"
        aria-label="Próximo mês"
        onClick={() => aoMudar(somarMeses(mes, 1))}
      >
        <ChevronRight size={20} aria-hidden="true" />
      </button>
    </div>
  )
}
