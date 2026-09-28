'use client';
import { useEffect, useState } from 'react';
import { Download, MonitorDown, MoreVertical, Plus, Share2, Smartphone, X } from 'lucide-react';
import s from './install-app.module.css';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
export function InstallApp() {
  const [prompt,setPrompt]=useState<InstallEvent|null>(null);const [installed,setInstalled]=useState(false);
  const [device,setDevice]=useState<'ios'|'android'|'desktop'>('desktop');const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const mode=window.matchMedia('(display-mode: standalone)');
    const sync=()=>setInstalled(mode.matches || (navigator as Navigator & {standalone?:boolean}).standalone===true);
    sync();
    const ua=navigator.userAgent.toLowerCase();
    setDevice(/iphone|ipad|ipod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1)?'ios':/android/.test(ua)?'android':'desktop');
    const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);mode.addEventListener('change',sync);
    return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);mode.removeEventListener('change',sync);};
  },[]);
  if(installed)return null;
  async function install() {
    if (!prompt) return;
    setBusy(true);
    try { await prompt.prompt(); await prompt.userChoice; setPrompt(null); setOpen(false); }
    finally { setBusy(false); }
  }
  return <>
    <button type="button" className={s.floating} aria-label="Instalar Summer Fit" onClick={()=>setOpen(true)}>
      <Smartphone size={20} aria-hidden="true" /><span>Instalar</span><Download size={17} aria-hidden="true" />
    </button>
    {open && <div className={s.overlay} role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setOpen(false)}}>
      <section className={s.modal} role="dialog" aria-modal="true" aria-labelledby="install-title">
        <button type="button" className={s.close} aria-label="Fechar instalação" onClick={()=>setOpen(false)}><X size={22}/></button>
        <div className={s.modalBrand}><img src="/summer-fit-round.png" alt=""/><div><p>SUMMER FIT</p><h2 id="install-title">Instalar no dispositivo</h2></div></div>
        <div className={s.rule}/>
        {device==='ios' ? <>
          <p className={s.intro}>Para instalar no seu iPhone ou iPad:</p>
          <div className={s.step}><span className={s.stepIcon}><Share2 size={21}/></span><div><strong>1. Toque em Compartilhar</strong><small>Na barra inferior do Safari.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Plus size={22}/></span><div><strong>2. Adicionar à Tela de Início</strong><small>Role o menu para baixo e selecione essa opção.</small></div></div>
        </> : device==='android' ? <>
          <p className={s.intro}>Para instalar no seu Android:</p>
          <div className={s.step}><span className={s.stepIcon}><MoreVertical size={22}/></span><div><strong>1. Abra o menu do navegador</strong><small>Toque nos três pontos no Chrome.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Download size={21}/></span><div><strong>2. Instalar aplicativo</strong><small>Escolha “Instalar aplicativo” ou “Adicionar à tela inicial”.</small></div></div>
          {prompt && <button type="button" className={s.confirm} disabled={busy} onClick={()=>void install()}>{busy?'Abrindo…':'Instalar agora'}</button>}
        </> : <>
          <p className={s.intro}>Para instalar no computador:</p>
          <div className={s.step}><span className={s.stepIcon}><MonitorDown size={22}/></span><div><strong>1. Procure o ícone de instalação</strong><small>Ele aparece na barra de endereço do Chrome ou Edge.</small></div></div>
          <div className={s.step}><span className={s.stepIcon}><Download size={21}/></span><div><strong>2. Clique em Instalar</strong><small>O Summer Fit será aberto como um aplicativo.</small></div></div>
          {prompt && <button type="button" className={s.confirm} disabled={busy} onClick={()=>void install()}>{busy?'Abrindo…':'Instalar agora'}</button>}
        </>}
        <button type="button" className={s.understood} onClick={()=>setOpen(false)}>Entendido</button>
        <p className={s.note}>A instalação depende do navegador e está disponível somente em conexão HTTPS.</p>
      </section>
    </div>}
  </>;
}
