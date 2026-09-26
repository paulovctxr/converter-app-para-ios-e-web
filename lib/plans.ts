export type Access = {
  is_admin: boolean;
  plan: "basic" | "premium" | "plus";
  expires_at: string | null;
  server_time: string;
};
export const PIX_KEY = "b3a68789-7fae-426c-b17d-049f22dbdb33";
export const PLAN_NAMES = {
  basic: "Básico",
  premium: "Summer Premium",
  plus: "Summer PRO",
};
