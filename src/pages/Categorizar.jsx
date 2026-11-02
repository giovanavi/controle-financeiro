import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Tag, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useDialogo } from '../components/Dialogo'
import EstadoVazio from '../components/EstadoVazio'
import MenuAcoes from '../components/MenuAcoes'
import { centavosParaReais } from '../utils/dinheiro'
import { mesDeISO, rotuloMes } from '../utils/meses'
import { normalizar } from '../utils/importacao'
import {
  atualizarCategoria,
  casaRegra,
  normalizarPalavra,
  palavrasComuns,
} from '../utils/categorias'
import '../categorizar.css'

const TAMANHO_PAGINA = 50

export default function Categorizar() {
  const { confirmar } = useDialogo()
  const [aba, setAba] = useState('compras')
  const [despesas, setDespesas] = useState([])
  const [categorias, setCategorias] = useState([])
  const [regras, setRegras] = useState([])
  const [regrasOk, setRegrasOk] = useState(true)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [novasRegras, setNovasRegras] = useState([]) // sugestões de regra após categorizar
  const [filtro, setFiltro] = useState({ texto: '', cartaoId: '', pessoaId: '', mes: '', mostrar: 'sem' })
  const [sel, setSel] = useState({})
  const [catEscolhida, setCatEscolhida] = useState('')
  const [limite, setLimite] = useState(TAMANHO_PAGINA)
  const [ocupado, setOcupado] = useState(false)
  const [novaPalavra, setNovaPalavra] = useState('')
  const [novaCategoria, setNovaCategoria] = useState('')

  const carregar = useCallback(async () => {
    const [d, c, r] = await Promise.all([
      supabase
        .from('despesas')
        .select(
          'id, descricao, tipo, categoria_id, total_parcelas, cartoes(id, nome), lancamentos(mes_referencia, valor_centavos), despesa_participacoes(pessoas(id, nome, eh_eu))'
        )
        .order('criado_em', { ascending: false })
        .limit(1000),
      supabase.from('categorias').select('*').order('nome'),
      supabase.from('regras_categoria').select('*, categorias(nome)').order('palavra'),
    ])
    if (d.error || c.error) {
      setErro('Não foi possível carregar as compras e as categorias.')
    } else {
      setErro('')
      setDespesas(d.data)
      setCategorias(c.data)
    }
    setRegrasOk(!r.error)
    setRegras(r.error ? [] : r.data)
    setCarregando(false)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  const nomeDaCategoria = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias])

  // uma linha por compra (as parcelas pertencem à compra)
  const itens = useMemo(
    () =>
      despesas.map((d) => {
        const lancs = [...d.lancamentos].sort((a, b) => a.mes_referencia.localeCompare(b.mes_referencia))
        return {
          id: d.id,
          descricao: d.descricao,
          norm: normalizar(d.descricao),
          categoriaId: d.categoria_id,
          origem: d.tipo === 'cartao' ? d.cartoes?.nome ?? 'Cartão' : d.tipo === 'fixo' ? 'Gasto fixo' : 'Extra',
          cartaoId: d.cartoes?.id ?? null,
          parcelas: d.total_parcelas,
          valorParcela: lancs[0]?.valor_centavos ?? 0,
          meses: [...new Set(lancs.map((l) => l.mes_referencia))],
          pessoas: d.despesa_participacoes.map((p) => p.pessoas).filter(Boolean),
        }
      }),
    [despesas]
  )

  const semCategoria = itens.filter((i) => !i.categoriaId)

  const opcoes = useMemo(() => {
    const cartoes = new Map()
    const pessoas = new Map()
    const meses = new Set()
    itens.forEach((i) => {
      if (i.cartaoId) cartoes.set(i.cartaoId, i.origem)
      i.pessoas.forEach((p) => pessoas.set(p.id, p.nome))
      i.meses.forEach((m) => meses.add(m))
    })
    return {
      cartoes: [...cartoes].sort((a, b) => a[1].localeCompare(b[1])),
      pessoas: [...pessoas].sort((a, b) => a[1].localeCompare(b[1])),
      meses: [...meses].sort(),
    }
  }, [itens])

  const visiveis = itens.filter((i) => {
    if (filtro.mostrar === 'sem' && i.categoriaId) return false
    if (filtro.texto && !i.norm.includes(normalizar(filtro.texto))) return false
    if (filtro.cartaoId && i.cartaoId !== filtro.cartaoId) return false
    if (filtro.pessoaId && !i.pessoas.some((p) => p.id === filtro.pessoaId)) return false
    if (filtro.mes && !i.meses.includes(filtro.mes)) return false
    return true
  })

  const marcadas = Object.keys(sel).filter((k) => sel[k])
  const mudarFiltro = (campo) => (e) => {
    setFiltro({ ...filtro, [campo]: e.target.value })
    setLimite(TAMANHO_PAGINA)
  }

  // sugestões das regras já cadastradas: quantas compras sem categoria casam com cada uma
  const sugestoes = regras
    .map((r) => ({
      regra: r,
      ids: semCategoria.filter((i) => casaRegra(i.norm, r.palavra)).map((i) => i.id),
    }))
    .filter((s) => s.ids.length > 0)

  async function executar(trabalho) {
    setErro('')
    setMensagem('')
    setNovasRegras([])
    setOcupado(true)
    await trabalho()
    setOcupado(false)
  }

  function aplicarSelecionadas() {
    if (marcadas.length === 0) return setErro('Marque ao menos uma compra.')
    if (!catEscolhida) return setErro('Escolha uma categoria.')
    executar(async () => {
      const descricoes = itens.filter((i) => sel[i.id]).map((i) => i.descricao)
      const ok = await atualizarCategoria(supabase, marcadas, catEscolhida)
      if (!ok) return setErro('Não foi possível categorizar. Tente de novo.')
      setMensagem(
        `${marcadas.length} ${marcadas.length === 1 ? 'compra categorizada' : 'compras categorizadas'} como ${nomeDaCategoria.get(catEscolhida)}.`
      )
      setNovasRegras(
        palavrasComuns(descricoes, regras).map((palavra) => ({ palavra, categoriaId: catEscolhida }))
      )
      setSel({})
      await carregar()
    })
  }

  function aplicarRegra(sugestao) {
    executar(async () => {
      const ok = await atualizarCategoria(supabase, sugestao.ids, sugestao.regra.categoria_id)
      if (!ok) return setErro('Não foi possível aplicar a regra.')
      setMensagem(
        `${sugestao.ids.length} ${sugestao.ids.length === 1 ? 'compra categorizada' : 'compras categorizadas'} como ${nomeDaCategoria.get(sugestao.regra.categoria_id)}.`
      )
      await carregar()
    })
  }

  function aplicarTodasAsRegras() {
    executar(async () => {
      const porCategoria = new Map()
      sugestoes.forEach((s) => {
        const lista = porCategoria.get(s.regra.categoria_id) ?? new Set()
        s.ids.forEach((id) => lista.add(id))
        porCategoria.set(s.regra.categoria_id, lista)
      })
      let total = 0
      for (const [categoriaId, ids] of porCategoria) {
        const ok = await atualizarCategoria(supabase, [...ids], categoriaId)
        if (!ok) return setErro('Não foi possível aplicar todas as regras.')
        total += ids.size
      }
      setMensagem(`${total} ${total === 1 ? 'compra categorizada' : 'compras categorizadas'} pelas regras.`)
      await carregar()
    })
  }

  async function criarRegra(palavraBruta, categoriaId) {
    const palavra = normalizarPalavra(palavraBruta)
    if (palavra.length < 2) return setErro('A palavra da regra precisa ter ao menos 2 letras.')
    if (!categoriaId) return setErro('Escolha a categoria da regra.')
    setErro('')
    const { error } = await supabase.from('regras_categoria').insert({ palavra, categoria_id: categoriaId })
    if (error) {
      setErro(error.code === '23505' ? 'Já existe uma regra com essa palavra.' : 'Não foi possível criar a regra.')
      return false
    }
    await carregar()
    return true
  }

  async function adicionarRegra(evento) {
    evento.preventDefault()
    if (await criarRegra(novaPalavra, novaCategoria)) {
      setNovaPalavra('')
      setMensagem('Regra criada. Ela já aparece como sugestão na aba Compras.')
    }
  }

  async function sugerirRegra(sugestao) {
    if (await criarRegra(sugestao.palavra, sugestao.categoriaId)) {
      setNovasRegras(novasRegras.filter((n) => n.palavra !== sugestao.palavra))
      setMensagem(`Regra criada: “${sugestao.palavra}” vira ${nomeDaCategoria.get(sugestao.categoriaId)}.`)
    }
  }

  async function excluirRegra(regra) {
    const confirmou = await confirmar({
      titulo: 'Excluir regra?',
      mensagem: 'As compras que já foram categorizadas por ela continuam como estão. A regra só deixa de valer daqui para frente.',
      detalhes: [
        ['Palavra', regra.palavra],
        ['Categoria', regra.categorias?.nome ?? ''],
      ],
      confirmar: 'Excluir regra',
      perigo: true,
    })
    if (!confirmou) return
    setErro('')
    const { error } = await supabase.from('regras_categoria').delete().eq('id', regra.id)
    if (error) setErro('Não foi possível excluir a regra.')
    await carregar()
  }

  if (carregando) return <p className="suave">Carregando…</p>

  if (categorias.length === 0) {
    return (
      <section>
        <div className="cabecalho-pagina">
          <h1>Categorizar compras</h1>
        </div>
        <EstadoVazio
          Icone={Tag}
          titulo="Cadastre as categorias primeiro"
          texto="Você precisa de categorias, como Alimentação e Transporte, para organizar as compras."
        >
          <Link className="botao-primario" to="/categorias">Ir para Categorias</Link>
        </EstadoVazio>
      </section>
    )
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <div>
          <h1>Categorizar compras</h1>
          <div className="detalhe">{semCategoria.length} sem categoria</div>
        </div>
      </div>

      <div className="segmentos" role="group" aria-label="Seção" style={{ marginBottom: 12 }}>
        <button className={aba === 'compras' ? 'ativo' : ''} onClick={() => setAba('compras')}>Compras</button>
        <button className={aba === 'regras' ? 'ativo' : ''} onClick={() => setAba('regras')}>Regras</button>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}
      {!regrasOk && (
        <p className="aviso" style={{ marginBottom: 12 }}>
          As regras de categoria ainda não estão disponíveis. Rode o arquivo funcoes6.sql no Supabase.
        </p>
      )}

      {mensagem && (
        <div className="mensagem-ok" role="status">
          {mensagem}
          {novasRegras.length > 0 && (
            <div className="acoes">
              {novasRegras.map((n) => (
                <button key={n.palavra} className="botao-secundario compacto" onClick={() => sugerirRegra(n)}>
                  Criar regra “{n.palavra}” → {nomeDaCategoria.get(n.categoriaId)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {aba === 'compras' && (
        <>
          {sugestoes.length > 0 && filtro.mostrar === 'sem' && (
            <div className="bloco">
              <div className="cabecalho-secao">
                <b>Sugestões das suas regras</b>
                {sugestoes.length > 1 && (
                  <button className="botao-secundario compacto" disabled={ocupado} onClick={aplicarTodasAsRegras}>
                    Aplicar todas
                  </button>
                )}
              </div>
              {sugestoes.map((s) => (
                <div key={s.regra.id} className="sugestao">
                  <span>
                    {s.ids.length} {s.ids.length === 1 ? 'compra' : 'compras'} com “{s.regra.palavra}” →{' '}
                    {s.regra.categorias?.nome}
                  </span>
                  <button className="botao-secundario compacto" disabled={ocupado} onClick={() => aplicarRegra(s)}>
                    Aplicar
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="bloco">
            <div className="filtros-grid">
              <label className="campo">
                Buscar
                <input value={filtro.texto} onChange={mudarFiltro('texto')} placeholder="uber, mercado…" />
              </label>
              <label className="campo">
                Mostrar
                <select value={filtro.mostrar} onChange={mudarFiltro('mostrar')}>
                  <option value="sem">Só sem categoria</option>
                  <option value="todas">Todas as compras</option>
                </select>
              </label>
              <label className="campo">
                Cartão
                <select value={filtro.cartaoId} onChange={mudarFiltro('cartaoId')}>
                  <option value="">Todos</option>
                  {opcoes.cartoes.map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Pessoa
                <select value={filtro.pessoaId} onChange={mudarFiltro('pessoaId')}>
                  <option value="">Todas</option>
                  {opcoes.pessoas.map(([id, nome]) => (
                    <option key={id} value={id}>{nome}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                Fatura do mês
                <select value={filtro.mes} onChange={mudarFiltro('mes')}>
                  <option value="">Todos</option>
                  {opcoes.meses.map((m) => (
                    <option key={m} value={m}>{rotuloMes(mesDeISO(m))}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="bloco">
            {visiveis.length === 0 ? (
              <EstadoVazio
                simples
                Icone={ListChecks}
                titulo={semCategoria.length === 0 ? 'Tudo categorizado' : 'Nenhuma compra com esses filtros'}
                texto={
                  semCategoria.length === 0
                    ? 'Todas as compras têm categoria. Use "Todas as compras" para revisar.'
                    : 'Ajuste ou limpe os filtros para ver mais compras.'
                }
              />
            ) : (
              <>
                <div className="cabecalho-secao">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={marcadas.length > 0 && visiveis.every((i) => sel[i.id])}
                      onChange={(e) => {
                        const novo = { ...sel }
                        visiveis.forEach((i) => {
                          novo[i.id] = e.target.checked
                        })
                        setSel(e.target.checked ? novo : {})
                      }}
                    />
                    Selecionar as {visiveis.length} visíveis
                  </label>
                  <span className="detalhe">{marcadas.length} marcada(s)</span>
                </div>

                {visiveis.slice(0, limite).map((i) => (
                  <label key={i.id} className="compra-linha">
                    <input
                      type="checkbox"
                      checked={!!sel[i.id]}
                      onChange={(e) => setSel({ ...sel, [i.id]: e.target.checked })}
                    />
                    <div className="item-texto">
                      <div className="titulo">
                        {i.descricao}
                        {i.categoriaId && <span className="chip">{nomeDaCategoria.get(i.categoriaId)}</span>}
                      </div>
                      <div className="detalhe">
                        {i.origem}
                        {i.parcelas > 1 ? ` · ${i.parcelas}x` : ''}
                        {i.pessoas.length > 0 && ` · ${i.pessoas.map((p) => (p.eh_eu ? 'Você' : p.nome)).join(', ')}`}
                      </div>
                    </div>
                    <div className="compra-valor">{centavosParaReais(i.valorParcela)}</div>
                  </label>
                ))}

                {visiveis.length > limite && (
                  <button
                    className="botao-secundario"
                    style={{ width: '100%', marginTop: 8 }}
                    onClick={() => setLimite(limite + TAMANHO_PAGINA)}
                  >
                    Mostrar mais ({visiveis.length - limite} restantes)
                  </button>
                )}
              </>
            )}
          </div>

          {marcadas.length > 0 && (
            <div className="barra-acao">
              <span className="contagem">{marcadas.length} marcada(s)</span>
              <select value={catEscolhida} onChange={(e) => setCatEscolhida(e.target.value)} aria-label="Categoria">
                <option value="">Escolha a categoria…</option>
                {categorias.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <button className="botao-primario" disabled={ocupado} onClick={aplicarSelecionadas}>
                {ocupado ? 'Aplicando…' : `Aplicar a ${marcadas.length}`}
              </button>
            </div>
          )}
        </>
      )}

      {aba === 'regras' && (
        <>
          <form className="bloco formulario" onSubmit={adicionarRegra}>
            <p className="dica">
              Quando a descrição de uma compra começa uma palavra com este texto, a categoria é
              sugerida aqui e aplicada nas próximas importações.
            </p>
            <div className="duas-colunas">
              <label className="campo">
                Palavra
                <input value={novaPalavra} onChange={(e) => setNovaPalavra(e.target.value)} placeholder="uber" />
              </label>
              <label className="campo">
                Categoria
                <select value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)}>
                  <option value="">Escolha…</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="acoes">
              <button className="botao-primario pequeno" type="submit">Adicionar regra</button>
            </div>
          </form>

          <div className="bloco">
            {regras.length === 0 ? (
              <EstadoVazio
                simples
                Icone={Tag}
                titulo="Nenhuma regra ainda"
                texto="Crie uma regra, como uber → Transporte, e o app categoriza sozinho as compras parecidas."
              />
            ) : (
              <ul className="lista">
                {regras.map((r) => {
                  const casam = semCategoria.filter((i) => casaRegra(i.norm, r.palavra)).length
                  return (
                    <li key={r.id} className="linha">
                      <div className="item-texto">
                        <div className="titulo">“{r.palavra}” → {r.categorias?.nome}</div>
                        <div className="detalhe">
                          {casam > 0 ? `${casam} compra(s) sem categoria combinam` : 'Nenhuma compra sem categoria combina'}
                        </div>
                      </div>
                      <MenuAcoes
                        itens={[
                          { rotulo: 'Excluir regra', Icone: Trash2, perigo: true, aoClicar: () => excluirRegra(r) },
                        ]}
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  )
}
