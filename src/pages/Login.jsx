import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(evento) {
    evento.preventDefault()
    setErro('')
    setEnviando(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      console.error('Erro de login:', error)
      console.log('URL carregada:', import.meta.env.VITE_SUPABASE_URL)
      console.log('Chave carregada:', !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
      const credenciaisErradas = error.message?.includes('Invalid login credentials')
      setErro(
        credenciaisErradas
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível entrar. Verifique sua conexão e tente de novo.'
      )
    }
    setEnviando(false)
  }

  return (
    <div className="login">
      <form onSubmit={entrar}>
        <h1>Controle financeiro</h1>
        <p className="suave" style={{ margin: 0 }}>Entre com a sua conta.</p>

        <label>
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {erro && <p className="erro" role="alert">{erro}</p>}

        <button className="botao-primario" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
