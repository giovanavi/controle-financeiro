import { NavLink, Outlet } from 'react-router-dom'
import { House, CreditCard, Users, Plus, Repeat, Sparkles, LogOut } from 'lucide-react'
import { supabase } from '../supabaseClient'

const itensPrincipais = [
  { para: '/resumo', rotulo: 'Resumo', Icone: House },
  { para: '/cartoes', rotulo: 'Cartões', Icone: CreditCard },
  { para: '/pessoas', rotulo: 'Pessoas', Icone: Users },
  { para: '/lancar', rotulo: 'Lançar', Icone: Plus },
]

const itensSecundarios = [
  { para: '/fixos', rotulo: 'Gastos fixos', Icone: Repeat },
  { para: '/extras', rotulo: 'Extras', Icone: Sparkles },
]

const classeDoItem = ({ isActive }) => (isActive ? 'item ativo' : 'item')

function Link({ para, rotulo, Icone }) {
  return (
    <NavLink to={para} className={classeDoItem}>
      <Icone size={20} aria-hidden="true" />
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
        <div className="marca">Controle financeiro</div>
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
        {/* Celular: topo com botão de sair */}
        <header className="topo-mobile">
          <span>Controle financeiro</span>
          <button className="botao-sair" onClick={sair} aria-label="Sair">
            <LogOut size={20} aria-hidden="true" />
          </button>
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
