"use client";

import { useMemo, useState } from "react";
import {
  CalendarCheck,
  Clock3,
  Dumbbell,
  Flame,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { proProgressInsights, type WorkoutSession } from "@/lib/fitness";

export function ProProgressInsights({
  sessions,
}: {
  sessions: WorkoutSession[];
}) {
  const insights = useMemo(() => proProgressInsights(sessions), [sessions]);
  const [selectedExercise, setSelectedExercise] = useState("");
  const selected =
    insights.progress.find((item) => item.name === selectedExercise) ||
    insights.progress[0];
  const maxWeight = Math.max(
    1,
    ...(selected?.points.map((point) => point.weightKg) || []),
  );

  return (
    <div className="pro-progress-insights">
      <div className="pro-progress-heading">
        <div>
          <p className="eyebrow">EVOLUÇÃO COMPLETA</p>
          <h3>Estatísticas dos seus treinos</h3>
          <p>Cada treino concluído alimenta automaticamente estes dados.</p>
        </div>
        <span className="pro-only-badge">⭐ SUMMER PRO</span>
      </div>

      <div className="pro-stat-grid">
        <article>
          <CalendarCheck size={21} />
          <span>Total de treinos</span>
          <strong>{insights.totalSessions}</strong>
        </article>
        <article>
          <TrendingUp size={21} />
          <span>Neste mês</span>
          <strong>{insights.monthSessions}</strong>
        </article>
        <article>
          <Clock3 size={21} />
          <span>Tempo total</span>
          <strong>
            {insights.totalMinutes} <small>min</small>
          </strong>
        </article>
        <article>
          <Flame size={21} />
          <span>Sequência</span>
          <strong>
            {insights.streakDays} <small>dias</small>
          </strong>
        </article>
      </div>

      <div className="progress-detail-grid">
        <section className="load-progress-card">
          <div className="section-heading">
            <div>
              <h4>Evolução de cargas</h4>
              <p>Últimos registros feitos em treinos concluídos.</p>
            </div>
            {insights.progress.length > 0 && (
              <select
                aria-label="Escolher exercício para o gráfico"
                value={selected?.name || ""}
                onChange={(event) => setSelectedExercise(event.target.value)}
              >
                {insights.progress.map((item) => (
                  <option key={item.name}>{item.name}</option>
                ))}
              </select>
            )}
          </div>
          {selected ? (
            <div className="load-chart">
              {selected.points.slice(-12).map((point, index) => (
                <div
                  className="load-bar-column"
                  key={`${point.completedAt}-${index}`}
                >
                  <strong>{point.weightKg} kg</strong>
                  <div>
                    <i
                      style={{
                        height: `${Math.max(8, (point.weightKg / maxWeight) * 100)}%`,
                      }}
                    />
                  </div>
                  <small>
                    {new Date(point.completedAt).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </small>
                </div>
              ))}
            </div>
          ) : (
            <div className="progress-empty-inline">
              <Dumbbell size={26} />
              <div>
                <strong>As cargas aparecerão aqui</strong>
                <p>
                  Registre uma carga na ficha e conclua o treino para iniciar o
                  gráfico.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="records-card">
          <div className="section-heading">
            <div>
              <h4>Recordes pessoais</h4>
              <p>Maior carga registrada por exercício.</p>
            </div>
            <Trophy size={22} />
          </div>
          <div className="records-list">
            {insights.records.slice(0, 10).map((record, index) => (
              <article key={record.name}>
                <span>{index + 1}</span>
                <div>
                  <strong>{record.name}</strong>
                  <small>
                    {new Date(record.completedAt).toLocaleDateString("pt-BR")}
                  </small>
                </div>
                <b>{record.weightKg} kg</b>
              </article>
            ))}
            {!insights.records.length && (
              <p>Nenhum recorde de carga registrado ainda.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
