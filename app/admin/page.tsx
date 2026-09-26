import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminPanel } from '@/components/admin-panel'

export const dynamic = 'force-dynamic'
export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data, error } = await supabase.rpc('summer_is_admin')
  if (error) return <main className="auth-shell"><section className="auth-card"><h1>Painel indisponível</h1><p>O gerenciamento de planos ainda precisa ser ativado ou não pôde ser consultado. Tente novamente mais tarde.</p><a className="secondary-button" href="/">Voltar ao aplicativo</a></section></main>
  if (data !== true) return <main className="auth-shell"><section className="auth-card"><h1>Acesso restrito</h1><p>Esta área é exclusiva da administração da Summer Fit.</p><a className="secondary-button" href="/">Voltar ao aplicativo</a></section></main>
  return <AdminPanel />
}
