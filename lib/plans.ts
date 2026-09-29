export type SubscriptionStatus = "free" | "pro" | "expired" | "cancelled";
export type SubscriptionPlan = "monthly" | "annual";

export type Access = {
  is_admin: boolean;
  subscription_status?: SubscriptionStatus;
  subscription_plan?: SubscriptionPlan | null;
  subscription_started_at?: string | null;
  subscription_expires_at?: string | null;
  subscription_updated_at?: string | null;
  // Compatibility with the client that was published before this migration.
  plan: "basic" | "premium" | "plus";
  expires_at: string | null;
  server_time: string;
};

export type PlanConfig = {
  free_price_cents: number;
  pro_monthly_price_cents: number;
  pro_annual_price_cents: number;
  promotional_monthly_price_cents: number;
  promotion_active: boolean;
  pix_key: string;
  annual_savings_cents: number;
  nutrition_generation_limit: number;
  updated_at?: string;
};

export type SubscriptionRequest = {
  id: number;
  subscription_plan: SubscriptionPlan;
  amount_cents: number;
  status: "pending" | "approved" | "rejected" | "cancelled";
  created_at: string;
};

export const PIX_KEY = "b3a68789-7fae-426c-b17d-049f22dbdb33";

// Fallback local. The database returns the same central configuration and can
// change it later without editing every screen.
export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  free_price_cents: 0,
  pro_monthly_price_cents: 1490,
  pro_annual_price_cents: 11990,
  promotional_monthly_price_cents: 1000,
  promotion_active: true,
  pix_key: PIX_KEY,
  annual_savings_cents: 5890,
  nutrition_generation_limit: 4,
};

export const FREE_FEATURES = [
  "Treinos digitais",
  "Digitalização da ficha por foto",
  "Séries e repetições",
  "Registro de cargas",
  "Cronômetro",
  "Histórico básico",
] as const;

export const PRO_FEATURES = [
  "Tudo do plano gratuito",
  "Nutrição com IA",
  "Cardápio personalizado de 7 dias",
  "Registro da alimentação por foto",
  "Substituição de alimentos com IA",
  "Calorias, macros e controle de água",
  "Evolução completa e gráficos",
  "Recordes pessoais",
  "Lista de compras automática",
  "Recursos premium futuros",
] as const;

export const PLAN_NAMES = {
  basic: "Summer Grátis",
  premium: "Summer PRO",
  plus: "Summer PRO",
};

export function isProAccess(access: Access | null | undefined) {
  if (!access) return false;
  // The verified owner can test and administer every PRO feature without
  // needing a separate paid subscription. The database enforces the same rule.
  if (access.is_admin) return true;
  if (access.subscription_status)
    return access.subscription_status === "pro";
  return access.plan === "premium" || access.plan === "plus";
}

export function effectiveStatus(
  access: Access | null | undefined,
): SubscriptionStatus {
  if (!access) return "free";
  if (access.subscription_status) return access.subscription_status;
  return isProAccess(access) ? "pro" : "free";
}

export function effectiveExpiresAt(access: Access | null | undefined) {
  return access?.subscription_expires_at || access?.expires_at || null;
}

export function monthlyPrice(config: PlanConfig) {
  return config.promotion_active
    ? config.promotional_monthly_price_cents
    : config.pro_monthly_price_cents;
}

export function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function subscriptionPlanLabel(
  plan: SubscriptionPlan | null | undefined,
) {
  return plan === "annual" ? "Plano anual" : "Plano mensal";
}
