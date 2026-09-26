'use client'
import { useEffect, useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('Verificando seu link...')
  useEffect(() => {
    let mounted = true
    async function check() { try { const { data, error } = await createClient().auth.getUser(); if (mounted) { setReady(Boolean(data.user) && !error); setMessage(data.user && !error ? '' : 'Este link expirou. Volte para entrar e solicite um novo link.') } } catch { if (mounted) setMessage('Não foi possível verificar seu acesso. Tente novamente.') } }
    void check(); return () => { mounted = false }
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return
    if (password !== confirmation) { setMessage('As senhas precisam ser iguais.'); return }
    setBusy(true)
    try { const { error } = await createClient().auth.updateUser({ password }); if (error) { setMessage('Não foi possível atualizar. Use uma senha diferente da anterior e tente novamente.'); return } window.location.replace('/') }
    catch { setMessage('Não foi possível conectar. Tente novamente.') } finally { setBusy(false) }
  }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow">SUMMER FIT</p><h1>Nova senha</h1><form className="auth-form" onSubmit={submit}><label>Nova senha<input type="password" minLength={8} autoComplete="new-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><label>Repita a senha<input type="password" minLength={8} autoComplete="new-password" required value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label><p className="auth-message" role="status">{message}</p><button className="primary-button" disabled={!ready || busy}>{busy ? 'SALVANDO...' : 'SALVAR NOVA SENHA'}</button><a className="auth-switch" href="/">Voltar para entrar</a></form></section></main>
}
