import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MenuAcoes from '../components/MenuAcoes'
import { useDialogo } from '../components/Dialogo'
import SeletorMes from '../components/SeletorMes'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { mesAtual, mesParaISO, rotuloMes } from '../utils/meses'
import { definirPago } from '../utils/pagamento'
import '../faturas.css'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

// Usada para "Gastos fixos" (tipo="fixo") e "Extras" (tipo="extra")
export default function GastosPorTipo({ tipo, titulo }) {
  const { confirmar, perguntar } = useDialogo()
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
    const texto = await perguntar({
      titulo: 'Ajustar valor deste mês',
      mensagem: `${item.despesas.descricao} em ${rotuloMes(mes)}. A divisão entre as pessoas mantém a mesma proporção, e os outros meses não mudam.`,
      rotulo: 'Novo valor total (R$)',
      valorInicial: centavosParaCampo(item.valor_centavos),
      inputMode: 'decimal',
      confirmar: 'Ajustar valor',
    })
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
    const confirmou = await confirmar({
      titulo: recorrente ? `Excluir só em ${rotuloMes(mes)}?` : 'Excluir este lançamento?',
      mensagem: recorrente
        ? 'Apenas este mês será removido. Os outros meses deste gasto fixo continuam.'
        : 'O lançamento e a divisão entre as pessoas serão removidos. Não dá para desfazer.',
      detalhes: [
        ['Lançamento', item.despesas.descricao],
        ['Valor', centavosParaReais(item.valor_centavos)],
        ['Mês', rotuloMes(mes)],
      ],
      confirmar: recorrente ? 'Excluir este mês' : 'Excluir',
      perigo: true,
    })
    if (!confirmou) return
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
                    <div className="valor-com-menu">
                      <span className="titulo">{centavosParaReais(minha)}</span>
                      <MenuAcoes
                        itens={[
                          { rotulo: 'Editar', Icone: Pencil, para: `/lancar?editar=${item.despesas.id}` },
                          { rotulo: 'Ajustar valor do mês', Icone: SlidersHorizontal, aoClicar: () => ajustarValor(item) },
                          {
                            rotulo: item.despesas.recorrente ? 'Excluir só este mês' : 'Excluir',
                            Icone: Trash2,
                            perigo: true,
                            aoClicar: () => excluir(item),
                          },
                        ]}
                      />
                    </div>
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
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
