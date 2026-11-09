import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarClock, Tag, Target, Trash2, Undo2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import SeletorMes from '../components/SeletorMes'
import EstadoVazio from '../components/EstadoVazio'
import MenuAcoes from '../components/MenuAcoes'
import { useAvisos } from '../components/AvisosContext'
import { useDialogo } from '../components/Dialogo'
import { centavosParaCampo, centavosParaReais, reaisParaCentavos } from '../utils/dinheiro'
import { mesAtual, mesDeISO, mesParaISO, rotuloMes } from '../utils/meses'
import { carregarOrcamentoMes, classeBarra } from '../utils/orcamento'

const soma = (lista, f) => lista.reduce((total, item) => total + f(item), 0)

export default function Orcamento() {
  const { confirmar, perguntar } = useDialogo()
  const { recarregar: recarregarAvisos } = useAvisos()
  const [params] = useSearchParams()
  const mesDoLink = params.get('mes')
  const [mes, setMes] = useState(
    mesDoLink && /^\d{4}-\d{2}-01$/.test(mesDoLink) ? mesDeISO(mesDoLink) : mesAtual()
  )
  const [dados, setDados] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  const mesISO = mesParaISO(mes)

  const carregar = useCallback(async () => {
    const resultado = await carregarOrcamentoMes(supabase, mesISO)
    if (resultado.erro) setErro('Não foi possível carregar o orçamento.')
    else setErro('')
    setDados(resultado)
    setCarregando(false)
  }, [mesISO])

  useEffect(() => {
    carregar()
  }, [carregar])

  // depois de mudar um limite, atualiza a tela e o sino de avisos
  async function atualizar() {
    await carregar()
    recarregarAvisos()
  }

  async function definirLimite(linha, soEsteMes) {
    const atual = soEsteMes ? linha.limiteMes || linha.limite : linha.limitePadrao || linha.limite
    const texto = await perguntar({
      titulo: soEsteMes ? `Limite só para ${rotuloMes(mes)}` : 'Limite mensal',
      mensagem: soEsteMes
        ? `${linha.nome}: vale apenas para este mês. Nos outros meses continua o limite padrão.`
        : `${linha.nome}: vale para todos os meses, exceto os que tiverem um limite próprio.`,
      rotulo: 'Limite (R$)',
      placeholder: '500,00',
      valorInicial: atual ? centavosParaCampo(atual) : '',
      inputMode: 'decimal',
      confirmar: 'Salvar limite',
    })
    if (texto === null) return
    const valor = reaisParaCentavos(texto)
    if (!valor || valor <= 0) return setErro('Informe um limite maior que zero, por exemplo 500,00.')
    setErro('')
    const { error } = await supabase.rpc('definir_orcamento', {
      p_categoria_id: linha.id,
      p_valor_centavos: valor,
      p_mes: soEsteMes ? mesISO : null,
    })
    if (error) {
      setErro(error.code === 'P0001' ? error.message : 'Não foi possível salvar o limite.')
      return
    }
    await atualizar()
  }

  async function voltarAoPadrao(linha) {
    setErro('')
    const { error } = await supabase
      .from('orcamentos')
      .delete()
      .eq('categoria_id', linha.id)
      .eq('mes_referencia', mesISO)
    if (error) setErro('Não foi possível voltar ao limite padrão.')
    await atualizar()
  }

  async function removerLimite(linha) {
    const confirmou = await confirmar({
      titulo: 'Remover limite?',
      mensagem: 'A categoria deixa de ter limite em todos os meses, inclusive os que tinham um limite próprio. Os gastos continuam como estão.',
      detalhes: [
        ['Categoria', linha.nome],
        ['Limite padrão', centavosParaReais(linha.limitePadrao)],
      ],
      confirmar: 'Remover limite',
      perigo: true,
    })
    if (!confirmou) return
    setErro('')
    const { error } = await supabase.from('orcamentos').delete().eq('categoria_id', linha.id)
    if (error) setErro('Não foi possível remover o limite.')
    await atualizar()
  }

  if (carregando) return <p className="suave">Carregando…</p>

  const linhas = dados?.linhas ?? []
  const comLimite = linhas.filter((l) => l.limite > 0).sort((a, b) => b.estado.pct - a.estado.pct)
  const semLimite = linhas
    .filter((l) => l.limite === 0)
    .sort((a, b) => b.gasto - a.gasto || a.nome.localeCompare(b.nome))
  const atencao = comLimite.filter((l) => l.estado.chave === 'atrasada' || l.estado.chave === 'breve')
  const orcado = soma(comLimite, (l) => l.limite)
  const gastoNasCategorias = soma(comLimite, (l) => l.gasto)

  function cartaoCategoria(l) {
    const itensMenu = [
      { rotulo: 'Definir limite mensal', Icone: Target, aoClicar: () => definirLimite(l, false) },
      { rotulo: `Limite só para ${rotuloMes(mes)}`, Icone: CalendarClock, aoClicar: () => definirLimite(l, true) },
    ]
    if (l.temExcecao) {
      itensMenu.push({ rotulo: 'Voltar ao limite padrão', Icone: Undo2, aoClicar: () => voltarAoPadrao(l) })
    }
    if (l.temPadrao) {
      itensMenu.push({ rotulo: 'Remover limite', Icone: Trash2, perigo: true, aoClicar: () => removerLimite(l) })
    }

    return (
      <div key={l.id} className="conta">
        <div className="conta-topo">
          <div className="item-texto">
            <div className="conta-nome">{l.nome}</div>
            <div className="detalhe">
              {centavosParaReais(l.gasto)}
              {l.limite > 0 && ` de ${centavosParaReais(l.limite)}`}
              {l.temExcecao && ' · limite só deste mês'}
            </div>
          </div>
          <MenuAcoes itens={itensMenu} />
        </div>

        {l.limite > 0 ? (
          <>
            <div className={classeBarra(l.estado)}>
              <span style={{ width: `${Math.min(l.estado.pct, 100)}%` }} />
            </div>
            <div className="conta-base">
              <span className={`estado estado-${l.estado.chave}`}>{l.estado.texto}</span>
              <span className="detalhe">{l.estado.pct}%</span>
            </div>
          </>
        ) : (
          <div className="conta-base">
            <span className="estado estado-sem">Sem limite</span>
            <button className="botao-secundario compacto" onClick={() => definirLimite(l, false)}>
              Definir limite
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Orçamento</h1>
      </div>

      <SeletorMes mes={mes} aoMudar={setMes} />

      {erro && <p className="erro" role="alert">{erro}</p>}
      {dados && !dados.disponivel && (
        <p className="aviso" style={{ marginBottom: 12 }}>
          O orçamento ainda não está disponível. Rode o arquivo funcoes8.sql no Supabase.
        </p>
      )}

      {linhas.length === 0 ? (
        <EstadoVazio
          Icone={Tag}
          titulo="Cadastre as categorias primeiro"
          texto="O orçamento define um limite mensal para cada categoria, como Alimentação e Transporte."
        >
          <Link className="botao-primario" to="/categorias">Ir para Categorias</Link>
        </EstadoVazio>
      ) : (
        <>
          <div className="metricas">
            <div className="metrica">
              <div className="rotulo">Orçado no mês</div>
              <div className="numero">{centavosParaReais(orcado)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Gasto nessas categorias</div>
              <div className="numero">{centavosParaReais(gastoNasCategorias)}</div>
            </div>
            <div className="metrica">
              <div className="rotulo">Pedem atenção</div>
              <div className="numero">{atencao.length}</div>
            </div>
          </div>

          {comLimite.length === 0 && (
            <EstadoVazio
              Icone={Target}
              titulo="Nenhum limite definido"
              texto="Escolha uma categoria abaixo e toque em Definir limite. Você acompanha o progresso aqui e no Resumo, e recebe aviso no sino."
            />
          )}

          {comLimite.map(cartaoCategoria)}

          {semLimite.length > 0 && (
            <>
              <div className="grupo-titulo">Sem limite ({semLimite.length})</div>
              {semLimite.map(cartaoCategoria)}
            </>
          )}

          {dados.semCategoria > 0 && (
            <div className="conta" style={{ borderStyle: 'dashed' }}>
              <div className="conta-topo">
                <div className="item-texto">
                  <div className="conta-nome">Sem categoria</div>
                  <div className="detalhe">
                    {centavosParaReais(dados.semCategoria)} do seu gasto não entra em nenhum limite
                  </div>
                </div>
              </div>
              <div className="conta-base">
                <span className="estado estado-sem">Sem categoria</span>
                <Link className="botao-secundario compacto" to="/categorizar">Categorizar compras</Link>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
