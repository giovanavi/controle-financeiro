import { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'

const SUGESTOES = [
  'Moradia',
  'Alimentação',
  'Transporte',
  'Saúde',
  'Lazer',
  'Educação',
  'Compras',
  'Assinaturas',
  'Outros',
]

const JA_EXISTE = 'Já existe uma categoria com esse nome.'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [nome, setNome] = useState('')

  async function carregar() {
    const { data, error } = await supabase.from('categorias').select('*').order('nome')
    if (error) setErro('Não foi possível carregar as categorias.')
    else setCategorias(data)
    setCarregando(false)
  }

  useEffect(() => {
    carregar()
  }, [])

  async function adicionar(evento) {
    evento.preventDefault()
    const limpo = nome.trim()
    if (!limpo) return setErro('Informe o nome da categoria.')
    setErro('')
    const { error } = await supabase.from('categorias').insert({ nome: limpo })
    if (error) return setErro(error.code === '23505' ? JA_EXISTE : 'Não foi possível salvar.')
    setNome('')
    await carregar()
  }

  async function adicionarSugestoes() {
    setErro('')
    const { error } = await supabase.from('categorias').insert(SUGESTOES.map((n) => ({ nome: n })))
    if (error) setErro('Não foi possível adicionar as sugestões.')
    await carregar()
  }

  async function renomear(categoria) {
    const novo = window.prompt('Novo nome da categoria', categoria.nome)
    if (novo === null) return
    const limpo = novo.trim()
    if (!limpo) return setErro('O nome não pode ficar vazio.')
    setErro('')
    const { error } = await supabase.from('categorias').update({ nome: limpo }).eq('id', categoria.id)
    if (error) setErro(error.code === '23505' ? JA_EXISTE : 'Não foi possível renomear.')
    await carregar()
  }

  async function excluir(categoria) {
    const confirmou = window.confirm(
      `Excluir a categoria "${categoria.nome}"? As despesas dela ficam sem categoria.`
    )
    if (!confirmou) return
    setErro('')
    const { error } = await supabase.from('categorias').delete().eq('id', categoria.id)
    if (error) setErro('Não foi possível excluir.')
    await carregar()
  }

  return (
    <section>
      <div className="cabecalho-pagina">
        <h1>Categorias</h1>
      </div>

      {erro && <p className="erro" role="alert">{erro}</p>}

      <form className="bloco formulario" onSubmit={adicionar}>
        <label className="campo">
          Nova categoria
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Mercado" />
        </label>
        <div className="acoes">
          <button className="botao-primario pequeno" type="submit">Adicionar</button>
        </div>
      </form>

      {!carregando && categorias.length === 0 && (
        <div className="bloco">
          <p>Quer começar com algumas categorias comuns? Você pode renomear ou excluir depois.</p>
          <button className="botao-secundario" onClick={adicionarSugestoes}>
            Adicionar categorias sugeridas
          </button>
        </div>
      )}

      <div className="bloco">
        {carregando ? (
          <p className="suave">Carregando…</p>
        ) : categorias.length === 0 ? (
          <p className="suave">Nenhuma categoria ainda.</p>
        ) : (
          <ul className="lista">
            {categorias.map((c) => (
              <li key={c.id} className="linha">
                <div className="titulo">{c.nome}</div>
                <div className="acoes">
                  <button className="botao-secundario" onClick={() => renomear(c)}>Renomear</button>
                  <button className="botao-secundario perigo" onClick={() => excluir(c)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
