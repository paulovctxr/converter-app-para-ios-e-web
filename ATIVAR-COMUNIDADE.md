# Summer: comunidade com aprovação, stories, desafios e instalação

Esta atualização foi preparada no projeto local. Não foi aplicada ao seu Supabase nem publicada no Vercel automaticamente.

## O que mudou

- Nova aba Comunidade, disponível para solicitar acesso; conteúdo só é liberado depois da aprovação do administrador já existente.
- Aprovar, recusar ou suspender membros em Administração → Comunidade. Nome, e-mail e matrícula ajudam a conferir a identidade. Não existe aprovação automática por assinatura PRO.
- Stories com foto e legenda, consentimento, limite de 5 tentativas de envio por 24 horas, exclusão pelo autor e denúncia ao administrador. Fotos JPG/PNG/WebP; o navegador comprime e remove metadados antes de enviar. Vídeos não estão incluídos.
- Stories publicados ficam acessíveis por 24 horas. A remoção física dos arquivos depende da rotina de limpeza abaixo. Stories excluídos deixam de ser acessíveis imediatamente; a rotina pode manter arquivos inacessíveis por até aproximadamente 25 horas. Reservas de envio são mantidas por 24 horas para não permitir reinício da cota ao excluir.
- Desafios criados pelo administrador, inscrição e progresso por check-in declarado pelo aluno (no máximo um por dia, horário de Brasília). Não existe comprovação automática, ranking ou premiação.
- Opção Instalar Summer no Início e Perfil. No iPhone, instruções para adicionar à tela inicial pelo Safari. No Android, prompt quando oferecido pelo navegador, com instruções alternativas. Ícone usa o mascote original. Esta instalação web não cria um APK nem publica em lojas e precisa de internet.
- Treinos e nutrição pessoais não são compartilhados com a comunidade.

## 1. Preparar com segurança

1. Faça uma cópia da pasta atual do projeto.
2. Extraia o ZIP atualizado e copie os arquivos para a pasta do projeto, preservando `.git` e suas variáveis de ambiente.
3. Não publique ainda: ative o banco e a limpeza primeiro.

## 2. Ativar o banco

1. Abra o mesmo projeto Supabase utilizado pelo Summer.
2. Abra SQL Editor → New query.
3. Execute esta consulta de verificação:

```sql
select to_regprocedure('storage.allow_any_operation(text[])') as helper_de_storage;
```

Se aparecer NULL, pare e peça ajuda: a versão do Storage precisa oferecer esse helper para bloquear criação de links públicos temporários. Não remova a proteção da migração.

4. No seu computador, abra `supabase/migrations/20260928111913_summer_community_approval.sql` com um editor de texto.
5. Copie TODO o conteúdo para uma nova consulta no SQL Editor e clique em Run. Execute uma única vez. As migrações anteriores do app devem já estar aplicadas.
6. Confira em Storage que o bucket `summer-stories` está PRIVATE. Nunca o torne público. A migração limita os tipos de imagem e o tamanho de arquivo a 3 MB.
7. Abra Security Advisor e examine avisos referentes às novas tabelas. As tabelas estão protegidas por RLS e colunas sensíveis não podem ser alteradas pelos alunos.

## 3. Ativar limpeza automática (antes de liberar stories)

A expiração de acesso funciona no banco, mas sem esta etapa os arquivos antigos continuam ocupando armazenamento.

