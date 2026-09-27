"use client";

import { useEffect, useState } from "react";
import { Pause, Play, RotateCcw, Timer } from "lucide-react";

function clock(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

// The seconds tick only in this small component, not the whole dashboard.
export function WorkoutClock({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return <span className="timer" aria-label="Tempo decorrido">{clock(elapsed)}</span>;
}

export function RestTimer() {
  const [duration, setDuration] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const tick = () => {
      const next = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setDeadline(null);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline]);
  return (
    <div className="rest-timer">
      <div className="rest-timer-label"><Timer size={18} /><span>Descanso entre séries</span></div>
      <div className="rest-timer-controls">
        <select aria-label="Tempo de descanso" value={duration} disabled={deadline !== null} onChange={(event) => {
          const value = Number(event.target.value);
          setDuration(value); setRemaining(value);
        }}>
          {[30, 45, 60, 90, 120, 180].map((seconds) => <option key={seconds} value={seconds}>{seconds}s</option>)}
        </select>
        <strong className="timer">{clock(remaining)}</strong>
        <button type="button" className="icon-button" aria-label={deadline ? "Pausar descanso" : "Iniciar descanso"} onClick={() => {
          if (deadline !== null) setDeadline(null);
          else { const value = remaining || duration; setRemaining(value); setDeadline(Date.now() + value * 1000); }
        }}>{deadline ? <Pause size={18} /> : <Play size={18} />}</button>
        <button type="button" className="icon-button" aria-label="Reiniciar descanso" onClick={() => { setDeadline(null); setRemaining(duration); }}><RotateCcw size={17} /></button>
      </div>
      <span className="rest-finished" role="status">{remaining === 0 ? "Descanso concluído. Pronto para a próxima série?" : ""}</span>
    </div>
  );
}
