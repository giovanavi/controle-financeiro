import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import EstadoVazio from '../components/EstadoVazio'
import {
  BarrasCategorias,
  COR_OUTRAS,
  COR_SEM_CATEGORIA,
  ColunasMeses,
  ColunasParcelas,
  Legenda,
  PALETA,
  RoscaCategorias,
} from '../components/Graficos'
import { centavosParaReais } from '../utils/dinheiro'
import { mesAtual, mesDeISO, rotuloMes } from '../utils/meses'
import { carregarAnalises, carregarParcelasFuturas } from '../utils/analises'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)
const MAXIMO_INDIVIDUAL = 10 // acima disso, o resto vira "Outras"

// Monta os itens do gráfico de categorias para o escopo escolhido
function prepararCategorias(dados, escopo) {
  const doMes = escopo === 'mes'
  const itens = dados.categorias
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      valor: doMes ? c.gastoMes : c.gastoJanela,
      limite: doMes ? c.limiteMes : c.limiteJanela,
    }))
    .filter((i) => i.valor > 0)

  const sem = doMes ? dados.semUltimo : dados.semJanela
  if (sem > 0) itens.push({ id: 'sem', nome: 'Sem categoria', valor: sem, limite: 0 })
  itens.sort((a, b) => b.valor - a.valor)

  const principais = itens.slice(0, MAXIMO_INDIVIDUAL)
  const resto = itens.slice(MAXIMO_INDIVIDUAL)
  if (resto.length > 0) {
    principais.push({ id: 'outras', nome: `Outras (${resto.length})`, valor: soma(resto, (i) => i.valor), limite: 0 })
  }

  let indiceCor = 0
  return principais.map((i) => ({
    ...i,
    cor: i.id === 'sem' ? COR_SEM_CATEGORIA : i.id === 'outras' ? COR_OUTRAS : PALETA[indiceCor++ % PALETA.length],
  }))
}