1. Gere uma senha aleatória exclusiva de pelo menos 32 caracteres no seu gerenciador de senhas. Não use sua senha pessoal e não envie o valor aqui.
2. No Supabase → Edge Functions → Secrets, crie `COMMUNITY_CLEANUP_SECRET` com essa senha. Ela nunca deve entrar no GitHub, no código frontend ou em variável `NEXT_PUBLIC_*`.
3. Crie uma Edge Function chamada `community-cleanup`. Copie o conteúdo de `supabase/functions/community-cleanup/index.ts` para o editor dela e publique.
4. Nas configurações SOMENTE dessa função, desative a verificação de JWT legado. A própria função verifica a senha do passo 2 antes de fazer qualquer exclusão. As demais funções não devem ser alteradas.
5. No Supabase → Cron → Create job, crie `summer-community-cleanup`, agendado como `0 * * * *` (a cada hora).
6. Escolha HTTP request, método POST, URL `https://SEU_PROJECT_REF.supabase.co/functions/v1/community-cleanup`. Use o endereço real do seu projeto.
7. Configure os headers `Content-Type: application/json` e `Authorization: Bearer SUA_SENHA_ALEATORIA_DO_PASSO_2`. Body: `{}`. Mantenha esse job restrito à administração; não copie a configuração com a senha para arquivos compartilhados.
8. Ative o job e execute um teste. A função deve retornar HTTP 200 e `{"removed":0}` se não houver fotos vencidas. 401 significa senha incorreta; 503 significa segredo ausente ou curto. Consulte os logs da função para conferir o resultado HTTP, não apenas se o job foi disparado.
9. Monitore erros e uso de Storage. A limpeza processa até 500 stories por execução; se houver fila maior, as execuções seguintes continuam o trabalho.

Para publicação via CLI, o arquivo `supabase/config.toml` contém somente a configuração desta nova função. Se seu projeto local já tiver esse arquivo com outras configurações, preserve as seções existentes e adicione apenas `[functions.community-cleanup]`.

## 4. Publicar o site

1. No GitHub Desktop, revise os arquivos alterados.
2. Faça o commit e clique em Push origin.
3. Espere o Vercel ficar Ready.
4. Abra o site e confira o rodapé: `Interface 28.09 · Comunidade`.

## 5. Testar antes de divulgar

1. Em uma conta de aluno, abra Comunidade e solicite acesso. Antes da aprovação não pode aparecer nenhum story ou desafio.
2. Na sua conta de administrador, abra Perfil → Administrar alunos e planos → Comunidade. Confira nome, e-mail e matrícula e clique em Aprovar.
3. Na conta do aluno, toque em Atualizar na Comunidade. Publique uma foto de teste autorizada, confira a imagem e exclua o story.
4. Crie um desafio na administração. Participe pela conta do aluno e faça um check-in. Um segundo check-in no mesmo dia deve ser bloqueado.
5. Suspenda essa conta na comunidade e atualize a tela dela: fotos e desafios devem desaparecer. As regras do banco devem negar novas consultas mesmo sem atualizar a tela. Uma imagem já visualizada pode ter sido capturada pelo usuário; não é possível desfazer capturas.
6. Teste denúncia/moderação com duas contas aprovadas. Denúncias relacionadas a stories expirados são removidas junto com os registros na limpeza; acompanhe a fila diariamente.
7. Abra o site em HTTPS no Safari do iPhone e Chrome do Android e teste Instalar Summer. O navegador pode não oferecer prompt automático; use o menu indicado. Atalhos antigos podem precisar ser removidos e adicionados novamente para atualizar o ícone.

## Verificação realizada nesta entrega

- Testes automatizados com Postgres local embarcado: aprovação, tentativa de autoaprovação, isolamento, upload restrito, bloqueio de links assinados, expiração, suspensão, cota, denúncias, criação de desafios e check-ins.
- Testes da rotina de limpeza com Storage simulado: rejeição de chamadas não autorizadas, ordem de exclusão e manutenção de registros em caso de falha.
- Verificação TypeScript e compilação de produção.
- Não foi possível concluir a conferência visual em navegador neste ambiente. Instalação em dispositivos, Storage real, execução do Cron e Security Advisor do projeto hospedado ainda precisam de teste após a ativação.

Referências consultadas: https://supabase.com/docs/guides/storage/security/access-control ; https://supabase.com/docs/guides/storage/schema/helper-functions ; https://supabase.com/docs/guides/cron/quickstart ; https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt
