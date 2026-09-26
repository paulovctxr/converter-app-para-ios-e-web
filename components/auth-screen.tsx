'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Dumbbell, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const supabase = createClient()
    const normalizedEmail = email.trim().toLowerCase()
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
      : await supabase.auth.signUp({
          email: normalizedEmail,
          password,
          options: {
            emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ?? `${window.location.origin}/auth/callback`,
            data: { name: name.trim() },
          },
        })
    setLoading(false)
    if (result.error) {
      setMessage(mode === 'login' ? 'E-mail ou senha inválidos.' : 'Não foi possível criar a conta. Confira os dados e tente novamente.')
      return
    }
    if (mode === 'signup' && !result.data.session) setMessage('Conta criada. Confira seu e-mail para confirmar o acesso.')
  }

  return (
    <main className="auth-shell">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-logo"><img src="/summer-fit-logo.webp" alt="Summer Fit" /><span>SUMMER FIT</span></div>
        <div className="auth-heading"><div className="auth-icon"><Dumbbell size={22} /></div><p className="eyebrow">TREINE NO SEU RITMO</p><h1 id="auth-title">{mode === 'login' ? 'Bem-vindo de volta' : 'Crie sua conta'}</h1><p>{mode === 'login' ? 'Acesse seus treinos e acompanhe sua evolução.' : 'Comece sua jornada fitness com a Summer Fit.'}</p></div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'signup' && <label>Seu nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Como podemos chamar você?" required /></label>}
          <label><span>E-mail</span><div className="input-with-icon"><Mail size={17} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" autoComplete="email" required /></div></label>
          <label><span>Senha</span><div className="input-with-icon"><LockKeyhole size={17} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /></div></label>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="primary-button auth-submit" disabled={loading}>{loading ? 'AGUARDE...' : mode === 'login' ? 'ENTRAR' : 'CRIAR CONTA'} <ArrowRight size={17} /></button>
        </form>
        <button className="auth-switch" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMessage('') }}>{mode === 'login' ? 'Ainda não tenho uma conta' : 'Já tenho uma conta'}</button>
      </section>
    </main>
  )
}
