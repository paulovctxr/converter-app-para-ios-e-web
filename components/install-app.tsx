'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Download,
  LoaderCircle,
  MonitorDown,
  MoreVertical,
  Plus,
  Share2,
  Smartphone,
  X,
} from 'lucide-react';
import s from './install-app.module.css';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [error, setError] = useState('');
  const [device, setDevice] = useState<'ios' | 'android' | 'desktop'>(
    'desktop',
  );
  const [androidInAppBrowser, setAndroidInAppBrowser] = useState(false);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const pendingPrompt = useRef<InstallEvent | null>(null);
  const installing = useRef(false);

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)');
    const sync = () =>
      setInstalled(
        mode.matches ||
          (navigator as Navigator & { standalone?: boolean }).standalone ===
            true,
      );
    sync();
    const ua = navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /android/.test(ua);
    setDevice(isIos ? 'ios' : isAndroid ? 'android' : 'desktop');
    setAndroidInAppBrowser(
      isAndroid && /; wv\)|\bwv\b|instagram|fban|fbav|whatsapp/.test(ua),
    );
    const capture = (event: Event) => {
      event.preventDefault();
      const installEvent = event as InstallEvent;
      pendingPrompt.current = installEvent;
      setPrompt(installEvent);
      setError('');
    };
    const done = () => {
      setInstalled(true);
      pendingPrompt.current = null;
      setPrompt(null);
      setOpen(false);
    };
    window.addEventListener('beforeinstallprompt', capture);
    window.addEventListener('appinstalled', done);
    mode.addEventListener('change', sync);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', done);
      mode.removeEventListener('change', sync);
    };
  }, []);

  if (installed) return null;

  function openInChrome() {
    const target = `${window.location.host}${window.location.pathname}${window.location.search}`;
    window.location.href = `intent://${target}#Intent;scheme=https;package=com.android.chrome;end`;
  }

  async function install() {
    if (installing.current) return;
    const event = pendingPrompt.current;
    if (!event) {
      if (device === 'android' && androidInAppBrowser) {
        openInChrome();
        return;
      }
      setError('');
      setOpen(true);
      return;
    }
    installing.current = true;
    // A native install event can only be used once. Consume it before awaiting.
    pendingPrompt.current = null;
    setPrompt(null);
    setError('');
    setBusy(true);
    try {
      // Keep prompt() in the original click gesture: no async work before it.
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'dismissed') {
        setError(
          'A instalação foi cancelada. Quando quiser, toque em Instalar novamente.',
        );
      }
      setOpen(false);
    } catch {
      setError(
        'Não foi possível abrir a instalação. Você pode tentar pelo menu do navegador seguindo as orientações abaixo.',
      );
      setOpen(true);
    } finally {
      installing.current = false;
      setBusy(false);
    }
  }

  const androidWaiting = device === 'android' && !prompt;
  const floatingLabel = busy
    ? 'Abrindo…'
    : androidInAppBrowser
      ? 'Abrir no Chrome'
      : androidWaiting
        ? 'Preparar instalação'
        : 'Instalar';

  return (
    <>
      <button
        type="button"
        className={s.floating}
        aria-label={
          androidInAppBrowser ? 'Abrir Summer Fit no Chrome' : 'Instalar Summer Fit'
        }
        disabled={busy}
        aria-busy={busy}
        onClick={() => void install()}
      >
        {androidInAppBrowser ? (
          <Smartphone size={20} aria-hidden="true" />
        ) : androidWaiting ? (
          <LoaderCircle className={s.spinner} size={20} aria-hidden="true" />
        ) : (
          <Smartphone size={20} aria-hidden="true" />
        )}
        <span>{floatingLabel}</span>
        <Download size={17} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={s.overlay}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            className={s.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
          >
            <button
              type="button"
              className={s.close}
              aria-label="Fechar instalação"
              onClick={() => setOpen(false)}
            >
              <X size={22} />
            </button>
            <div className={s.modalBrand}>
              <img src="/summer-fit-round.png" alt="" />
              <div>
                <p>SUMMER FIT</p>
                <h2 id="install-title">Instalar no dispositivo</h2>
              </div>
            </div>
            <div className={s.rule} />
            {error && (
              <p className={s.intro} role="alert">
                {error}
              </p>
            )}
            {prompt ? (
              <>
                <p className={s.intro}>
                  Tudo pronto. Toque abaixo para abrir agora a janela de
                  instalação do Android e confirme.
                </p>
                <button
                  type="button"
                  className={s.confirm}
                  disabled={busy}
                  onClick={() => void install()}
                >
                  {busy ? 'Abrindo…' : 'Instalar agora'}
                </button>
              </>
            ) : device === 'ios' ? (
              <>
                <p className={s.intro}>Para instalar no seu iPhone ou iPad:</p>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <Share2 size={21} />
                  </span>
                  <div>
                    <strong>1. Toque em Compartilhar</strong>
                    <small>Na barra inferior do Safari.</small>
                  </div>
                </div>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <Plus size={22} />
                  </span>
                  <div>
                    <strong>2. Adicionar à Tela de Início</strong>
                    <small>Role o menu para baixo e selecione essa opção.</small>
                  </div>
                </div>
              </>
            ) : device === 'android' ? (
              <>
                <p className={s.intro}>
                  O Chrome libera a janela automática depois que reconhece o
                  site como instalável. Continue nesta página por alguns
                  segundos; quando o botão mostrar “Instalar”, um toque abrirá
                  a instalação nativa.
                </p>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <LoaderCircle className={s.spinner} size={22} />
                  </span>
                  <div>
                    <strong>Preparando instalação automática</strong>
                    <small>Não é necessário procurar a opção nos três pontos.</small>
                  </div>
                </div>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <MoreVertical size={22} />
                  </span>
                  <div>
                    <strong>Se o botão não for liberado</strong>
                    <small>
                      O navegador também mantém “Instalar aplicativo” no menu.
                    </small>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className={s.intro}>Para instalar no computador:</p>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <MonitorDown size={22} />
                  </span>
                  <div>
                    <strong>1. Procure o ícone de instalação</strong>
                    <small>
                      Ele aparece na barra de endereço do Chrome ou Edge.
                    </small>
                  </div>
                </div>
                <div className={s.step}>
                  <span className={s.stepIcon}>
                    <Download size={21} />
                  </span>
                  <div>
                    <strong>2. Clique em Instalar</strong>
                    <small>O Summer Fit será aberto como um aplicativo.</small>
                  </div>
                </div>
              </>
            )}
            <button
              type="button"
              className={s.understood}
              onClick={() => setOpen(false)}
            >
              Entendido
            </button>
            <p className={s.note}>
              A confirmação final é uma proteção obrigatória do Android e do
              navegador.
            </p>
          </section>
        </div>
      )}
    </>
  );
}
