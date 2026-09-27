# Correção de interface — 27/09, revisão 2

- Perfil nutricional: idade, altura, peso, refeições e água podem ser apagados sem um zero reaparecer. Peso e altura aceitam vírgula ou ponto. A validação ocorre antes de salvar ou gerar o cardápio.
- Logo horizontal completo no topo do aplicativo, inclusive no celular, e no login. Não depende do recorte do PNG circular.
- Botões principais com fundo vermelho escuro e texto branco; secundários brancos com texto escuro e borda. Estados selecionados e desabilitados têm cores explícitas.
- Rodapé identifica esta atualização como “Interface 27.09 · revisão 2”.

## Publicar

1. Faça uma cópia de segurança da pasta local do projeto.
2. Extraia este ZIP e copie o conteúdo para a pasta do repositório, onde está `package.json`. Mantenha suas variáveis de ambiente e a pasta `.git` existentes.
3. No GitHub Desktop, revise as alterações, faça o commit e clique em Push origin.
4. Aguarde o deploy correspondente no Vercel ficar Ready.
5. Reabra o site e confira o identificador no rodapé. Em Nutrição, apague a altura inteira, digite 175 e salve; teste também um peso como 80,5.

Esta revisão não exige nova migração do banco nem novos segredos. Testes de validação do formulário, TypeScript e build foram executados localmente. A renderização no iPhone e o deploy em produção ainda precisam ser conferidos depois da publicação.
