export const PIX_KEY = 'b3a68789-7fae-426c-b17d-049f22dbdb33';

export type PlanId = 'premium' | 'plus';

export const PLANS = {
  premium: {
    id: 'premium',
    name: 'Summer Premium',
    price: 5,
    badge: 'ESSENCIAL',
    description: 'Mais clareza para acompanhar a sua evolução.',
    features: ['Contador de calorias', 'Vídeos de execução', 'Evolução de cargas', 'Histórico mensal'],
  },
  plus: {
    id: 'plus',
    name: 'Summer Plus',
    price: 8,
    badge: 'MAIS COMPLETO',
    description: 'Para quem quer organizar a jornada inteira de treino.',
    features: ['Tudo do Premium', 'Treinos próprios ilimitados', 'Metas por objetivo', 'Histórico avançado por exercício', 'Notas e lembretes de treino'],
  },
} as const;
