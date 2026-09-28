'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BUCKET, brazilDay, communityError, prepareStoryPhoto, type Membership, type Story, type Challenge, type Checkin } from '@/lib/community';
import s from './community.module.css';

export function PrivateStoryPhoto({ story }: { story: Story }) {
  const [url, setUrl] = useState('');
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false; let blobUrl = '';
    setUrl(''); setFailed(false);
    void createClient().storage.from(BUCKET).download(story.image_path).then(({ data, error }) => {
      if (disposed) return;
      if (error || !data) { setFailed(true); return; }
      blobUrl = URL.createObjectURL(data); setUrl(blobUrl);
    }).catch(() => { if (!disposed) setFailed(true); });
    return () => { disposed = true; if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [story.image_path]);
  return url ? <img className={s.photo} src={url} alt={`Story de ${story.author_name}`} /> : <p className={s.meta}>{failed ? 'Foto indisponível ou expirada.' : 'Carregando foto…'}</p>;
}

export function CommunityPanel({ userId, name }: { userId: string; name: string }) {
  const [member, setMember] = useState<Membership | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const request = useRef(0);
  const [tab, setTab] = useState<'stories' | 'challenges'>('stories');
  const [displayName, setDisplayName] = useState(name);
  const [stories, setStories] = useState<Story[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [joined, setJoined] = useState<string[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [consent, setConsent] = useState(false);
  const [tick, setTick] = useState(Date.now());
  const fileRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const run = ++request.current;
    try {
      const db = createClient();
      const [access, membership] = await Promise.all([db.rpc('summer_community_allowed'), db.from('summer_community_members').select('*').eq('user_id',userId).maybeSingle()]);
      if (access.error || membership.error) throw access.error || membership.error;
      if (run !== request.current) return;
      setAllowed(access.data === true); setMember(membership.data); setError('');
      if (!access.data) { setStories([]); setChallenges([]); return; }
      const [feed, tasks, enrollments, entries] = await Promise.all([
        db.from('summer_community_stories').select('*').eq('status','published').gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(30),
        db.from('summer_challenges').select('*').order('created_at',{ascending:false}).limit(50),
        db.from('summer_challenge_members').select('challenge_id').eq('user_id',userId),
        db.from('summer_challenge_checkins').select('challenge_id,day').eq('user_id',userId).gte('day',brazilDay(new Date(Date.now()-366*86400000))).limit(2000),
      ]);
      if (feed.error || tasks.error || enrollments.error || entries.error) throw feed.error || tasks.error || enrollments.error || entries.error;
      if (run !== request.current) return;
      setStories(feed.data || []); setChallenges(tasks.data || []); setJoined((enrollments.data || []).map(e=>e.challenge_id)); setCheckins(entries.data || []);
    } catch {
      if (run === request.current) { setAllowed(false); setStories([]); setChallenges([]); setError('Não foi possível carregar a comunidade. Confira a conexão. Se esta é a primeira publicação, o administrador precisa ativar a estrutura no Supabase.'); }
    } finally { if (run === request.current) setLoading(false); }
  },[userId]);
  useEffect(() => {
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const interval = window.setInterval(() => { setTick(Date.now()); refresh(); },30000);
    window.addEventListener('focus',refresh);
    return () => { request.current++; clearInterval(interval); window.removeEventListener('focus',refresh); };
  },[load]);
  async function act(work: () => Promise<void>, success: string) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setNotice('');
    try { await work(); setNotice(success); await load(); }
    catch(e) { setNotice(communityError(e)); }
    finally { lock.current = false; setBusy(false); }
  }
  async function publish() {
    if (!file || !consent || lock.current) return;
    await act(async () => {
      let photo: Blob;
      try { photo = await prepareStoryPhoto(file); } catch(e) { throw {code:'PHOTO_VALIDATION',message:(e as Error).message}; }
      const db = createClient();
      const {data, error} = await db.rpc('summer_story_action',{p_action:'create',p_caption:caption});
      if (error) throw error;
      const story = data as Story;
      try {
        const upload = await db.storage.from(BUCKET).upload(story.image_path,photo,{contentType:'image/jpeg',cacheControl:'0',upsert:false});
        if (upload.error) throw upload.error;
        const result = await db.rpc('summer_story_action',{p_action:'publish',p_id:story.id});
        if (result.error) throw result.error;
      } catch(e) { await db.rpc('summer_story_action',{p_action:'hide',p_id:story.id}); throw e; }
      setFile(null); setCaption(''); setConsent(false); if(fileRef.current) fileRef.current.value='';
    },'Story publicado! Ele ficará visível por 24 horas.');
  }
  const today = brazilDay(new Date(tick));
  const visible = stories.filter(story=>Date.parse(story.expires_at)>tick);
  return <section className={s.panel}>
    <header className={s.hero}><p className={s.eyebrow}>JUNTOS, A GENTE VAI MAIS LONGE</p><h2>Comunidade Summer</h2><p>Seu treino inspira. Compartilhe conquistas e participe dos desafios da academia.</p></header>
    <button disabled={busy || loading} onClick={()=>void load()}>Atualizar</button>
    <div role="status" aria-live="polite">{notice && <p className={s.notice}>{notice}</p>}{loading && <p>Carregando comunidade…</p>}{error && <p className={s.notice}>{error}</p>}</div>
    {!loading && !error && !allowed && <div className={s.card}>
      <h3>Exclusivo para alunos aprovados</h3>
      {!member ? <form className={s.form} onSubmit={e=>{e.preventDefault();void act(async()=>{const {error}=await createClient().from('summer_community_members').insert({display_name:displayName.trim()});if(error)throw error;},'Solicitação enviada. Aguarde a aprovação da academia.');}}>
        <p>O administrador confirma seu vínculo com a academia. Ser Summer PRO não substitui essa aprovação.</p>
        <label>Nome para identificação e publicação<input minLength={2} maxLength={80} required value={displayName} onChange={e=>setDisplayName(e.target.value)} /></label>
        <button className={s.primary} disabled={busy}>Solicitar acesso à comunidade</button>
      </form> : <p>{member.status==='pending' ? 'Sua solicitação está aguardando aprovação. Você pode continuar usando seus treinos normalmente.' : member.status==='suspended' ? 'Seu acesso à comunidade está suspenso. Converse com a administração da academia.' : 'Sua solicitação não foi aprovada. Converse com a administração para conferir seu cadastro.'}</p>}
    </div>}
    {allowed && !error && <>
      <div className={s.tabs} aria-label="Seções da comunidade"><button aria-pressed={tab==='stories'} onClick={()=>setTab('stories')}>Stories</button><button aria-pressed={tab==='challenges'} onClick={()=>setTab('challenges')}>Desafios</button></div>
      {tab==='stories' ? <>
        <form className={`${s.card} ${s.form}`} onSubmit={e=>{e.preventDefault();void publish();}}>
          <h3>Compartilhe seu momento</h3>
          <label>Foto do story<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" required onChange={e=>setFile(e.target.files?.[0] || null)} /></label>
          <label>Legenda<textarea maxLength={300} rows={2} placeholder="Mais um treino na conta!" value={caption} onChange={e=>setCaption(e.target.value)} /></label>
          <label className={s.consent}><input type="checkbox" checked={consent} required onChange={e=>setConsent(e.target.checked)} />Entendo que a foto e meu nome serão vistos pelos membros aprovados durante 24 horas. Tenho autorização de quem aparece na foto.</label>
          <small className={s.meta}>Até 5 envios em 24 horas. Sem conteúdo ofensivo ou exposição de dados pessoais. Outros membros podem fazer capturas da tela.</small>
          <button className={s.primary} disabled={busy || !file || !consent}>{busy ? 'Enviando…' : 'Publicar story'}</button>
        </form>
        {!visible.length && <div className={s.card}><h3>O próximo momento pode ser o seu.</h3><p>Ainda não há stories ativos. Compartilhe uma conquista!</p></div>}
        <div className={s.grid}>{visible.map(story=><article key={story.id} className={s.card}>
          <strong>{story.author_name}</strong><p className={s.meta}>Até {new Date(story.expires_at).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</p>
          <PrivateStoryPhoto story={story} /><p>{story.caption}</p>
          {story.user_id===userId ? <button disabled={busy} onClick={()=>{if(window.confirm('Excluir este story?'))void act(async()=>{const {error}=await createClient().rpc('summer_story_action',{p_action:'hide',p_id:story.id});if(error)throw error;},'Story removido da comunidade.');}}>Excluir meu story</button>
          : <button disabled={busy} onClick={()=>{const reason=window.prompt('Qual o motivo da denúncia? (3 a 500 caracteres)');if(!reason || reason.trim().length<3 || reason.length>500)return;void act(async()=>{const {error}=await createClient().from('summer_story_reports').insert({story_id:story.id,reason:reason.trim()});if(error)throw error;},'Denúncia enviada ao administrador.');}}>Denunciar</button>}
        </article>)}</div>
        {visible.length>=30 && <p className={s.meta}>Mostrando os 30 stories mais recentes.</p>}
      </> : <>
        <p>Desafios de constância, no seu ritmo. Check-ins são informados por você, no máximo um por dia (horário de Brasília). Respeite seu descanso e sua orientação profissional.</p>
        {!challenges.length && <div className={s.card}>A academia ainda não publicou desafios. Volte em breve!</div>}
        <div className={s.grid}>{challenges.map(c=>{
          const entries=checkins.filter(i=>i.challenge_id===c.id);const done=entries.length;const checked=entries.some(i=>i.day===today);const participating=joined.includes(c.id);const active=c.active && today>=c.starts_on && today<=c.ends_on;
          return <article className={s.card} key={c.id}><p className={s.meta}>{!c.active?'Encerrado':today<c.starts_on?'Em breve':today>c.ends_on?'Finalizado':'Em andamento'}</p><h3>{c.title}</h3><p>{c.description}</p><p className={s.meta}>{c.starts_on.split('-').reverse().join('/')} a {c.ends_on.split('-').reverse().join('/')}</p><p>{done} de {c.target} dias concluídos</p><progress value={Math.min(done,c.target)} max={c.target} aria-label={`Progresso em ${c.title}`} />
          <div className={s.actions}>{!participating ? <button className={s.primary} disabled={busy || !c.active || today>c.ends_on} onClick={()=>void act(async()=>{const {error}=await createClient().from('summer_challenge_members').insert({challenge_id:c.id});if(error)throw error;},'Você está participando!')}>Participar</button>
          : <button className={s.primary} disabled={busy || !active || checked || done>=c.target} onClick={()=>void act(async()=>{const {error}=await createClient().from('summer_challenge_checkins').insert({challenge_id:c.id});if(error)throw error;},'Check-in registrado!')}>{done>=c.target?'Desafio concluído!':checked?'Hoje já está registrado':'Concluir atividade de hoje'}</button>}</div></article>;
        })}</div>
      </>}
    </>}
  </section>;
}
