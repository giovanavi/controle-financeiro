import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Layout from './components/Layout'
import Resumo from './pages/Resumo'
import Pessoas from './pages/Pessoas'
import PessoaDetalhe from './pages/PessoaDetalhe'
import Cartoes from './pages/Cartoes'
import CartaoDetalhe from './pages/CartaoDetalhe'
import Categorias from './pages/Categorias'
import Lancar from './pages/Lancar'
import GastosPorTipo from './pages/GastosPorTipo'
import Importar from './pages/Importar'
import ContasAPagar from './pages/ContasAPagar'
import Categorizar from './pages/Categorizar'
import Receitas from './pages/Receitas'
import Orcamento from './pages/Orcamento'
import { AvisosProvider } from './components/AvisosContext'

export default function App() {
  // undefined = ainda verificando; null = sem login; objeto = logado
  const [sessao, setSessao] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSessao(data.session))

    const { data: ouvinte } = supabase.auth.onAuthStateChange((_evento, novaSessao) => {
      setSessao(novaSessao)
    })

    return () => ouvinte.subscription.unsubscribe()
  }, [])

  if (sessao === undefined) return <p className="carregando">Carregando…</p>
  if (!sessao) return <Login />

  return (
    <Routes>
      <Route
        element={
          <AvisosProvider>
            <Layout />
          </AvisosProvider>
        }
      >
        <Route index element={<Navigate to="/resumo" replace />} />
        <Route path="/resumo" element={<Resumo />} />
        <Route path="/cartoes" element={<Cartoes />} />
        <Route path="/cartoes/:id" element={<CartaoDetalhe />} />
        <Route path="/pessoas" element={<Pessoas />} />
        <Route path="/pessoas/:id" element={<PessoaDetalhe />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/categorizar" element={<Categorizar />} />
        <Route path="/lancar" element={<Lancar />} />
        <Route path="/contas" element={<ContasAPagar />} />
        <Route path="/receitas" element={<Receitas />} />
        <Route path="/orcamento" element={<Orcamento />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/fixos" element={<GastosPorTipo tipo="fixo" titulo="Gastos fixos" />} />
        <Route path="/extras" element={<GastosPorTipo tipo="extra" titulo="Extras" />} />
        <Route path="*" element={<Navigate to="/resumo" replace />} />
      </Route>
    </Routes>
  )
}
