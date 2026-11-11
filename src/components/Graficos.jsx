import { centavosParaReais } from '../utils/dinheiro'
import '../analises.css'

export const PALETA = ['#0F6E56', '#378ADD', '#BA7517', '#D85A30', '#7F77DD', '#639922', '#D4537E', '#1D9E75', '#5F5E5A', '#A32D2D']
export const COR_SEM_CATEGORIA = '#888780'
export const COR_OUTRAS = '#B4B2A9'

// 123456 (centavos) -> "1,2 mil"; 8500 -> "85"
function compacto(centavos) {
  const reais = centavos / 100
  if (reais >= 1000) return `${(reais / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return String(Math.round(reais))
}

// arredonda o máximo do eixo para 1, 2, 5 ou 10 vezes uma potência de 10
function maximoBonito(valor) {
  const base = Math.pow(10, Math.floor(Math.log10(valor)))
  const f = valor / base
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * base
}

const porcento = (valor, total) => (total > 0 ? Math.round((valor / total) * 100) : 0)

// ---------- Gasto por categoria: barras horizontais ----------
// itens: [{ id, nome, valor, limite, cor }]
export function BarrasCategorias({ itens, total, rotuloLimite = 'Limite' }) {
  const maximo = Math.max(...itens.flatMap((i) => [i.valor, i.limite]), 1)
  return (
    <ul className="barras-cat">
      {itens.map((i) => (
        <li key={i.id}>
          <div className="barras-topo">
            <span className="barras-nome">
              <i className="ponto" style={{ background: i.cor }} aria-hidden="true" />
              {i.nome}
            </span>
            <span>
              {centavosParaReais(i.valor)} <span className="detalhe">{porcento(i.valor, total)}%</span>
            </span>
          </div>
          <div className="barras-trilha">
            <div className="barras-barra" style={{ width: `${(i.valor / maximo) * 100}%`, background: i.cor }} />
            {i.limite > 0 && (
              <div
                className="barras-limite"
                style={{ left: `${(i.limite / maximo) * 100}%` }}
                title={`${rotuloLimite}: ${centavosParaReais(i.limite)}`}
              />
            )}
          </div>
          {i.limite > 0 && (
            <div className="detalhe">
              {rotuloLimite} {centavosParaReais(i.limite)}
              {i.valor > i.limite && ` · passou ${centavosParaReais(i.valor - i.limite)}`}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

// ---------- Gasto por categoria: rosca ----------
export function RoscaCategorias({ itens, total }) {
  const R = 70
  const C = 2 * Math.PI * R
  let acumulado = 0
  const resumo = itens.map((i) => `${i.nome} ${porcento(i.valor, total)}%`).join(', ')

  return (
    <div className="rosca-grade">
      <svg viewBox="0 0 200 200" className="rosca" role="img" aria-label={`Gasto por categoria: ${resumo}`}>
        <g transform="rotate(-90 100 100)">
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--border)" strokeWidth="28" />
          {itens.map((i) => {
            const comprimento = total > 0 ? (i.valor / total) * C : 0
            const circulo = (
              <circle
                key={i.id}
                cx="100"
                cy="100"
                r={R}
                fill="none"
                stroke={i.cor}
                strokeWidth="28"
                strokeDasharray={`${comprimento} ${C - comprimento}`}
                strokeDashoffset={-acumulado}
              />
            )
            acumulado += comprimento
            return circulo
          })}
        </g>
        <text x="100" y="95" textAnchor="middle" className="rosca-rotulo">Total</text>
        <text x="100" y="117" textAnchor="middle" className="rosca-valor">{centavosParaReais(total)}</text>
      </svg>

      <ul className="legenda-lista">
        {itens.map((i) => (
          <li key={i.id}>
            <span className="barras-nome">
              <i className="ponto" style={{ background: i.cor }} aria-hidden="true" />
              {i.nome}
            </span>
            <span>
              {centavosParaReais(i.valor)} <span className="detalhe">{porcento(i.valor, total)}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Eixo vertical com 3 linhas de referência (0, metade e máximo)
function Eixo({ max, altura, topo, margemEsq, largura }) {
  const y = (v) => altura - (v / max) * (altura - topo)
  return [0, max / 2, max].map((v) => (
    <g key={v}>
      <line x1={margemEsq} x2={largura} y1={y(v)} y2={y(v)} className="grade" />
      <text x={margemEsq - 6} y={y(v) + 4} textAnchor="end" className="eixo">{compacto(v)}</text>
    </g>
  ))
}

// ---------- Receitas x gasto, mês a mês: colunas lado a lado ----------
// meses: [{ iso, rotulo, receita, gasto, encargos }]
export function ColunasMeses({ meses }) {
  const larguraMes = 46
  const altura = 170
  const topo = 10
  const margemEsq = 38
  const largura = margemEsq + meses.length * larguraMes
  const gastoDe = (m) => m.gasto + m.encargos
  const max = maximoBonito(Math.max(...meses.flatMap((m) => [m.receita, gastoDe(m)]), 1))
  const y = (v) => altura - (v / max) * (altura - topo)

  return (
    <div className="grafico-rolagem">
      <svg
        viewBox={`0 0 ${largura} ${altura + 24}`}
        style={{ minWidth: largura }}
        role="img"
        aria-label="Receitas e gasto de cada mês; os valores estão na tabela abaixo"
      >
        <Eixo max={max} altura={altura} topo={topo} margemEsq={margemEsq} largura={largura} />
        {meses.map((m, i) => {
          const x = margemEsq + i * larguraMes + 8
          return (
            <g key={m.iso}>
              <rect x={x} y={y(m.receita)} width="13" height={altura - y(m.receita)} rx="2" className="col-receita" />
              <rect x={x + 16} y={y(gastoDe(m))} width="13" height={altura - y(gastoDe(m))} rx="2" className="col-gasto" />
              <text x={x + 14.5} y={altura + 16} textAnchor="middle" className="eixo">{m.rotulo}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- Parcelas dos próximos meses: colunas empilhadas ----------
// meses: [{ iso, rotulo, minha, terceiros, receita }]
export function ColunasParcelas({ meses }) {
  const larguraMes = 52
  const altura = 170
  const topo = 10
  const margemEsq = 38
  const largura = margemEsq + meses.length * larguraMes
  const max = maximoBonito(Math.max(...meses.flatMap((m) => [m.minha + m.terceiros, m.receita]), 1))
  const y = (v) => altura - (v / max) * (altura - topo)

  return (
    <div className="grafico-rolagem">
      <svg
        viewBox={`0 0 ${largura} ${altura + 40}`}
        style={{ minWidth: largura }}
        role="img"
        aria-label="Parcelas de cartão já comprometidas em cada mês, divididas entre a sua parte e a das outras pessoas"
      >
        <Eixo max={max} altura={altura} topo={topo} margemEsq={margemEsq} largura={largura} />
        {meses.map((m, i) => {
          const x = margemEsq + i * larguraMes + 11
          const total = m.minha + m.terceiros
          const pct = m.receita > 0 ? Math.round((m.minha / m.receita) * 100) : null
          return (
            <g key={m.iso}>
              <rect x={x} y={y(m.minha)} width="28" height={altura - y(m.minha)} className="col-minha" />
              <rect x={x} y={y(total)} width="28" height={y(m.minha) - y(total)} className="col-terceiros" />
              {m.receita > 0 && (
                <line x1={x - 5} x2={x + 33} y1={y(m.receita)} y2={y(m.receita)} className="marca-receita" />
              )}
              <text x={x + 14} y={altura + 16} textAnchor="middle" className="eixo">{m.rotulo}</text>
              <text x={x + 14} y={altura + 31} textAnchor="middle" className="eixo-pct">
                {pct === null ? '–' : `${pct}%`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function Legenda({ itens }) {
  return (
    <div className="legenda">
      {itens.map((i) => (
        <span key={i.rotulo} className="legenda-item">
          <i className={`ponto ${i.classe ?? ''}`} style={i.cor ? { background: i.cor } : undefined} aria-hidden="true" />
          {i.rotulo}
        </span>
      ))}
    </div>
  )
}
