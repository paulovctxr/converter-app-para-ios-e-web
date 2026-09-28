# Comunidade temporariamente desativada

A aba Comunidade, stories e desafios estão desativados na interface atual. Os arquivos técnicos continuam guardados no projeto para permitir a reativação depois.

Nesta versão:

- A navegação dos alunos possui apenas Início, Treinos, Nutrição, Progresso e Perfil.
- O painel administrativo mostra somente alunos e planos.
- Nenhum aluno consegue solicitar, publicar ou acessar a comunidade pela interface.
- A instalação do Summer continua disponível na tela de login e cadastro.

Para reativar futuramente, será necessário restaurar no `app/page.tsx` o import e a aba `CommunityPanel`, restaurar o bloco `CommunityAdmin` em `components/admin-panel.tsx`, e recolocar Comunidade em `lib/navigation.ts`. Os arquivos `components/community-panel.tsx`, `components/community-admin.tsx`, `components/community.module.css`, `lib/community.ts` e a migração do Supabase foram preservados.

Não apague tabelas já criadas no Supabase. Deixá-las sem telas acessíveis não concede acesso aos alunos, pois as políticas RLS continuam protegendo o banco.
