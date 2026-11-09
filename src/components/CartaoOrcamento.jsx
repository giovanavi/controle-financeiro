import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { centavosParaReais } from '../utils/dinheiro'
import { classeBarra } from '../utils/orcamento'

// Resumo do orçamento do mês: as categorias mais perto (ou acima) do limite.
export default function CartaoOrcamento({ orcamento, mesISO }) {
  if (!orcamento || orcamento.erro) return null

  if (!orcamento.disponivel) {
    return (
      <div className="bloco">
        <p className="aviso" style={{ margin: 0 }}>
          O orçamento ainda não está disponível. Rode o arquivo funcoes8.sql no Supabase.
        </p>
      </div>
    )
  }

  const comLimite = orcamento.linhas
    .filter((l) => l.limite > 0)
    .sort((a, b) => b.estado.pct - a.estado.pct)

  if (comLimite.length === 0) {
    if (orcamento.linhas.length === 0) return null
    return (
      <div className="bloco aviso-acao">
        <span>Defina um limite por categoria para acompanhar o orçamento do mês.</span>
        <Link className="botao-secundario compacto" to={`/orcamento?mes=${mesISO}`}>
          Definir limites
        </Link>
      </div>
    )
  }

  const estouradas = comLimite.filter((l) => l.estado.chave === 'atrasada').length
  const perto = comLimite.filter((l) => l.estado.chave === 'breve').length

  return (
    <div className="bloco secao-resumo">
      <div className="cabecalho-secao">
        <b>Orçamento do mês</b>
        <Link className="link-acao" to={`/orcamento?mes=${mesISO}`}>
          Ver tudo <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </div>

      <div className="acoes" style={{ marginBottom: 8 }}>
        {estouradas > 0 && (
          <span className="estado estado-atrasada">
            {estouradas} {estouradas === 1 ? 'categoria estourada' : 'categorias estouradas'}
          </span>
        )}
        {perto > 0 && <span className="estado estado-breve">{perto} perto do limite</span>}
        {estouradas === 0 && perto === 0 && <span className="estado estado-paga">Tudo dentro do limite</span>}
      </div>

      {comLimite.slice(0, 4).map((l) => (
        <div key={l.id} style={{ marginBottom: 10 }}>
          <div className="saldo-linha">
            <span>{l.nome}</span>
            <span>
              {centavosParaReais(l.gasto)} <span className="detalhe">de {centavosParaReais(l.limite)}</span>
            </span>
          </div>
          <div className={classeBarra(l.estado)}>
            <span style={{ width: `${Math.min(l.estado.pct, 100)}%` }} />
          </div>
        </div>
      ))}

      {orcamento.semCategoria > 0 && (
        <div className="detalhe">
          {centavosParaReais(orcamento.semCategoria)} sem categoria ·{' '}
          <Link to="/categorizar">categorizar compras</Link>
        </div>
      )}
    </div>
  )
}
