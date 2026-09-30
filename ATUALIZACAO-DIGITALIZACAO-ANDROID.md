# Atualização: novas digitalizações e instalação no Android

## O que mudou

- Depois de salvar uma ficha, a tela mostra **DIGITALIZAR OUTRA FICHA**.
- O novo botão limpa somente as fotos temporárias da importação anterior e inicia uma nova digitalização.
- A ficha que já foi salva permanece na conta do aluno.
- No Android, o botão usa a janela nativa de instalação assim que o Chrome disponibiliza o recurso.
- Se o site for aberto pelo Instagram ou WhatsApp, o botão abre a página no Chrome.
- A confirmação final da instalação continua obrigatória por segurança do Android.

## Como publicar

1. Copie todos os arquivos desta pasta sobre a pasta atual do projeto.
2. No GitHub Desktop, confira as alterações.
3. Escreva o resumo: `Melhora digitalização e instalação no Android`.
4. Clique em **Commit to main**.
5. Clique em **Push origin**.
6. Aguarde o novo deploy ficar **Ready** na Vercel.

Esta atualização não exige novo SQL e não altera a chave da OpenAI.

## Como testar

1. Entre em uma conta de aluno.
2. Abra **Treinos → Adicionar treino → Fotografar minha ficha**.
3. Digitalize e salve a primeira ficha.
4. Toque em **DIGITALIZAR OUTRA FICHA** e salve a segunda.
5. Confirme que as duas aparecem em **Meus treinos**.
6. Em um Android com Chrome, aguarde o botão mostrar **Instalar** e toque nele.
7. Confirme a instalação na janela nativa do Android.

