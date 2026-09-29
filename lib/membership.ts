export type MembershipStatus = "pending" | "active" | "suspended" | "inactive";

export type Membership = {
  status: MembershipStatus;
  registration: string | null;
  is_admin: boolean;
  reviewed_at?: string | null;
  updated_at?: string | null;
  server_time: string;
};

export const MEMBERSHIP_LABELS: Record<MembershipStatus, string> = {
  pending: "Aguardando aprovação",
  active: "Aluno ativo",
  suspended: "Acesso suspenso",
  inactive: "Matrícula inativa",
};