export default function Analises() {
  const [fim, setFim] = useState(mesAtual())
  const [quantidade, setQuantidade] = useState(6)
  const [forma, setForma] = useState('barras') // 'barras' ou 'rosca'
  const [escopo, setEscopo] = useState('janela') // 'janela' (período todo) ou 'mes' (só o último mês)
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const [futuros, setFuturos] = useState(6)
  const [parcelas, setParcelas] = useState(null)
  const [erroParcelas, setErroParcelas] = useState(false)

  useEffect(() => {
    let cancelado = false
    setCarregando(true)
    carregarAnalises(supabase, fim, quantidade).then((resultado) => {
      if (cancelado) return
      if (resultado.erro) setErro('Não foi possível carregar as análises.')
      else setErro('')
      setDados(resultado.erro ? null : resultado)
      setCarregando(false)
    })
    return () => {
      cancelado = true
    }
  }, [fim, quantidade])

  useEffect(() => {
    let cancelado = false
    carregarParcelasFuturas(supabase, futuros).then((resultado) => {
      if (cancelado) return
      setErroParcelas(!!resultado.erro)
      setParcelas(resultado.erro ? null : resultado)
    })
    return () => {
      cancelado = true
    }
  }, [futuros])

  const itensCategorias = useMemo(() => (dados ? prepararCategorias(dados, escopo) : []), [dados, escopo])
  const totalCategorias = soma(itensCategorias, (i) => i.valor)
  const totalParcelas = parcelas ? soma(parcelas.meses, (m) => m.minha + m.terceiros) : 0

  const temDados = dados && (soma(dados.meses, (m) => m.gasto + m.receita) > 0)
  const rotuloFim = rotuloMes(fim)

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Análises</h1>
      </div>

      <div className="bloco">
        <SeletorMes mes={fim} aoMudar={setFim} />
        <div className="segmentos" role="group" aria-label="Período" style={{ marginTop: 4 }}>
          {[3, 6, 12].map((n) => (
            <button key={n} className={quantidade === n ? 'ativo' : ''} onClick={() => setQuantidade(n)}>
              {n} meses
            </button>
          ))}
        </div>
        <p className="dica" style={{ marginTop: 8 }}>
          Os {quantidade} meses até {rotuloFim}. Os valores são só a sua parte, como no Resumo.
        </p>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {carregando && !dados ? (
        <p className="suave">Carregando…</p>
      ) : !temDados ? (
        <EstadoVazio
          Icone={Activity}
          titulo="Ainda não há dados neste período"
          texto="Lance despesas e cadastre receitas para ver os gráficos. Troque o mês ou o período acima para olhar outros meses."
        >
          <Link className="botao-primario" to="/lancar">Lançar despesa</Link>
          <Link className="botao-secundario" to="/receitas">Ver receitas</Link>
        </EstadoVazio>
      ) : (
        <>
          {/* ---------- 1. Gasto por categoria ---------- */}
          <div className="bloco">
            <div className="cabecalho-secao">
              <b>Gasto por categoria</b>
              <div className="segmentos pequeno" role="group" aria-label="Forma do gráfico">
                <button className={forma === 'barras' ? 'ativo' : ''} onClick={() => setForma('barras')}>
                  Barras
                </button>
                <button className={forma === 'rosca' ? 'ativo' : ''} onClick={() => setForma('rosca')}>
                  Rosca
                </button>
              </div>
            </div>
            <div className="segmentos pequeno" role="group" aria-label="Escopo" style={{ marginBottom: 12 }}>
              <button className={escopo === 'janela' ? 'ativo' : ''} onClick={() => setEscopo('janela')}>
                Período todo
              </button>
              <button className={escopo === 'mes' ? 'ativo' : ''} onClick={() => setEscopo('mes')}>
                Só {rotuloFim}
              </button>
            </div>

            {itensCategorias.length === 0 ? (
              <p className="suave" style={{ margin: 0 }}>Nenhum gasto neste escopo.</p>
            ) : forma === 'barras' ? (
              <BarrasCategorias
                itens={itensCategorias}
                total={totalCategorias}
                rotuloLimite={escopo === 'mes' ? 'Limite do mês' : 'Limite no período'}
              />
            ) : (
              <RoscaCategorias itens={itensCategorias} total={totalCategorias} />
            )}

            {forma === 'barras' && itensCategorias.some((i) => i.limite > 0) && (
              <p className="dica" style={{ marginTop: 12 }}>
                O traço escuro em cada barra marca o limite do orçamento da categoria.
              </p>
            )}
          </div>

          {/* ---------- 2. Receitas x gasto mês a mês ---------- */}
          <div className="bloco">
            <b>Receitas e gasto, mês a mês</b>
            <Legenda
              itens={[
                { rotulo: 'Receitas', classe: 'receita' },
                { rotulo: 'Gasto (com encargos)', classe: 'gasto' },
              ]}
            />
            <ColunasMeses meses={dados.meses} />

            <div className="tabela-rolagem" style={{ marginTop: 12 }}>
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th className="num">Receitas</th>
                    <th className="num">Gasto</th>
                    <th className="num">Sobra</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.meses.map((m) => {
                    const gasto = m.gasto + m.encargos
                    const sobra = m.receita - gasto
                    return (
                      <tr key={m.iso}>
                        <td>{rotuloMes(mesDeISO(m.iso))}</td>
                        <td className="num">{centavosParaReais(m.receita)}</td>
                        <td className="num">{centavosParaReais(gasto)}</td>
                        <td className={`num ${sobra >= 0 ? 'positivo' : 'negativo'}`}>{centavosParaReais(sobra)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ---------- 3. Parcelas dos próximos meses ---------- */}
      <div className="bloco">
        <div className="cabecalho-secao">
          <b>Parcelas dos próximos meses</b>
          <div className="segmentos pequeno" role="group" aria-label="Quantidade de meses">
            {[6, 12].map((n) => (
              <button key={n} className={futuros === n ? 'ativo' : ''} onClick={() => setFuturos(n)}>
                {n} meses
              </button>
            ))}
          </div>
        </div>

        {erroParcelas ? (
          <p className="erro">Não foi possível carregar as parcelas futuras.</p>
        ) : !parcelas ? (
          <p className="suave" style={{ margin: 0 }}>Carregando…</p>
        ) : totalParcelas === 0 ? (
          <p className="suave" style={{ margin: 0 }}>Nenhuma parcela de cartão nos próximos meses.</p>
        ) : (
          <>
            <Legenda
              itens={[
                { rotulo: 'Minha parte', classe: 'minha' },
                { rotulo: 'Outras pessoas', classe: 'terceiros' },
                { rotulo: 'Receita prevista', classe: 'marca' },
              ]}
            />
            <ColunasParcelas meses={parcelas.meses} />
            <p className="dica" style={{ marginTop: 8 }}>
              A porcentagem abaixo de cada mês é a sua parte nas parcelas comparada com a receita prevista
              daquele mês. Sem receita cadastrada no mês, aparece um traço.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
