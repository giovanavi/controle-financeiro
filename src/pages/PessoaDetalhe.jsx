import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import { centavosParaReais } from '../utils/dinheiro'
import { mesAtual, mesDeISO, mesParaISO, rotuloMes } from '../utils/meses'
import { definirPago, definirPagoVarios, salvarObservacaoPagamento } from '../utils/pagamento'
import '../faturas.css'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

const FILTROS = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'pendentes', rotulo: 'Pendentes' },
  { valor: 'pagos', rotulo: 'Pagos' },
]

const SELECAO =
  'id, valor_centavos, pago, pago_em, observacao, lancamentos!inner(mes_referencia, numero_parcela, total_parcelas, despesas(descricao, tipo, cartoes(nome)))'

function origem(item) {
  const despesa = item.lancamentos?.despesas
  if (despesa?.tipo === 'cartao') return despesa.cartoes?.nome ?? 'Cartão'
  if (despesa?.tipo === 'fixo') return 'Gasto fixo'
  return 'Extra'
}

export default function PessoaDetalhe() {
  const { id } = useParams()
  const [mes, setMes] = useState(mesAtual())
  const [escopo, setEscopo] = useState('mes') // 'mes' ou 'pendencias' (todos os meses)
  const [filtro, setFiltro] = useState('todos')
  const [pessoa, setPessoa] = useState(null)
  const [itens, setItens] = useState([])
  const [pendenteGeral, setPendenteGeral] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    let consulta = supabase.from('lancamento_participacoes').select(SELECAO).eq('pessoa_id', id)
    consulta =
      escopo === 'mes'
        ? consulta.eq('lancamentos.mes_referencia', mesParaISO(mes))
        : consulta.eq('pago', false)

    const [p, i, g] = await Promise.all([
      supabase.from('pessoas').select('*').eq('id', id).single(),
      consulta,
      supabase.from('lancamento_participacoes').select('valor_centavos').eq('pessoa_id', id).eq('pago', false),
    ])

    if (p.error || i.error || g.error) {
      setErro('Não foi possível carregar os dados desta pessoa.')
      setCarregando(false)
      return
    }
    setErro('')
    setPessoa(p.data)
    setPendenteGeral(soma(g.data, (x) => x.valor_centavos))
    setItens(
      [...i.data].sort(
        (a, b) =>
          a.lancamentos.mes_referencia.localeCompare(b.lancamentos.mes_referencia) ||
          (a.lancamentos.despesas?.descricao ?? '').localeCompare(b.lancamentos.despesas?.descricao ?? '')
      )
    )
    setCarregando(false)
  }, [id, mes, escopo])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarPago(item) {
    setErro('')
    const { error } = await definirPago(item.id, !item.pago)
    if (error) setErro('Não foi possível atualizar o pagamento.')
    await carregar()
  }

  async function editarObservacao(item) {
    const texto = window.prompt('Observação (ex.: pagou por Pix)', item.observacao ?? '')
    if (texto === null) return
    setErro('')
    const { error } = await salvarObservacaoPagamento(item.id, texto)
    if (error) setErro('Não foi possível salvar a observação.')
    await carregar()
  }

  async function pagarTodosDoMes() {
    const pendentes = itens.filter((x) => !x.pago).map((x) => x.id)
    if (pendentes.length === 0) return
    const confirmou = window.confirm(
      `Marcar ${pendentes.length} item(ns) de ${rotuloMes(mes)} como pagos?`
    )
    if (!confirmou) return
    setErro('')
    const { error } = await definirPagoVarios(pendentes, true)
    if (error) setErro('Não foi possível marcar os itens como pagos.')
    await carregar()
  }

  if (carregando) return <p className="suave">Carregando…</p>
  if (!pessoa) {
    return (
      <section>
        <Link className="voltar" to="/pessoas">
          <ArrowLeft size={16} aria-hidden="true" /> Pessoas
        </Link>
        {erro && <p className="erro" role="alert">{erro}</p>}
      </section>
    )
  }

  const ehEu = pessoa.eh_eu
  const atribuido = soma(itens, (x) => x.valor_centavos)
  const pago = soma(itens.filter((x) => x.pago), (x) => x.valor_centavos)
  const pendente = atribuido - pago

  const visiveis =
    escopo === 'pendencias' || filtro === 'todos'
      ? itens
      : itens.filter((x) => (filtro === 'pagos' ? x.pago : !x.pago))

  return (
    <section>
      <Link className="voltar" to="/pessoas">
        <ArrowLeft size={16} aria-hidden="true" /> Pessoas
      </Link>
      <div className="cabecalho-pagina">
        <h1>
          {pessoa.nome}
          {ehEu && <span className="chip">Você</span>}
        </h1>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      {!ehEu && (
        <div className="metrica" style={{ marginBottom: 16 }}>
          <div className="rotulo">Total pendente, em todos os meses</div>
          <div className="numero">{centavosParaReais(pendenteGeral)}</div>
        </div>
      )}

      {!ehEu && (
        <div className="segmentos" role="group" aria-label="Período" style={{ marginBottom: 16 }}>
          <button className={escopo === 'mes' ? 'ativo' : ''} onClick={() => setEscopo('mes')}>
            Por mês
          </button>
          <button className={escopo === 'pendencias' ? 'ativo' : ''} onClick={() => setEscopo('pendencias')}>
            Todas as pendências
          </button>
        </div>
      )}

      {escopo === 'mes' && <SeletorMes mes={mes} aoMudar={setMes} />}

      <div className="metricas">
        <div className="metrica">
          <div className="rotulo">{escopo === 'mes' ? 'Atribuído no mês' : 'Pendente listado'}</div>
          <div className="numero">{centavosParaReais(atribuido)}</div>
        </div>
        {!ehEu && escopo === 'mes' && (
          <>
            <div className="metrica">
              <div className="rotulo">Pago</div>
              <div className="numero">{centavosParaReais(pago)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Pendente</div>
              <div className="numero">{centavosParaReais(pendente)}</div>
            </div>
          </>
        )}
      </div>

      {!ehEu && escopo === 'mes' && (
        <div className="faixa-filtros">
          <div className="segmentos pequeno" role="group" aria-label="Filtrar por status">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                className={filtro === f.valor ? 'ativo' : ''}
                onClick={() => setFiltro(f.valor)}
              >
                {f.rotulo}
              </button>
            ))}
          </div>
          {pendente > 0 && (
            <button className="botao-secundario" onClick={pagarTodosDoMes}>
              Marcar todos como pagos
            </button>
          )}
        </div>
      )}

      <div className="bloco">
        {visiveis.length === 0 ? (
          <p className="suave" style={{ margin: 0 }}>Nada para mostrar aqui.</p>
        ) : (
          <ul className="lista">
            {visiveis.map((item) => {
              const lanc = item.lancamentos
              const parcela =
                lanc.total_parcelas > 1
                  ? ` · ${String(lanc.numero_parcela).padStart(2, '0')}/${String(lanc.total_parcelas).padStart(2, '0')}`
                  : ''
              return (
                <li key={item.id} className="item-lanc">
                  <div className="topo">
                    <div>
                      <div className="titulo">
                        {lanc.despesas?.descricao}
                        {parcela}
                      </div>
                      <div className="detalhe">
                        {origem(item)}
                        {escopo === 'pendencias' && ` · ${rotuloMes(mesDeISO(lanc.mes_referencia))}`}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="titulo">{centavosParaReais(item.valor_centavos)}</div>
                      {!ehEu && (
                        <button
                          className={item.pago ? 'chip-btn pago' : 'chip-btn pend'}
                          aria-pressed={item.pago}
                          onClick={() => alternarPago(item)}
                        >
                          {item.pago ? 'Pago' : 'Pendente'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="sub" style={{ marginTop: 4 }}>
                    <button className="link-btn" onClick={() => editarObservacao(item)}>
                      {item.observacao ? 'editar obs.' : 'obs.'}
                    </button>
                    {item.observacao && <span className="obs">{item.observacao}</span>}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
