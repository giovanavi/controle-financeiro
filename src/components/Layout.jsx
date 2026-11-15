import { useEffect, useState } from 'react'
import { Link as RouterLink, NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  Activity,
  CalendarClock,
  CreditCard,
  Ellipsis,
  House,
  ListChecks,
  LogOut,
  Plus,
  Repeat,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAvisos } from './AvisosContext'
import FolhaMais from './FolhaMais'
import Sino from './Sino'
import '../cadastros.css'
import '../navegacao.css'

// as quatro telas de uso diário ficam na barra de baixo (celular) e no topo do menu lateral (notebook)
const PRINCIPAIS = [
  { para: '/resumo', rotulo: 'Resumo', Icone: House },
  { para: '/contas', rotulo: 'Contas', Icone: CalendarClock },
  { para: '/cartoes', rotulo: 'Cartões', Icone: CreditCard },
  { para: '/pessoas', rotulo: 'Pessoas', Icone: Users },
]

// o resto aparece agrupado na folha "Mais" (celular) e no menu lateral (notebook)
const GRUPOS = [
  {
    titulo: 'Dinheiro',
    itens: [
      { para: '/receitas', rotulo: 'Receitas', Icone: TrendingUp },
      { para: '/fixos', rotulo: 'Gastos fixos', Icone: Repeat },
      { para: '/extras', rotulo: 'Extras', Icone: Sparkles },
      { para: '/analises', rotulo: 'Análises', Icone: Activity },
    ],
  },
  {
    titulo: 'Planejamento',
    itens: [
      { para: '/orcamento', rotulo: 'Orçamento', Icone: Target },
      { para: '/categorizar', rotulo: 'Categorizar', Icone: ListChecks },
      { para: '/categorias', rotulo: 'Categorias', Icone: Tag },
    ],
  },
  {
    titulo: 'Dados',
    itens: [{ para: '/importar', rotulo: 'Importar', Icone: Upload }],
  },
]

const ROTAS_DO_MAIS = GRUPOS.flatMap((g) => g.itens.map((i) => i.para))

// telas em que o botão flutuante de lançar não aparece
const SEM_BOTAO_FLUTUANTE = ['/lancar', '/categorizar']

const classeDoItem = ({ isActive }) => (isActive ? 'item ativo' : 'item')

function ItemNav({ para, rotulo, Icone }) {
  const { alertas } = useAvisos()
  const badge = para === '/contas' ? alertas.length : 0

  return (
    <NavLink to={para} className={classeDoItem}>
      <span className="icone-com-badge">
        <Icone size={20} aria-hidden="true" />
        {badge > 0 && <span className="badge-nav">{badge}</span>}
      </span>
      <span>{rotulo}</span>
    </NavLink>
  )
}

export default function Layout() {
  const [maisAberto, setMaisAberto] = useState(false)
  const local = useLocation()
  const sair = () => supabase.auth.signOut()

  // fecha a folha ao trocar de tela
  useEffect(() => {
    setMaisAberto(false)
  }, [local.pathname])

  const emTelaDoMais = ROTAS_DO_MAIS.some((rota) => local.pathname.startsWith(rota))
  const mostrarBotaoFlutuante = !SEM_BOTAO_FLUTUANTE.some((rota) => local.pathname.startsWith(rota))

  return (
    <div className="app">
      {/* Notebook: menu lateral */}
      <aside className="menu-lateral">
        <div className="marca marca-linha">
          <span>Controle financeiro</span>
          <Sino alinhar="esquerda" />
        </div>

        <RouterLink to="/lancar" className="botao-primario lancar-lateral">
          <Plus size={18} aria-hidden="true" />
          Lançar despesa
        </RouterLink>

        {PRINCIPAIS.map((item) => (
          <ItemNav key={item.para} {...item} />
        ))}

        {GRUPOS.map((grupo) => (
          <div key={grupo.titulo} className="grupo-menu">
            <div className="grupo-menu-titulo">{grupo.titulo}</div>
            {grupo.itens.map((item) => (
              <ItemNav key={item.para} {...item} />
            ))}
          </div>
        ))}

        <div className="espaco" />
        <button className="item" onClick={sair}>
          <LogOut size={20} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </aside>

      <div className="conteudo">
        {/* Celular: topo só com o nome e o sino de avisos */}
        <header className="topo-mobile">
          <span>Controle financeiro</span>
          <Sino />
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      {/* Celular: botão flutuante para lançar uma despesa */}
      {mostrarBotaoFlutuante && (
        <RouterLink to="/lancar" className="botao-flutuante" aria-label="Lançar despesa">
          <Plus size={26} aria-hidden="true" />
        </RouterLink>
      )}

      {/* Celular: barra de navegação inferior */}
      <nav className="barra-inferior" aria-label="Navegação principal">
        {PRINCIPAIS.map((item) => (
          <ItemNav key={item.para} {...item} />
        ))}
        <button
          type="button"
          className={emTelaDoMais || maisAberto ? 'item ativo' : 'item'}
          aria-haspopup="dialog"
          aria-expanded={maisAberto}
          onClick={() => setMaisAberto(true)}
        >
          <span className="icone-com-badge">
            <Ellipsis size={20} aria-hidden="true" />
          </span>
          <span>Mais</span>
        </button>
      </nav>

      <FolhaMais
        aberta={maisAberto}
        aoFechar={() => setMaisAberto(false)}
        aoSair={sair}
        grupos={GRUPOS}
      />
    </div>
  )
}
