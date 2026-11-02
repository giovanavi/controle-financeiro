import { NavLink, Outlet } from 'react-router-dom'
import { House, CalendarClock, CreditCard, Users, Plus, Repeat, Sparkles, Tag, ListChecks, TrendingUp, Upload, LogOut } from 'lucide-react'
import { supabase } from '../supabaseClient'
import { useAvisos } from './AvisosContext'
import Sino from './Sino'
import '../cadastros.css'

const itensPrincipais = [
  { para: '/resumo', rotulo: 'Resumo', Icone: House },
  { para: '/contas', rotulo: 'Contas', Icone: CalendarClock },
  { para: '/cartoes', rotulo: 'Cartões', Icone: CreditCard },
  { para: '/pessoas', rotulo: 'Pessoas', Icone: Users },
  { para: '/lancar', rotulo: 'Lançar', Icone: Plus },
]

const itensSecundarios = [
  { para: '/receitas', rotulo: 'Receitas', Icone: TrendingUp },
  { para: '/fixos', rotulo: 'Gastos fixos', Icone: Repeat },
  { para: '/extras', rotulo: 'Extras', Icone: Sparkles },
  { para: '/categorias', rotulo: 'Categorias', Icone: Tag },
  { para: '/categorizar', rotulo: 'Categorizar', Icone: ListChecks },
  { para: '/importar', rotulo: 'Importar', Icone: Upload },
]

const classeDoItem = ({ isActive }) => (isActive ? 'item ativo' : 'item')

function Link({ para, rotulo, Icone }) {
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
  const sair = () => supabase.auth.signOut()

  return (
    <div className="app">
      {/* Notebook: menu lateral */}
      <aside className="menu-lateral">
        <div className="marca marca-linha">
          <span>Controle financeiro</span>
          <Sino alinhar="esquerda" />
        </div>
        {itensPrincipais.map((item) => (
          <Link key={item.para} {...item} />
        ))}
        {itensSecundarios.map((item) => (
          <Link key={item.para} {...item} />
        ))}
        <div className="espaco" />
        <button className="item" onClick={sair}>
          <LogOut size={20} aria-hidden="true" />
          <span>Sair</span>
        </button>
      </aside>

      <div className="conteudo">
        {/* Celular: topo com atalho de categorias e botão de sair */}
        <header className="topo-mobile">
          <span>Controle financeiro</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <Sino />
            <NavLink to="/categorias" className="botao-sair" aria-label="Categorias">
              <Tag size={20} aria-hidden="true" />
            </NavLink>
            <button className="botao-sair" onClick={sair} aria-label="Sair">
              <LogOut size={20} aria-hidden="true" />
            </button>
          </div>
        </header>

        <main>
          <Outlet />
        </main>
      </div>

      {/* Celular: barra de navegação inferior */}
      <nav className="barra-inferior">
        {itensPrincipais.map((item) => (
          <Link key={item.para} {...item} />
        ))}
      </nav>
    </div>
  )
}
