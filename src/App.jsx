import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Layout from './components/Layout'
import Pagina from './pages/Pagina'
import Pessoas from './pages/Pessoas'
import Cartoes from './pages/Cartoes'
import Categorias from './pages/Categorias'
import Lancar from './pages/Lancar'

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
      <Route element={<Layout />}>
        <Route index element={<Navigate to="/resumo" replace />} />
        <Route path="/resumo" element={<Pagina titulo="Resumo" />} />
        <Route path="/cartoes" element={<Cartoes />} />
        <Route path="/pessoas" element={<Pessoas />} />
        <Route path="/categorias" element={<Categorias />} />
        <Route path="/lancar" element={<Lancar />} />
        <Route path="/fixos" element={<Pagina titulo="Gastos fixos" />} />
        <Route path="/extras" element={<Pagina titulo="Extras" />} />
        <Route path="*" element={<Navigate to="/resumo" replace />} />
      </Route>
    </Routes>
  )
}
