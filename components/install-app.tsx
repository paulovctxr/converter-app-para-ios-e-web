'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, MonitorDown, MoreVertical, Plus, Share2, Smartphone, X } from 'lucide-react';
import s from './install-app.module.css';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
export function InstallApp() {
  const [prompt,setPrompt]=useState<InstallEvent|null>(null);const [installed,setInstalled]=useState(false);
  const pendingPrompt=useRef<InstallEvent|null>(null);
  const installing=useRef(false);
  const [error,setError]=useState('');
  const [device,setDevice]=useState<'ios'|'android'|'desktop'>('desktop');const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const mode=window.matchMedia('(display-mode: standalone)');
    const sync=()=>setInstalled(mode.matches || (navigator as Navigator & {standalone?:boolean}).standalone===true);
    sync();
    const ua=navigator.userAgent.toLowerCase();
    setDevice(/iphone|ipad|ipod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/android/.test(ua)?'android':'desktop');
    const capture=(event:Event)=>{event.preventDefault();pendingPrompt.current=event as InstallEvent;setPrompt(event as InstallEvent);setError('');};
    const done=()=>{setInstalled(true);pendingPrompt.current=null;setPrompt(null);setOpen(false);};
    window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);mode.addEventListener('change',sync);
    return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);mode.removeEventListener('change',sync);};
  },[]);
  if(installed)return null;
  async function install() {
    if (installing.current) return;
    const event=pendingPrompt.current;
    if (!event) { setError(''); setOpen(true); return; }
    installing.current=true;
    // A native install event can only be used once. Consume it before awaiting.
    pendingPrompt.current=null;
    setPrompt(null);
    setError('');
    setBusy(true);
    try {
      // Keep prompt() in the original click gesture: no async work before it.
      await event.prompt();
      await event.userChoice;
      setOpen(false);
    } catch {
      setError('Não foi possível abrir a instalação. Você pode tentar pelo menu do navegador seguindo as orientações abaixo.');
      setOpen(true);
    } finally { installing.current=false; setBusy(false); }
  }
  return <>
    <button type="button" className={s.floating} aria-label="Instalar Summer Fit" disabled={busy} aria-busy={busy} onClick={()=>void install()}>
      <Smartphone size={20} aria-hidden="true" /><span>{busy?'Abrindo…':'Instalar'}</span><Download size={17} aria-hidden="true" />
    </button>
    {open && <div className={s.overlay} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className={s.close} aria-label="Fechar instalação" onClick={()=>setOpen(false)}><X size={22}/></button>
        <div className={s.modalBrand}><img src="/summer-fit-round.png" alt=""/><div><p>SUMMER FIT</p><h2 id="install-title">Instalar no dispositivo</h2></div></div>
        <div className={s.rule}/>
        {error && <p className={s.intro} role="alert">{error}</p>}
        {prompt ? <>
          <p className={s.intro}>Adicione o Summer Fit à sua tela inicial. Toque abaixo e confirme a instalação na janela do navegador.</p>
          <button type="button" className={s.confirm} disabled={busy} onClick={()=>void install()}>{busy?'Abrindo…':'Instalar agora'}</button>
        </> : device==='ios' ? <>
          <p className={s.intro}>Para instalar no seu iPhone ou iPad:</p>
          <div className={s.step}><span className={s.stepIcon}><Share2 size={21}/></span><div><strong>1. Toque em Compartilhar</strong><small>Na barra inferior do Safari.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Plus size={22}/></span><div><strong>2. Adicionar à Tela de Início</strong><small>Role o menu para baixo e selecione essa opção.</small></div></div>
        </> : device==='android' ? <>
          <p className={s.intro}>A instalação direta ainda não está disponível neste navegador. Se abriu pelo Instagram ou WhatsApp, abra o site no Chrome. Você também pode instalar pelo menu:</p>
          <div className={s.step}><span className={s.stepIcon}><MoreVertical size={22}/></span><div><strong>1. Abra o menu do navegador</strong><small>Toque nos três pontos no Chrome.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Download size={21}/></span><div><strong>2. Instalar aplicativo</strong><small>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</small></div></div>
        </> : <>
          <p className={s.intro}>Para instalar no computador:</p>
          <div className={s.step}><span className={s.stepIcon}><MonitorDown size={22}/></span><div><strong>1. Procure o ícone de instalação</strong><small>Ele aparece na barra de endereço do Chrome ou Edge.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Download size={21}/></span><div><strong>2. Clique em Instalar</strong><small>O Summer Fit será aberto como um aplicativo.</small></div></div>
        </>}
        <button type="button" className={s.understood} onClick={()=>setOpen(false)}>Entendido</button>
        <p className={s.note}>A instalação depende do navegador e está disponível somente em conexão HTTPS.</p>
      </section>
    </div>}
  </>;
}
