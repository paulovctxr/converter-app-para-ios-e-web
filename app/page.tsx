'use client'

import { useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  Flame,
  Gauge,
  Home,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  Settings,
  Target,
  TrendingUp,
  UserRound,
  X,
} from 'lucide-react'

type Workout = { title: string; focus: string; exercises: number; duration: string }

const initialWorkouts: Workout[] = [
  { title: 'Peito + Tríceps', focus: 'Força e hipertrofia', exercises: 8, duration: '45 min' },
  { title: 'Pernas + Glúteos', focus: 'Força e mobilidade', exercises: 10, duration: '52 min' },
]

const bars = [34, 52, 45, 68, 58, 76, 88]
const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D']

export default function Page() {
  const [activeTab, setActiveTab] = useState('Início')
  const [showForm, setShowForm] = useState(false)
  const [workouts, setWorkouts] = useState(initialWorkouts)
  const [completed, setCompleted] = useState(false)
  const [form, setForm] = useState({ title: '', focus: '', exercises: '3', duration: '45 min' })

  const progress = useMemo(() => (completed ? 80 : 60), [completed])

  function saveWorkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.title.trim() || !form.focus.trim()) return
    setWorkouts((current) => [...current, { title: form.title.trim(), focus: form.focus.trim(), exercises: Number(form.exercises) || 1, duration: form.duration || '30 min' }])
    setForm({ title: '', focus: '', exercises: '3', duration: '45 min' })
    setShowForm(false)
    setActiveTab('Treinos')
  }

  const navItems = [
    { label: 'Início', icon: Home },
    { label: 'Treinos', icon: Dumbbell },
    { label: 'Progresso', icon: TrendingUp },
    { label: 'Perfil', icon: UserRound },
  ]

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand"><img src="/summer-fit-logo.webp" alt="Summer Fit" /><span>SUMMER FIT</span></div>
        <div className="sidebar-profile"><div className="avatar">JP</div><div><strong>João Paulo</strong><small>Plano Premium</small></div><MoreHorizontal size={18} /></div>
        <nav className="desktop-nav" aria-label="Navegação principal">
          {navItems.map(({ label, icon: Icon }) => <button key={label} className={activeTab === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(label)}><Icon size={19} />{label}</button>)}
        </nav>
        <div className="sidebar-bottom"><button className="nav-item"><Settings size={19} />Configurações</button><button className="help-link"><CircleHelp size={17} />Central de ajuda</button></div>
      </aside>

      <section className="content-area">
        <header className="topbar"><button className="mobile-menu" aria-label="Abrir menu"><Menu size={22} /></button><div className="topbar-location"><span className="status-dot" />Academia Summer Fit <span className="muted">·</span> Unidade Centro</div><div className="topbar-actions"><button className="icon-button" aria-label="Notificações"><Bell size={19} /></button><div className="top-avatar">JP</div></div></header>
        <div className="page-content">
          <div className="welcome-row"><div><p className="eyebrow">QUARTA-FEIRA, 25 DE SETEMBRO</p><h1>Olá, João <span>☀</span></h1><p className="lead">A academia que vai esquentar o seu dia.</p></div><button className="secondary-button calendar-button"><CalendarDays size={17} />Ver agenda</button></div>

          {activeTab === 'Início' && <>
            <section className="hero-card"><div className="hero-content"><div className="pill">SEU TREINO DE HOJE</div><h2>Peito + Tríceps</h2><p>Força e hipertrofia <span>·</span> 8 exercícios <span>·</span> 45 min</p><div className="hero-actions"><button className="primary-button" onClick={() => setCompleted(true)}><Play size={17} fill="currentColor" />{completed ? 'TREINO CONCLUÍDO' : 'COMEÇAR AGORA'}</button><button className="hero-more" aria-label="Mais opções"><MoreHorizontal size={20} /></button></div></div><div className="hero-art"><div className="sun-ring" /><Dumbbell size={88} strokeWidth={1.2} /></div></section>
            <div className="stats-grid"><article className="stat-card"><div className="stat-icon yellow"><Target size={18} /></div><div className="stat-title">CONSISTÊNCIA SEMANAL</div><strong>{completed ? '4' : '3'} <small>/ 5 treinos</small></strong><div className="progress-track"><span style={{ width: `${progress}%` }} /></div><p><Flame size={14} /> Você está no ritmo certo</p></article><article className="stat-card"><div className="stat-icon red"><Gauge size={18} /></div><div className="stat-title">TEMPO EM MOVIMENTO</div><strong>2h 48 <small>esta semana</small></strong><div className="stat-spark"><span /><span /><span /><span /><span /><span /><span /></div><p className="neutral">+18% comparado à semana passada</p></article><article className="stat-card premium-stat"><div className="stat-title">SEU NÍVEL ATUAL</div><strong>Intermediário</strong><p className="neutral">Continue evoluindo para avançado</p><div className="level-dots"><i /><i /><i /><i /><i /></div></article></div>
            <div className="section-heading"><div><h3>Meus treinos</h3><p>Suas fichas personalizadas para cada objetivo.</p></div><button className="text-button" onClick={() => setActiveTab('Treinos')}>Ver todos <ChevronRight size={16} /></button></div>
            <div className="workout-list">{workouts.slice(0, 3).map((workout, index) => <button className="workout-row" key={`${workout.title}-${index}`} onClick={() => setActiveTab('Treinos')}><div className={`workout-icon ${index === 0 ? 'gold-icon' : 'coral-icon'}`}><Dumbbell size={20} /></div><div className="workout-copy"><strong>{workout.title}</strong><span>{workout.focus} <b>·</b> {workout.exercises} exercícios</span></div><span className="workout-duration">{workout.duration}</span><ChevronRight size={18} /></button>)}</div>
            <button className="add-card" onClick={() => { setShowForm(true); setActiveTab('Treinos') }}><span><Plus size={19} /></span><div><strong>Monte seu próximo treino</strong><small>Você escolhe o foco, os exercícios e a duração.</small></div><ChevronRight size={18} /></button>
          </>}

          {activeTab === 'Treinos' && <section className="tab-panel"><div className="section-heading"><div><p className="eyebrow">ORGANIZE SUA ROTINA</p><h2 className="panel-title">Meus treinos</h2><p>Monte sua própria ficha do seu jeito.</p></div><button className="primary-button" onClick={() => setShowForm((value) => !value)}>{showForm ? <X size={17} /> : <Plus size={17} />}{showForm ? 'FECHAR' : 'CRIAR MEU TREINO'}</button></div>{showForm && <form className="form-card" onSubmit={saveWorkout}><h3>Novo treino</h3><label>Nome do treino<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Ex.: Treino de pernas" required /></label><label>Foco muscular<input value={form.focus} onChange={(event) => setForm({ ...form, focus: event.target.value })} placeholder="Ex.: Pernas + Glúteos" required /></label><div className="form-grid"><label>Exercícios<input type="number" min="1" value={form.exercises} onChange={(event) => setForm({ ...form, exercises: event.target.value })} /></label><label>Duração<input value={form.duration} onChange={(event) => setForm({ ...form, duration: event.target.value })} /></label></div><button className="primary-button full-button" type="submit">SALVAR TREINO</button></form>}<div className="panel-list">{workouts.map((workout, index) => <article className="large-workout" key={`${workout.title}-${index}`}><div className={`workout-icon ${index === 0 ? 'gold-icon' : 'coral-icon'}`}><Dumbbell size={21} /></div><div className="workout-copy"><strong>{workout.title}</strong><span>{workout.focus}</span></div><div className="workout-meta"><span>{workout.exercises} exercícios</span><span>{workout.duration}</span></div><button className="small-start" onClick={() => setCompleted(true)}>INICIAR <Play size={14} fill="currentColor" /></button></article>)}</div></section>}

          {activeTab === 'Progresso' && <section className="tab-panel"><p className="eyebrow">ACOMPANHE SUA JORNADA</p><h2 className="panel-title">Progresso</h2><p className="lead">Cada treino conta. Veja sua constância.</p><div className="progress-highlight"><div><div className="stat-title">TREINOS REALIZADOS</div><strong>24</strong><p>+18% vs. mês anterior</p></div><div className="adherence"><strong>86%</strong><span>aderência</span></div></div><article className="chart-card"><div className="section-heading"><h3>Frequência semanal</h3><span>Esta semana</span></div><div className="chart">{bars.map((height, index) => <div className="bar-column" key={`${height}-${index}`}><div className="bar-track"><i style={{ height: `${height}%` }} /></div><small>{days[index]}</small></div>)}</div></article></section>}

          {activeTab === 'Perfil' && <section className="tab-panel profile-panel"><div className="profile-big-avatar">JP</div><p className="eyebrow">SEU PERFIL</p><h2 className="panel-title">João Paulo</h2><p className="lead">Membro Premium · desde janeiro de 2024</p><button className="secondary-button"><Settings size={17} />Editar preferências</button></section>}
        </div>
        <nav className="mobile-nav" aria-label="Navegação mobile">{navItems.map(({ label, icon: Icon }) => <button key={label} className={activeTab === label ? 'mobile-nav-item active' : 'mobile-nav-item'} onClick={() => setActiveTab(label)}><Icon size={20} /><span>{label}</span></button>)}</nav>
      </section>
    </main>
  )
}
