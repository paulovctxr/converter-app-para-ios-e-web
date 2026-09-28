'use client';
import { useEffect, useState } from 'react';
import s from './community.module.css';
interface InstallEvent extends Event { prompt(): Promise<void>; userChoice: Promise<{outcome:'accepted'|'dismissed'}> }
export function InstallApp() {
  const [prompt,setPrompt]=useState<InstallEvent|null>(null);const [installed,setInstalled]=useState(false);
  const [ios,setIos]=useState(false);const [help,setHelp]=useState(false);const [busy,setBusy]=useState(false);
  useEffect(()=>{
    const mode=window.matchMedia('(display-mode: standalone)');
    const sync=()=>setInstalled(mode.matches || (navigator as Navigator & {standalone?:boolean}).standalone===true);
    sync();setIos(/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
    const capture=(event:Event)=>{event.preventDefault();setPrompt(event as InstallEvent);};
    const done=()=>{setInstalled(true);setPrompt(null);};
    window.addEventListener('beforeinstallprompt',capture);window.addEventListener('appinstalled',done);mode.addEventListener('change',sync);
    return()=>{window.removeEventListener('beforeinstallprompt',capture);window.removeEventListener('appinstalled',done);mode.removeEventListener('change',sync);};
  },[]);
  if(installed)return null;
  return <aside className={s.panel} aria-label="Instalar Summer Fit"><div className={s.card}>
    <h3>Summer na sua tela inicial</h3><p>Abra seus treinos com um toque, direto no celular.</p>
    <button className={s.primary} disabled={busy} onClick={async()=>{if(!prompt){setHelp(v=>!v);return;}setBusy(true);try{await prompt.prompt();await prompt.userChoice;setPrompt(null);}catch{setHelp(true);}finally{setBusy(false);}}}>Instalar Summer</button>
    {help&&<p role="status">{ios?'No iPhone: abra este site no Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”. Confirme em “Adicionar”.':'No Android: abra este site no Chrome, toque no menu ⋮ e procure “Instalar aplicativo” ou “Adicionar à tela inicial”. No computador, use o ícone de instalação na barra de endereço, quando disponível.'}</p>}
    <p className={s.meta}>A instalação depende do navegador. É necessário estar conectado à internet para acessar seus dados.</p>
  </div></aside>;
}
