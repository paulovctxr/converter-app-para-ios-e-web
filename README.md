# Summer Fit — web e iPhone

Aplicativo Next.js com autenticação Supabase, fichas pessoais persistentes, registro de treinos e administração de planos. A integração GitHub/Vercel existente publica a branch `main`.

## Recursos

- Login, cadastro, recuperação de senha e mensagens de conexão em português.
- Fichas com exercícios, séries e repetições; edição, busca e exclusão.
- Sessão de treino com cronômetro, checklist, histórico real e meta semanal.
- Interface responsiva e manifesto para adicionar à tela inicial do celular. Internet é necessária; não há promessa de uso offline.
- `/admin`: painel exclusivo do proprietário, alunos paginados, pesquisa por nome/e-mail/matrícula disponível, filtros por situação e alertas de vencimento em sete dias.
- Premium (R$ 5) e Plus (R$ 8): liberação manual por um mês, renovação que preserva dias válidos, revogação imediata e auditoria no banco.
- Registro manual de calorias protegido por plano ativo. A interface não promete os demais recursos do antigo projeto mobile (vídeos, professores, evolução de cargas) como já implementados nesta versão.

## Configuração obrigatória antes da publicação

1. Configure `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) no projeto Vercel e em `.env.local`. Use o mesmo projeto Supabase do login existente. Nunca coloque uma chave `service_role` no navegador.
2. Execute, nessa ordem, `supabase/migrations/20260926161827_summer_fit_admin_plans_20260926.sql` e `supabase/migrations/20260926162104_summer_fit_harden_admin_functions_20260926.sql` no projeto Supabase ativo. São alterações aditivas e protegem os dados por usuário.
3. O proprietário deve ter a conta **victorpaulognv@gmail.com** cadastrada e com o e-mail confirmado. Essa identidade foi confirmada pelo proprietário. A autorização usa a conta validada em `auth.users` e uma lista privada no banco, nunca campos editáveis do perfil.
4. Em Supabase Auth, autorize o endereço real do site e a URL `/auth/callback`, incluindo `/auth/callback?next=/auth/reset-password` para recuperação. Mantenha a confirmação de e-mail habilitada.
5. Depois de entrar, abra **Perfil → Administrar alunos e planos** ou `/admin`.

A migração deve estar aplicada antes de disponibilizar esta versão a alunos. Sem ela, os dados não são inventados e operações falham de forma fechada. Os cadastros apresentados no painel são as contas desse projeto Supabase; uma matrícula ausente é exibida como “Não informada”. Não são importados automaticamente alunos de outro banco ou do APK antigo.

## Planos e Pix

A chave Pix é a já fornecida pelo proprietário. Não há cobrança automática nem verificação bancária. O administrador confere o pagamento antes de liberar/renovar. Os prazos são calculados no servidor, por mês calendário. O botão Liberar adiciona um mês e permite escolher outro plano; Renovar preserva o plano atual. Revogar encerra a validade imediatamente, sem apagar o histórico.

Os dados sensíveis são protegidos por RLS e permissões SQL. Alunos só acessam seus próprios treinos e registros. Alterações de planos usam funções que verificam a administração no banco, com auditoria em `summer_private.plan_audit`. O acesso pago é verificado a cada consulta ao banco, mesmo que a interface ainda mostre um status antigo.

## Desenvolvimento e validação

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Testes usam PostgreSQL local em memória (PGlite), sem dados de produção: bloqueio de administração para alunos/anônimos, isolamento entre contas, renovação, revogação e gravação concorrente das fichas.

Limites atuais: 30 fichas por conta, 20 exercícios por ficha e os últimos 180 treinos concluídos. Fichas ficam em `summer_fitness_state`, fora do JWT de autenticação. A gravação detecta conflitos de revisão entre aparelhos. Esta alteração não recompila nem atualiza o APK Android existente.
