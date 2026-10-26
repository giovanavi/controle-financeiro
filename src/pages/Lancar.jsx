import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { calcularDivisao } from '../utils/divisao'
import { mesDaFatura, nomeDoMes } from '../utils/faturas'
import '../lancar.css'

const TIPOS = [
  { valor: 'cartao', rotulo: 'Compra no cartão' },
  { valor: 'fixo', rotulo: 'Gasto fixo' },
  { valor: 'extra', rotulo: 'Extra' },
]

const MODOS = [
  { valor: 'igual', rotulo: 'Igual' },
  { valor: 'valor', rotulo: 'Por valor' },
  { valor: 'percentual', rotulo: 'Por %' },
]

const hoje = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD no fuso local

export default function Lancar() {
  const [params] = useSearchParams() // /lancar?tipo=fixo ou ?tipo=extra ou ?editar=<id da despesa>
  const editarId = params.get('editar')
  const navigate = useNavigate()
  const tipoInicial = ['fixo', 'extra'].includes(params.get('tipo')) ? params.get('tipo') : 'cartao'
  const [pessoas, setPessoas] = useState([])
  const [cartoes, setCartoes] = useState([])
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [salvando, setSalvando] = useState(false)

  const [tipo, setTipo] = useState(tipoInicial)
  const [descricao, setDescricao] = useState('')
  const [data, setData] = useState(hoje())
  const [valor, setValor] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [cartaoId, setCartaoId] = useState('')
  const [parcelas, setParcelas] = useState('1')
  const [recorrente, setRecorrente] = useState(tipoInicial === 'fixo')
  const [fim, setFim] = useState('')
  const [observacao, setObservacao] = useState('')

  const [modo, setModo] = useState('igual')
  const [selecionados, setSelecionados] = useState({})
  const [valores, setValores] = useState({})
  const [percentuais, setPercentuais] = useState({})

  useEffect(() => {
    async function carregar() {
      const [p, c, k] = await Promise.all([
        // ao editar, traz também pessoas inativas (podem estar na divisão)
        editarId
          ? supabase.from('pessoas').select('*')
          : supabase.from('pessoas').select('*').eq('ativa', true),
        supabase.from('cartoes').select('*').eq('ativo', true).order('nome'),
        supabase.from('categorias').select('*').order('nome'),
      ])
      if (p.error || c.error || k.error) {
        setErro('Não foi possível carregar os cadastros.')
        setCarregando(false)
        return
      }
      // "Eu" primeiro, depois ordem alfabética
      const ordenadas = [...p.data].sort(
        (a, b) => Number(b.eh_eu) - Number(a.eh_eu) || a.nome.localeCompare(b.nome)
      )
      setPessoas(ordenadas)
      setCartoes(c.data)
      setCategorias(k.data)
      const eu = ordenadas.find((x) => x.eh_eu)
      if (eu) setSelecionados({ [eu.id]: true })
      if (c.data.length === 1) setCartaoId(c.data[0].id)
      if (editarId) {
        const { data: d, error: e } = await supabase
          .from('despesas')
          .select('*, despesa_participacoes(pessoa_id, valor_centavos)')
          .eq('id', editarId)
          .single()
        if (e) {
          setErro('Não foi possível carregar a despesa para edição.')
        } else {
          setTipo(d.tipo)
          setDescricao(d.descricao)
          setData(d.data)
          setValor(centavosParaCampo(d.valor_total_centavos))
          setCategoriaId(d.categoria_id ?? '')
          setCartaoId(d.cartao_id ?? '')
          setParcelas(String(d.total_parcelas))
          setRecorrente(d.recorrente)
          setFim(d.recorrencia_fim ?? '')
          setObservacao(d.observacao ?? '')
          setModo('valor')
          const marcados = {}
          const preenchidos = {}
          d.despesa_participacoes.forEach((x) => {
            marcados[x.pessoa_id] = true
            preenchidos[x.pessoa_id] = centavosParaCampo(x.valor_centavos)
          })
          setSelecionados(marcados)
          setValores(preenchidos)
        }
      }
      setCarregando(false)
    }
    carregar()
  }, [])

  // ----- valores calculados a cada digitação -----
  const totalCentavos = reaisParaCentavos(valor)
  const ids = pessoas.filter((p) => selecionados[p.id]).map((p) => p.id)
  const divisao = calcularDivisao({ modo, total: totalCentavos, ids, valores, percentuais })
  const cartao = cartoes.find((c) => c.id === cartaoId)
  const nParcelas = Number(parcelas)

  let previaFatura = ''
  if (tipo === 'cartao' && cartao && data) {
    previaFatura = nomeDoMes(mesDaFatura(data, cartao.dia_fechamento, cartao.dia_vencimento))
  }

  function mudarTipo(novoTipo) {
    setTipo(novoTipo)
    if (novoTipo !== 'fixo') {
      setRecorrente(false)
      setFim('')
    }
    if (novoTipo !== 'cartao') setParcelas('1')
  }

  function alternarPessoa(id) {
    setSelecionados({ ...selecionados, [id]: !selecionados[id] })
  }

  async function lancar(evento) {
    evento.preventDefault()
    setErro('')
    setSucesso('')

    if (!descricao.trim()) return setErro('Informe a descrição.')
    if (!totalCentavos || totalCentavos <= 0) return setErro('Informe um valor total maior que zero.')
    if (!data) return setErro('Informe a data.')
    if (tipo === 'cartao') {
      if (!cartaoId) return setErro('Escolha o cartão.')
      if (!Number.isInteger(nParcelas) || nParcelas < 1 || nParcelas > 60) {
        return setErro('Parcelas: informe um número de 1 a 60.')
      }
    }
    if (recorrente && fim && fim < data) {
      return setErro('O fim da recorrência é anterior à data inicial.')
    }
    if (!divisao.ok) return setErro(divisao.aviso || 'Confira a divisão entre as pessoas.')

    // pessoas com valor zero não entram na divisão
    const participacoes = divisao.partes.filter((p) => p.valor_centavos > 0)

    setSalvando(true)
    const { error } = await supabase.rpc(editarId ? 'editar_despesa' : 'criar_despesa', {
      ...(editarId ? { p_despesa_id: editarId } : {}),
      p_descricao: descricao.trim(),
      p_tipo: tipo,
      p_data: data,
      p_valor_total_centavos: totalCentavos,
      p_participacoes: participacoes,
      p_categoria_id: categoriaId || null,
      p_cartao_id: tipo === 'cartao' ? cartaoId : null,
      p_total_parcelas: tipo === 'cartao' ? nParcelas : 1,
      p_recorrente: recorrente,
      p_recorrencia_inicio: recorrente ? data : null,
      p_recorrencia_fim: recorrente && fim ? fim : null,
      p_observacao: observacao.trim() || null,
    })
    setSalvando(false)

    if (error) {
      // erros "raise exception" da função do banco já vêm com a mensagem explicativa
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível lançar. Tente de novo.')
      return
    }

    if (editarId) {
      navigate(tipo === 'cartao' ? `/cartoes/${cartaoId}` : tipo === 'fixo' ? '/fixos' : '/extras')
      return
    }
    setSucesso(`Despesa "${descricao.trim()}" lançada.`)
    setDescricao('')
    setValor('')
    setParcelas('1')
    setRecorrente(false)
    setFim('')
    setObservacao('')
    setValores({})
    setPercentuais({})
    setModo('igual')
    const eu = pessoas.find((p) => p.eh_eu)
    setSelecionados(eu ? { [eu.id]: true } : {})
    window.scrollTo(0, 0)
  }

  if (carregando) return <p className="suave">Carregando…</p>

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>{editarId ? 'Editar despesa' : 'Lançar despesa'}</h1>
      </div>

      {sucesso && <p className="sucesso" role="status">{sucesso}</p>}
      {editarId && (
        <p className="aviso" style={{ marginBottom: 12 }}>
          Ao salvar, as parcelas ou os meses desta despesa são recriados. Não dá para editar se
          houver pagamentos marcados: desmarque antes. Ajustes de valor feitos em meses
          específicos de um gasto fixo serão perdidos.
        </p>
      )}
      {erro && <p className="erro" role="alert">{erro}</p>}

      {pessoas.length === 0 && (
        <p className="aviso">
          Cadastre ao menos uma pessoa antes de lançar. <Link to="/pessoas">Ir para Pessoas</Link>
        </p>
      )}
      {tipo === 'cartao' && cartoes.length === 0 && (
        <p className="aviso">
          Cadastre um cartão para lançar compras nele. <Link to="/cartoes">Ir para Cartões</Link>
        </p>
      )}

      <form onSubmit={lancar}>
        <div className="bloco formulario">
          <div className="segmentos" role="group" aria-label="Tipo de despesa">
            {TIPOS.map((t) => (
              <button
                key={t.valor}
                type="button"
                className={tipo === t.valor ? 'ativo' : ''}
                onClick={() => mudarTipo(t.valor)}
              >
                {t.rotulo}
              </button>
            ))}
          </div>

          <label className="campo">
            Descrição
            <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </label>

          <div className="duas-colunas">
            <label className="campo">
              Valor total (R$)
              <input
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </label>
            <label className="campo">
              Data
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </label>
          </div>

          <label className="campo">
            Categoria (opcional)
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">Sem categoria</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>

          {tipo === 'cartao' && (
            <>
              <div className="duas-colunas">
                <label className="campo">
                  Cartão
                  <select value={cartaoId} onChange={(e) => setCartaoId(e.target.value)}>
                    <option value="">Escolha…</option>
                    {cartoes.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  Parcelas
                  <input
                    value={parcelas}
                    onChange={(e) => setParcelas(e.target.value)}
                    inputMode="numeric"
                  />
                </label>
              </div>
              {previaFatura && (
                <p className="dica">
                  A 1ª parcela cai na fatura de {previaFatura}.
                  {nParcelas > 1 && totalCentavos > 0 &&
                    ` Cerca de ${centavosParaReais(Math.floor(totalCentavos / nParcelas))} por parcela.`}
                </p>
              )}
            </>
          )}

          {tipo === 'fixo' && (
            <>
              <label className="check">
                <input
                  type="checkbox"
                  checked={recorrente}
                  onChange={(e) => setRecorrente(e.target.checked)}
                />
                Repetir todo mês, a partir da data
              </label>
              {recorrente && (
                <label className="campo">
                  Repetir até (opcional)
                  <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
                </label>
              )}
              {recorrente && !fim && (
                <p className="dica">Sem data final, o sistema gera os próximos 12 meses.</p>
              )}
            </>
          )}

          <label className="campo">
            Observação (opcional)
            <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </label>
        </div>

        <div className="bloco">
          <div className="cabecalho-secao">
            <b>Divisão</b>
            <div className="segmentos pequeno" role="group" aria-label="Forma de dividir">
              {MODOS.map((m) => (
                <button
                  key={m.valor}
                  type="button"
                  className={modo === m.valor ? 'ativo' : ''}
                  onClick={() => setModo(m.valor)}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
          </div>

          <ul className="lista">
            {pessoas.map((p) => {
              const marcada = !!selecionados[p.id]
              const parte = divisao.partes.find((x) => x.pessoa_id === p.id)
              return (
                <li key={p.id} className="linha">
                  <label className="check">
                    <input type="checkbox" checked={marcada} onChange={() => alternarPessoa(p.id)} />
                    <span>
                      {p.nome}
                      {p.eh_eu && <span className="chip">Você</span>}
                    </span>
                  </label>

                  {marcada && modo === 'valor' && (
                    <input
                      className="mini"
                      inputMode="decimal"
                      placeholder="0,00"
                      aria-label={`Valor de ${p.nome}`}
                      value={valores[p.id] ?? ''}
                      onChange={(e) => setValores({ ...valores, [p.id]: e.target.value })}
                    />
                  )}

                  {marcada && modo === 'percentual' && (
                    <div className="par">
                      <input
                        className="mini"
                        inputMode="decimal"
                        placeholder="0"
                        aria-label={`Porcentagem de ${p.nome}`}
                        value={percentuais[p.id] ?? ''}
                        onChange={(e) => setPercentuais({ ...percentuais, [p.id]: e.target.value })}
                      />
                      <span>%</span>
                      <span className="valor-calculado">
                        {parte && totalCentavos > 0 ? centavosParaReais(parte.valor_centavos) : ''}
                      </span>
                    </div>
                  )}

                  {marcada && modo === 'igual' && (
                    <span className="detalhe">
                      {parte && totalCentavos > 0 ? centavosParaReais(parte.valor_centavos) : ''}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>

          {!divisao.ok && divisao.aviso && totalCentavos > 0 && <p className="aviso">{divisao.aviso}</p>}
          {divisao.ok && modo !== 'igual' && <p className="confere">A divisão confere com o total.</p>}
        </div>

        <button
          className="botao-primario"
          type="submit"
          disabled={salvando || pessoas.length === 0}
          style={{ width: '100%' }}
        >
          {salvando ? 'Salvando…' : editarId ? 'Salvar alterações' : 'Lançar despesa'}
        </button>
      </form>
    </section>
  )
}
