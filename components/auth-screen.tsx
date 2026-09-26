'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Dumbbell, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Mode = 'login' | 'signup' | 'reset'
export function AuthScreen({ initialMessage = '' }: { initialMessage?: string }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState(initialMessage)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)
  function switchMode(next: Mode) { setMode(next); setMessage(''); setPassword('') }
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    setLoading(true); setMessage('')
    try {
      const supabase = createClient()
      const normalizedEmail = email.trim().toLowerCase()
      const callback = `${window.location.origin}/auth/callback`
      if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, { redirectTo: `${callback}?next=/auth/reset-password` })
        if (error) throw error
        setMessage('Se houver uma conta com esse e-mail, você receberá um link para criar outra senha. Confira também o spam.')
        return
      }
      const { data, error } = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: callback, data: { name: name.trim() } } })
      if (error) {
        setMessage(error.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.' : error.code === 'invalid_credentials' ? 'E-mail ou senha incorretos. Você pode recuperar sua senha abaixo.' : error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : 'Não foi possível concluir. Confira os dados e tente novamente em instantes.')
        return
      }
      if (mode === 'signup' && !data.session) setMessage('Confira seu e-mail para confirmar o cadastro. Depois, volte aqui para entrar.')
    } catch { setMessage('Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.') }
    finally { setLoading(false) }
  }
  return <main className="auth-shell"><section className="auth-card" aria-labelledby="auth-title">
    <div className="auth-logo"><img src="/summer-fit-logo.webp" alt="" width={32} height={32} /><span>SUMMER FIT</span></div>
    <div className="auth-heading"><div className="auth-icon"><Dumbbell size={22} /></div><p className="eyebrow">UM TREINO DE CADA VEZ</p><h1 id="auth-title">{mode === 'login' ? 'Seu próximo passo começa aqui.' : mode === 'signup' ? 'Vamos começar?' : 'Recupere seu acesso'}</h1><p>{mode === 'login' ? 'Suas fichas, sua rotina e cada conquista em um só lugar.' : mode === 'signup' ? 'Crie sua conta e organize seus próprios treinos.' : 'Enviaremos um link para você escolher uma nova senha.'}</p></div>
    <form className="auth-form" onSubmit={handleSubmit} aria-busy={loading}>
      {mode === 'signup' && <label>Seu nome<input value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?" autoComplete="name" maxLength={80} required /></label>}
      <label>E-mail<div className="input-with-icon"><Mail size={17} aria-hidden="true" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" autoCapitalize="none" required /></div></label>
      {mode !== 'reset' && <label>Senha<div className="input-with-icon"><LockKeyhole size={17} aria-hidden="true" /><input type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Pelo menos 8 caracteres' : 'Sua senha'} minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
      {message && <p className="auth-message" role="status">{message}</p>}
      <button className="primary-button auth-submit" disabled={loading}>{loading ? 'AGUARDE...' : mode === 'login' ? 'ENTRAR' : mode === 'signup' ? 'CRIAR CONTA' : 'ENVIAR LINK'}<ArrowRight size={17} /></button>
    </form>
    {mode === 'login' && <button className="auth-switch" disabled={loading} onClick={() => switchMode('reset')}>Esqueci minha senha</button>}
    <button className="auth-switch" disabled={loading} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'É sua primeira vez? Crie uma conta' : 'Voltar para entrar'}</button>
    <p className="auth-footnote">No computador, no Android ou no Safari do iPhone.</p>
  </section></main>
}
