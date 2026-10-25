import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './supabaseClient'
import Login from './pages/Login'
import Layout from './components/Layout'
import Pagina from './pages/Pagina'

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
        <Route path="/cartoes" element={<Pagina titulo="Cartões" />} />
        <Route path="/pessoas" element={<Pagina titulo="Pessoas" />} />
        <Route path="/lancar" element={<Pagina titulo="Lançar despesa" />} />
        <Route path="/fixos" element={<Pagina titulo="Gastos fixos" />} />
        <Route path="/extras" element={<Pagina titulo="Extras" />} />
        <Route path="*" element={<Navigate to="/resumo" replace />} />
      </Route>
    </Routes>
  )
}
