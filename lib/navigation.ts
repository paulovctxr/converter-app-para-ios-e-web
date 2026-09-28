export const TAB_PATHS = {
  Início: "inicio",
  Treinos: "treinos",
  Nutrição: "nutricao",
  Progresso: "progresso",
  Comunidade: "comunidade",
  Perfil: "perfil",
  Plano: "planos",
} as const;

export type AppTab = keyof typeof TAB_PATHS;

export function tabFromHash(hash: string): AppTab {
  const slug = hash.replace(/^#/, "");
  return (Object.keys(TAB_PATHS) as AppTab[]).find(
    (tab) => TAB_PATHS[tab] === slug,
  ) || "Início";
}
