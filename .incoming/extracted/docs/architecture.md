# Summer Fit — arquitetura da versão atual

## Objetivo

O app é uma experiência mobile-first para o aluno da Summer Fit. A pessoa cria sua conta, informa a matrícula, monta fichas próprias, executa treinos, acompanha evolução e escolhe entre o plano Premium de R$ 5 e o Summer Plus de R$ 8.

A unidade exibida no app é **Rua Pereira de Araujo, 83**.

## Camadas

- **App:** Expo Router, React Native, NativeWind e componentes leves.
- **Estado local:** contexto React + AsyncStorage para manter treinos próprios, treino atual e dados básicos mesmo com falhas pequenas de conexão.
- **Servidor:** o scaffold WebDev continua preparado para autenticação Manus, tRPC e Drizzle quando a persistência em nuvem for ligada.
- **Mídia:** a marca é distribuída como WebP otimizado; exercícios futuros devem usar thumbnails pequenas e vídeo sob demanda.

## Experiência atual do aluno

1. Home com a marca Summer Fit, endereço da unidade, treino do dia e progresso semanal.
2. **Meus treinos** para criar fichas com nome, foco, quantidade de exercícios e duração.
3. Execução com séries, carga sugerida, descanso, pausa, pular e conclusão.
4. Progresso com frequência, histórico e metas.
5. Planos com PIX centralizado em `lib/plan-config.ts`:
   - `Summer Premium`: R$ 5/mês — calorias, vídeos, evolução e histórico mensal.
   - `Summer Plus`: R$ 8/mês — tudo do Premium, treinos próprios ilimitados, metas por objetivo e histórico avançado por exercício.
6. Perfil com matrícula, endereço, assinatura e suporte.
7. Painel administrativo em `/admin`, protegido por Manus OAuth e `adminProcedure`. A conta proprietária definida pelo projeto recebe `role = admin` automaticamente no primeiro login; outras contas autenticadas recebem acesso negado.
8. Gestão de alunos em `/admin-students`, com busca, matrícula, plano ativo, status e próxima renovação mensal. Aprovar uma solicitação cria ou atualiza a assinatura ativa do aluno.

## Entidades de dados previstas

| Entidade | Responsabilidade |
| --- | --- |
| `profiles` | identidade do aluno, e-mail, matrícula e unidade |
| `gyms` | academia/unidade, preparando multi-unidade |
| `exercises` | biblioteca de exercícios, grupo muscular e mídia sob demanda |
| `workouts` | fichas criadas pelo aluno |
| `workout_exercises` | exercícios, ordem, séries, repetições, carga e descanso |
| `workout_sessions` | execução do treino |
| `weight_history` | evolução de peso/carga |
| `subscriptions` | plano, status e datas de validade |
| `payments` | PIX, comprovante e aprovação |
| `app_settings` | preço dos planos, chave PIX e endereço da unidade |
| `planRequests` | solicitações de pagamento, plano, valor, status, comprovante e revisão |
| `subscriptions` | plano ativo do aluno, status, data de início e próxima renovação |

## Regras de segurança para a próxima etapa

- o aluno lê e altera apenas o próprio perfil, fichas, sessões e histórico;
- `role`, `premium_active`, `premium_expires_at` e status de pagamento não podem ser alterados pelo cliente;
- a matrícula permanece string com validação `^[0-9]{4}$`;
- a chave PIX, preços e endereço devem ser lidos de configuração centralizada, não espalhados por telas;
- vídeos não entram no APK e não são pré-carregados.
- somente `role = admin` pode listar ou alterar solicitações de plano; o servidor valida essa regra, não apenas a interface.

## Próximos incrementos

1. Conectar o cadastro/login do aluno ao Auth e ao banco.
2. Persistir `workouts` e `workout_exercises` via tRPC protegido.
3. Adicionar edição detalhada dos exercícios de cada ficha.
4. Implementar upload de comprovante JPG/PNG/PDF e aprovação administrativa.
5. Publicar PWA e gerar APK Android com `com.summertreinos.app`.
