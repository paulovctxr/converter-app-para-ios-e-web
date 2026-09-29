'use client'

import { FormEvent, useState } from 'react'
import { ArrowRight, Dumbbell, Eye, EyeOff, IdCard, LockKeyhole, Mail } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { InstallApp } from '@/components/install-app'

type Mode = 'login' | 'signup' | 'reset'
export function AuthScreen({ initialMessage = '' }: { initialMessage?: string }) {
  const [mode, setMode] = useState<Mode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [registration, setRegistration] = useState('')
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
        : await supabase.auth.signUp({ email: normalizedEmail, password, options: { emailRedirectTo: callback, data: { name: name.trim(), matricula: registration } } })
      if (error) {
        setMessage(error.code === 'email_not_confirmed' ? 'Confirme seu e-mail antes de entrar. Confira também a pasta de spam.' : error.code === 'invalid_credentials' ? 'E-mail ou senha incorretos. Você pode recuperar sua senha abaixo.' : error.status === 429 ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' : 'Não foi possível concluir. Confira os dados e tente novamente em instantes.')
        return
      }
      if (mode === 'signup' && !data.session) setMessage('Confira seu e-mail para confirmar o cadastro. Depois da confirmação, sua matrícula ficará aguardando aprovação.')
    } catch { setMessage('Não foi possível conectar ao serviço de acesso. Confira sua conexão e tente novamente.') }
    finally { setLoading(false) }
  }
  return <main className="auth-shell auth-shell-branded">
    <InstallApp />
    <section className="auth-brand-panel" aria-label="Summer Fit">
      <img className="auth-brand-logo" src="/summer-fit-brand.jpeg" alt="Summer Fit — A academia que vai esquentar o seu dia" />
      <div className="auth-brand-copy">
        <p className="auth-brand-kicker">TREINE · REGISTRE · EVOLUA</p>
        <h2>Seu treino da academia, agora no celular.</h2>
        <p>Digitalize sua ficha, acompanhe suas cargas e veja sua evolução em um só lugar.</p>
        <div className="auth-benefits" aria-label="Recursos principais">
          <span>Ficha por foto</span>
          <span>Cronômetro</span>
          <span>Histórico</span>
        </div>
      </div>
      <img className="auth-brand-mascot" src="/summer-fit-mascot.jpeg" alt="" aria-hidden="true" />
    </section>
    <section className="auth-card" aria-labelledby="auth-title">
      <div className="auth-logo">
        <img className="auth-academy-logo" src="/summer-fit-brand.jpeg" alt="Summer Fit" width={280} height={78} />
      </div>
      <div className="auth-heading"><div className="auth-icon"><Dumbbell size={22} /></div><p className="eyebrow">UM TREINO DE CADA VEZ</p><h1 id="auth-title">{mode === 'login' ? 'Seu próximo passo começa aqui.' : mode === 'signup' ? 'Vamos começar?' : 'Recupere seu acesso'}</h1><p>{mode === 'login' ? 'Suas fichas, sua rotina e cada conquista em um só lugar.' : mode === 'signup' ? 'Informe sua matrícula da academia. O acesso será liberado após a conferência.' : 'Enviaremos um link para você escolher uma nova senha.'}</p></div>
      <form className="auth-form" onSubmit={handleSubmit} aria-busy={loading}>
        {mode === 'signup' && <label>Seu nome<input value={name} onChange={e => setName(e.target.value)} placeholder="Como podemos chamar você?" autoComplete="name" maxLength={80} required /></label>}
        {mode === 'signup' && <label>Matrícula da academia<div className="input-with-icon"><IdCard size={17} aria-hidden="true" /><input type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} value={registration} onChange={e => setRegistration(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="4 números" autoComplete="off" required /></div><small className="field-help">Use o número de matrícula fornecido pela academia.</small></label>}
        <label>E-mail<div className="input-with-icon"><Mail size={17} aria-hidden="true" /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" autoCapitalize="none" required /></div></label>
        {mode !== 'reset' && <label>Senha<div className="input-with-icon"><LockKeyhole size={17} aria-hidden="true" /><input type={visible ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === 'signup' ? 'Pelo menos 8 caracteres' : 'Sua senha'} minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required /><button type="button" className="password-toggle" onClick={() => setVisible(!visible)} aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <button className="primary-button auth-submit" disabled={loading}>{loading ? 'AGUARDE...' : mode === 'login' ? 'ENTRAR' : mode === 'signup' ? 'CRIAR CONTA' : 'ENVIAR LINK'}<ArrowRight size={17} /></button>
      </form>
      {mode === 'login' && <button className="auth-switch" disabled={loading} onClick={() => switchMode('reset')}>Esqueci minha senha</button>}
      <button className="auth-switch" disabled={loading} onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}>{mode === 'login' ? 'É sua primeira vez? Crie uma conta' : 'Voltar para entrar'}</button>
      <p className="auth-footnote">No computador, no Android ou no Safari do iPhone.</p>
    </section>
  </main>
}
