import { useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { supabase } from '../supabaseClient'
import MenuAcoes from '../components/MenuAcoes'
import { useDialogo } from '../components/Dialogo'

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
  const { confirmar, perguntar } = useDialogo()
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
    const novo = await perguntar({
      titulo: 'Renomear categoria',
      mensagem: 'As despesas que usam esta categoria passam a mostrar o novo nome.',
      rotulo: 'Novo nome',
      valorInicial: categoria.nome,
      confirmar: 'Salvar nome',
    })
    if (novo === null) return
    const limpo = novo.trim()
    if (!limpo) return setErro('O nome não pode ficar vazio.')
    setErro('')
    const { error } = await supabase.from('categorias').update({ nome: limpo }).eq('id', categoria.id)
    if (error) setErro(error.code === '23505' ? JA_EXISTE : 'Não foi possível renomear.')
    await carregar()
  }

  async function excluir(categoria) {
    const confirmou = await confirmar({
      titulo: 'Excluir categoria?',
      mensagem:
        'As despesas que usam esta categoria continuam existindo, mas ficam sem categoria. Não dá para desfazer.',
      detalhes: [['Categoria', categoria.nome]],
      confirmar: 'Excluir categoria',
      perigo: true,
    })
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
                <div className="item-texto titulo">{c.nome}</div>
                <MenuAcoes
                  itens={[
                    { rotulo: 'Renomear', Icone: Pencil, aoClicar: () => renomear(c) },
                    { rotulo: 'Excluir', Icone: Trash2, perigo: true, aoClicar: () => excluir(c) },
                  ]}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
