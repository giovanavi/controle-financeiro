import '../feedback.css'

// Carregamento em esqueleto: linhas cinza que "brilham" no lugar do texto "Carregando…".
export default function Esqueleto({ linhas = 4 }) {
  return (
    <div className="esqueleto" role="status" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <div key={i} className="esq-item">
          <div className="esq-barra" style={{ width: `${70 - (i % 3) * 12}%` }} />
          <div className="esq-barra curta" />
        </div>
      ))}
    </div>
  )
}
