'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { communityError, type Membership, type Challenge, type Story } from '@/lib/community';
import { PrivateStoryPhoto } from './community-panel';
import s from './community.module.css';
type Member = Membership & { email: string; registration: string };
type Report = { id: number; story_id: string; reason: string; created_at: string };
export function CommunityAdmin() {
  const [members,setMembers]=useState<Member[]>([]);const [reports,setReports]=useState<Report[]>([]);
  const [stories,setStories]=useState<Story[]>([]);const [challenges,setChallenges]=useState<Challenge[]>([]);
  const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');const [loading,setLoading]=useState(true);
  const [page,setPage]=useState(0);const [total,setTotal]=useState(0);const [query,setQuery]=useState('');const [search,setSearch]=useState('');
  const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [target,setTarget]=useState('12');
  const [start,setStart]=useState('');const [end,setEnd]=useState('');const lock=useRef(false);const request=useRef(0);
  const load=useCallback(async()=>{
    const run=++request.current;setLoading(true);
    try {
      const db=createClient();
      const [m,r,c]=await Promise.all([
        db.rpc('summer_community_members_admin',{p_page:page,p_search:search}),
        db.from('summer_story_reports').select('*').eq('resolved',false).order('created_at').limit(50),
        db.from('summer_challenges').select('*').order('created_at',{ascending:false}).limit(50)
      ]);
      if(m.error || r.error || c.error)throw m.error||r.error||c.error;
      const ids=[...new Set((r.data||[]).map(x=>x.story_id))];
      const photos=ids.length ? await db.from('summer_community_stories').select('*').in('id',ids) : {data:[],error:null};
      if(photos.error)throw photos.error;
      if(run!==request.current)return;
      setMembers(m.data.members||[]);setTotal(m.data.total||0);setReports(r.data||[]);setChallenges(c.data||[]);setStories(photos.data||[]);
    } catch { if(run===request.current)setMessage('Comunidade indisponível. Confira a conexão e se a migração de aprovação da comunidade já foi aplicada no Supabase.'); }
    finally { if(run===request.current)setLoading(false); }
  },[page,search]);
  useEffect(()=>{void load();return()=>{request.current++;};},[load]);
  async function act(action:()=>Promise<void>,success:string){
    if(lock.current)return;lock.current=true;setBusy(true);setMessage('');
    try{await action();setMessage(success);await load();}catch(e){setMessage(communityError(e));}finally{lock.current=false;setBusy(false);}
  }
  return <section className={s.panel} aria-label="Administração da comunidade">
    <div className={s.hero}><p className={s.eyebrow}>ALUNOS APROVADOS POR VOCÊ</p><h2>Comunidade e desafios</h2><p>A aprovação aqui é independente do plano. Confirme o vínculo com a academia antes de liberar.</p></div>
    <button disabled={busy||loading} onClick={()=>void load()}>Atualizar comunidade</button>
    <div role="status">{loading&&<p>Carregando…</p>}{message&&<p className={s.notice}>{message}</p>}</div>
    <div className={s.card}><h3>Solicitações e membros</h3>
      <form className={s.form} onSubmit={e=>{e.preventDefault();setPage(0);setSearch(query.trim());}}><label>Buscar nome, e-mail ou matrícula<input value={query} maxLength={100} onChange={e=>setQuery(e.target.value)} /></label><button disabled={busy}>Buscar membro</button></form>
      {!loading&&!members.length&&<p>Nenhuma solicitação encontrada.</p>}
      {members.map(m=><div key={m.user_id} className={s.row}><div><strong>{m.display_name}</strong><p className={s.meta}>{m.email} · Matrícula: {m.registration||'Não informada'}</p><p>{({pending:'Aguardando aprovação',approved:'Aprovado',rejected:'Recusado',suspended:'Suspenso'})[m.status]}</p></div><div className={s.actions}>
        {(['approved','rejected','suspended'] as const).filter(status=>status!==m.status).map(status=><button key={status} className={status==='approved'?s.primary:undefined} disabled={busy} onClick={()=>{
          const label={approved:'Aprovar',rejected:'Recusar',suspended:'Suspender'}[status];if(!window.confirm(`${label} o acesso de ${m.display_name} (${m.email}) à comunidade?`))return;
          void act(async()=>{const {data,error}=await createClient().from('summer_community_members').update({status}).eq('user_id',m.user_id).select('user_id');if(error||!data?.length)throw error||new Error();},'Acesso atualizado.');
        }}>{({approved:'Aprovar',rejected:'Recusar',suspended:'Suspender'})[status]}</button>)}
      </div></div>)}
      <div className={s.actions}><button disabled={page===0||loading||busy} onClick={()=>setPage(p=>p-1)}>Anterior</button><span>Página {page+1} · {total} membros</span><button disabled={(page+1)*20>=total||loading||busy} onClick={()=>setPage(p=>p+1)}>Próxima</button></div>
    </div>
    <div className={s.card}><h3>Denúncias pendentes</h3>{!reports.length&&<p>Nenhuma denúncia pendente.</p>}
      {reports.map(r=>{const story=stories.find(x=>x.id===r.story_id);return <article key={r.id} className={s.card}><strong>{story?.author_name||'Story removido'}</strong><p>{r.reason}</p>{story&&story.status==='published'&&Date.parse(story.expires_at)>Date.now()&&<PrivateStoryPhoto story={story}/>}<div className={s.actions}>
        <button disabled={busy} onClick={()=>{if(!window.confirm('Remover este story da comunidade e concluir a denúncia?'))return;void act(async()=>{
          const db=createClient();const hidden=await db.rpc('summer_story_action',{p_action:'hide',p_id:r.story_id});if(hidden.error)throw hidden.error;
          const reviewed=await db.from('summer_story_reports').update({resolved:true}).eq('story_id',r.story_id);if(reviewed.error)throw reviewed.error;
        },'Story removido.');}}>Remover story</button>
        <button disabled={busy} onClick={()=>void act(async()=>{const {error}=await createClient().from('summer_story_reports').update({resolved:true}).eq('id',r.id);if(error)throw error;},'Denúncia arquivada.')}>Arquivar denúncia</button>
      </div></article>;})}
    </div>
    <form className={`${s.card} ${s.form}`} onSubmit={e=>{e.preventDefault();void act(async()=>{
      const {error}=await createClient().from('summer_challenges').insert({title:title.trim(),description:description.trim(),target:Number(target),starts_on:start,ends_on:end});if(error)throw error;
      setTitle('');setDescription('');
    },'Desafio publicado para os alunos aprovados.');}}>
      <h3>Criar desafio</h3><p>Escolha atividades adequadas aos alunos. Cada check-in é uma declaração do participante; não é verificação automática do treino.</p>
      <label>Título<input value={title} minLength={3} maxLength={100} required onChange={e=>setTitle(e.target.value)} placeholder="12 dias de movimento" /></label>
      <label>Orientações<textarea value={description} maxLength={1000} required onChange={e=>setDescription(e.target.value)} /></label>
      <label>Meta de dias<input type="number" min={1} max={365} required value={target} onChange={e=>setTarget(e.target.value)} /></label>
      <div className={s.dates}><label>Início<input type="date" value={start} required onChange={e=>setStart(e.target.value)} /></label><label>Fim<input type="date" min={start} value={end} required onChange={e=>setEnd(e.target.value)} /></label></div>
      <small>A meta não pode superar os dias disponíveis. Duração máxima: 366 dias.</small>
      <button className={s.primary} disabled={busy}>Publicar desafio</button>
    </form>
    <div className={s.card}><h3>Desafios publicados</h3>{challenges.map(c=><div className={s.row} key={c.id}><strong>{c.title}</strong><button disabled={busy||!c.active} onClick={()=>{if(!window.confirm('Encerrar este desafio? Não será possível fazer novos check-ins.'))return;void act(async()=>{const {error}=await createClient().from('summer_challenges').update({active:false}).eq('id',c.id);if(error)throw error;},'Desafio encerrado.');}}>{c.active?'Encerrar desafio':'Encerrado'}</button></div>)}</div>
  </section>;
}
