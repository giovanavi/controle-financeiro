import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { mesAtual, mesParaISO, rotuloMes } from '../utils/meses'
import { definirPago } from '../utils/pagamento'
import '../faturas.css'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// Usada para "Gastos fixos" (tipo="fixo") e "Extras" (tipo="extra")
export default function GastosPorTipo({ tipo, titulo }) {
  const [mes, setMes] = useState(mesAtual())
  const [itens, setItens] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const { data, error } = await supabase
      .from('lancamentos')
      .select(
        'id, valor_centavos, despesas!inner(id, descricao, tipo, recorrente), lancamento_participacoes(id, valor_centavos, pago, pessoas(nome, eh_eu))'
      )
      .eq('mes_referencia', mesParaISO(mes))
      .eq('despesas.tipo', tipo)

    if (error) {
      setErro('Não foi possível carregar os lançamentos.')
    } else {
      setErro('')
      setItens([...data].sort((a, b) => a.despesas.descricao.localeCompare(b.despesas.descricao)))
    }
    setCarregando(false)
  }, [mes, tipo])

  useEffect(() => {
    carregar()
  }, [carregar])

  async function alternarPago(parte) {
    setErro('')
    const { error } = await definirPago(parte.id, !parte.pago)
    if (error) setErro('Não foi possível atualizar o pagamento.')
    await carregar()
  }

  async function ajustarValor(item) {
    const texto = window.prompt(
      `Novo valor total de "${item.despesas.descricao}" em ${rotuloMes(mes)} (R$)`,
      centavosParaCampo(item.valor_centavos)
    )
    if (texto === null) return
    const novo = reaisParaCentavos(texto)
    if (!novo || novo <= 0) return setErro('Informe um valor maior que zero, por exemplo 310,00.')
    setErro('')
    const { error } = await supabase.rpc('ajustar_valor_lancamento', {
      p_lancamento_id: item.id,
      p_novo_total_centavos: novo,
    })
    if (error) {
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível ajustar o valor.')
      return
    }
    await carregar()
  }

  async function excluir(item) {
    const recorrente = item.despesas.recorrente
    const mensagem = recorrente
      ? `Excluir "${item.despesas.descricao}" só em ${rotuloMes(mes)}? Os outros meses continuam.`
      : `Excluir "${item.despesas.descricao}"?`
    if (!window.confirm(mensagem)) return
    setErro('')
    // gasto não recorrente: apaga a despesa inteira; recorrente: apaga só a ocorrência do mês
    const { error } = recorrente
      ? await supabase.from('lancamentos').delete().eq('id', item.id)
      : await supabase.from('despesas').delete().eq('id', item.despesas.id)
    if (error) setErro('Não foi possível excluir.')
    await carregar()
  }

  if (carregando) return <p className="suave">Carregando…</p>

  const meuTotal = soma(itens, (i) =>
    soma(i.lancamento_participacoes.filter((p) => p.pessoas?.eh_eu), (p) => p.valor_centavos)
  )

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>{titulo}</h1>
        <Link className="botao-primario pequeno" to={`/lancar?tipo=${tipo}`} style={{ textDecoration: 'none' }}>
          {tipo === 'fixo' ? 'Novo gasto fixo' : 'Novo extra'}
        </Link>
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}

      <div className="metrica" style={{ marginBottom: 16 }}>
        <div className="rotulo">Minha parte no mês</div>
        <div className="numero">{centavosParaReais(meuTotal)}</div>
      </div>

      <div className="bloco">
        {itens.length === 0 ? (
          <p className="suave" style={{ margin: 0 }}>Nada lançado neste mês.</p>
        ) : (
          <ul className="lista">
            {itens.map((item) => {
              const partes = item.lancamento_participacoes
              const minha = soma(partes.filter((p) => p.pessoas?.eh_eu), (p) => p.valor_centavos)
              const dividida = partes.length > 1 || !partes[0]?.pessoas?.eh_eu
              return (
                <li key={item.id} className="item-lanc">
                  <div className="topo">
                    <div>
                      <div className="titulo">
                        {item.despesas.descricao}
                        {item.despesas.recorrente && <span className="chip">Recorrente</span>}
                      </div>
                      {dividida && (
                        <div className="detalhe">Total {centavosParaReais(item.valor_centavos)}</div>
                      )}
                    </div>
                    <div className="titulo">{centavosParaReais(minha)}</div>
                  </div>

                  {dividida && (
                    <ul className="sub-lista">
                      {partes.map((p) => (
                        <li key={p.id} className="sub">
                          <span>
                            {p.pessoas?.nome}
                            {p.pessoas?.eh_eu && <span className="chip">Você</span>}
                          </span>
                          <span className="valor">{centavosParaReais(p.valor_centavos)}</span>
                          {!p.pessoas?.eh_eu && (
                            <button
                              className={p.pago ? 'chip-btn pago' : 'chip-btn pend'}
                              aria-pressed={p.pago}
                              onClick={() => alternarPago(p)}
                            >
                              {p.pago ? 'Pago' : 'Pendente'}
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="acoes" style={{ marginTop: 8 }}>
                    <Link className="botao-secundario" to={`/lancar?editar=${item.despesas.id}`}>
                      Editar
                    </Link>
                    <button className="botao-secundario" onClick={() => ajustarValor(item)}>
                      Ajustar valor deste mês
                    </button>
                    <button className="botao-secundario perigo" onClick={() => excluir(item)}>
                      Excluir
                    </button>
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
