import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, ChevronRight, Plus } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import EstadoVazio from '../components/EstadoVazio'
import { centavosParaReais } from '../utils/dinheiro'
import { mesAtual, mesParaISO, rotuloMes } from '../utils/meses'
import '../faturas.css'
import '../resumo.css'

function acumular(mapa, chave, rotulo, valor, minha, id = null) {
  const atual = mapa.get(chave) ?? { rotulo, id, total: 0, meu: 0 }
  atual.total += valor
  if (minha) atual.meu += valor
  mapa.set(chave, atual)
}

const lista = (mapa) => [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo))
const somar = (itens, campo) => itens.reduce((total, item) => total + item[campo], 0)

export default function Resumo() {
  const [mes, setMes] = useState(mesAtual())
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const carregar = useCallback(async () => {
    const mesISO = mesParaISO(mes)
    const [p, e, f] = await Promise.all([
      supabase
        .from('lancamento_participacoes')
        .select(
          'valor_centavos, pago, pessoas(eh_eu), lancamentos!inner(id, mes_referencia, despesas(descricao, tipo, cartao_id, cartoes(nome)))'
        )
        .eq('lancamentos.mes_referencia', mesISO),
      supabase
        .from('fatura_encargos')
        .select('valor_centavos, faturas!inner(mes_referencia)')
        .eq('faturas.mes_referencia', mesISO),
      supabase
        .from('lancamentos')
        .select('valor_centavos, despesas!inner(tipo)')
        .eq('despesas.tipo', 'cartao')
        .gt('mes_referencia', mesISO),
    ])

    if (p.error || e.error || f.error) {
      setErro('Não foi possível carregar o resumo.')
      setCarregando(false)
      return
    }
    setErro('')

    const fixos = new Map()
    const extras = new Map()
    const cartoes = new Map()
    let pendenteTerceiros = 0

    for (const x of p.data) {
      const lanc = x.lancamentos
      const desp = lanc.despesas
      const minha = !!x.pessoas?.eh_eu
      if (!minha && !x.pago) pendenteTerceiros += x.valor_centavos

      if (desp.tipo === 'fixo') {
        acumular(fixos, lanc.id, desp.descricao, x.valor_centavos, minha, lanc.id)
      } else if (desp.tipo === 'extra') {
        acumular(extras, lanc.id, desp.descricao, x.valor_centavos, minha, lanc.id)
      } else {
        acumular(cartoes, desp.cartao_id, desp.cartoes?.nome ?? 'Cartão', x.valor_centavos, minha, desp.cartao_id)
      }
    }

    setDados({
      fixos: lista(fixos),
      extras: lista(extras),
      cartoes: lista(cartoes),
      pendenteTerceiros,
      encargos: somar(e.data, 'valor_centavos'),
      parcelado: somar(f.data, 'valor_centavos'),
    })
    setCarregando(false)
  }, [mes])

  useEffect(() => {
    carregar()
  }, [carregar])

  if (carregando) return <p className="suave">Carregando…</p>

  const meuFixos = dados ? somar(dados.fixos, 'meu') : 0
  const meuCartoes = dados ? somar(dados.cartoes, 'meu') : 0
  const meuExtras = dados ? somar(dados.extras, 'meu') : 0
  const totalCartoes = dados ? somar(dados.cartoes, 'total') : 0
  const gastoReal = meuFixos + meuCartoes + meuExtras
  const vazio = dados && !dados.fixos.length && !dados.extras.length && !dados.cartoes.length
  const atual = mesAtual()
  const ehMesAtual = atual.ano === mes.ano && atual.mes === mes.mes

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Resumo</h1>
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}

      {dados && (
        <>
          <div className="hero">
            <div className="rotulo">Gasto real do mês</div>
            <div className="grande">{centavosParaReais(gastoReal)}</div>
            <div className="rotulo">Gastos fixos + minha parte nas faturas + extras</div>
          </div>

          {vazio && (
            <>
              <EstadoVazio
                Icone={CalendarDays}
                titulo={`Nada lançado em ${rotuloMes(mes)}`}
                texto="Lance uma despesa, importe a fatura de um cartão ou cadastre seus gastos fixos para ver o resumo deste mês."
              >
                <Link className="botao-primario" to="/lancar">
                  <Plus size={18} aria-hidden="true" /> Lançar despesa
                </Link>
                <Link className="botao-secundario" to="/lancar?tipo=fixo">Novo gasto fixo</Link>
                <Link className="botao-secundario" to="/importar">Importar da planilha</Link>
                {!ehMesAtual && (
                  <button className="botao-secundario" onClick={() => setMes(mesAtual())}>
                    Voltar para o mês atual
                  </button>
                )}
              </EstadoVazio>
              {dados.parcelado > 0 && (
                <p className="dica" style={{ marginBottom: 16, textAlign: 'center' }}>
                  Há {centavosParaReais(dados.parcelado)} em parcelas nos meses seguintes.
                </p>
              )}
            </>
          )}

          {!vazio && (
            <>

          <div className="metricas">
            <div className="metrica">
              <div className="rotulo">Gastos fixos</div>
              <div className="numero">{centavosParaReais(meuFixos)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Minha parte nas faturas</div>
              <div className="numero">{centavosParaReais(meuCartoes)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Extras</div>
              <div className="numero">{centavosParaReais(meuExtras)}</div>
            </div>
          </div>

          <div className="metricas">
            <div className="metrica">
              <div className="rotulo">Vou pagar de cartão</div>
              <div className="numero">{centavosParaReais(totalCartoes + dados.encargos)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Terceiros ainda me devem</div>
              <div className="numero">{centavosParaReais(dados.pendenteTerceiros)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Encargos (juros e taxas)</div>
              <div className="numero">{centavosParaReais(dados.encargos)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Parcelado nos meses seguintes</div>
              <div className="numero">{centavosParaReais(dados.parcelado)}</div>
            </div>
          </div>

          <div className="bloco secao-resumo">
            <div className="cabecalho-secao">
              <b>Gastos fixos</b>
              <Link className="link-acao" to="/fixos">Ver todos <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
            {dados.fixos.length === 0 ? (
              <p className="suave" style={{ margin: 0 }}>Nenhum gasto fixo neste mês.</p>
            ) : (
              <ul className="lista">
                {dados.fixos.map((i) => (
                  <li key={i.id} className="linha">
                    <span>{i.rotulo}</span>
                    <span>{centavosParaReais(i.meu)}</span>
                  </li>
                ))}
                <li className="linha total-linha">
                  <span>Total</span>
                  <span>{centavosParaReais(meuFixos)}</span>
                </li>
              </ul>
            )}
          </div>

          <div className="bloco secao-resumo">
            <div className="cabecalho-secao">
              <b>Faturas dos cartões</b>
              <Link className="link-acao" to="/cartoes">Ver cartões <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
            {dados.cartoes.length === 0 ? (
              <p className="suave" style={{ margin: 0 }}>Nenhuma fatura neste mês.</p>
            ) : (
              <ul className="lista">
                {dados.cartoes.map((c) => (
                  <li key={c.id} className="linha">
                    <Link className="item-link" to={`/cartoes/${c.id}?mes=${mesParaISO(mes)}`}>
                      <div className="item-texto">
                        <div className="titulo">{c.rotulo}</div>
                        <div className="detalhe">Fatura {centavosParaReais(c.total)}</div>
                      </div>
                      <span>{centavosParaReais(c.meu)}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
                <li className="linha total-linha">
                  <span>Minha parte</span>
                  <span>{centavosParaReais(meuCartoes)}</span>
                </li>
              </ul>
            )}
          </div>

          <div className="bloco secao-resumo">
            <div className="cabecalho-secao">
              <b>Extras</b>
              <Link className="link-acao" to="/extras">Ver todos <ChevronRight size={16} aria-hidden="true" /></Link>
            </div>
            {dados.extras.length === 0 ? (
              <p className="suave" style={{ margin: 0 }}>Nenhum extra neste mês.</p>
            ) : (
              <ul className="lista">
                {dados.extras.map((i) => (
                  <li key={i.id} className="linha">
                    <span>{i.rotulo}</span>
                    <span>{centavosParaReais(i.meu)}</span>
                  </li>
                ))}
                <li className="linha total-linha">
                  <span>Total</span>
                  <span>{centavosParaReais(meuExtras)}</span>
                </li>
              </ul>
            )}
          </div>
            </>
          )}
        </>
      )}
    </section>
  )
}
