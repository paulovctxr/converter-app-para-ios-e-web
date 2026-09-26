import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PlanId } from './plan-config';

type CustomWorkout = {
  id: string;
  title: string;
  focus: string;
  exerciseCount: number;
  duration: string;
};

type AppState = {
  studentName: string;
  enrollment: string;
  completedThisWeek: number;
  workoutCompleted: boolean;
  premiumPending: boolean;
  pendingPlan: PlanId | null;
  customWorkouts: CustomWorkout[];
};

type AppStateContextValue = AppState & {
  markWorkoutComplete: () => void;
  addWorkout: (workout: Omit<CustomWorkout, 'id'>) => void;
  sendPaymentProof: (plan: PlanId) => void;
};

const STORAGE_KEY = 'summer-fit-student-state';
const INITIAL_STATE: AppState = {
  studentName: 'João Silva',
  enrollment: '4832',
  completedThisWeek: 3,
  workoutCompleted: false,
  premiumPending: false,
  pendingPlan: null,
  customWorkouts: [
    { id: 'summer-a', title: 'Treino A', focus: 'Peito + Tríceps', exerciseCount: 3, duration: '45 min' },
  ],
};

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setState({ ...INITIAL_STATE, ...parsed, customWorkouts: parsed.customWorkouts ?? INITIAL_STATE.customWorkouts });
        } catch {
          // Usa os dados iniciais se o cache local estiver corrompido.
        }
      }
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => undefined);
  }, [state]);

  const value = useMemo<AppStateContextValue>(() => ({
    ...state,
    markWorkoutComplete: () => setState((current) => ({
      ...current,
      workoutCompleted: true,
      completedThisWeek: Math.min(current.completedThisWeek + 1, 5),
    })),
    addWorkout: (workout) => setState((current) => ({
      ...current,
      customWorkouts: [{ ...workout, id: `workout-${Date.now()}` }, ...current.customWorkouts],
    })),
    sendPaymentProof: (plan) => setState((current) => ({ ...current, premiumPending: true, pendingPlan: plan })),
  }), [state]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error('useAppState must be used within AppStateProvider');
  return context;
}
