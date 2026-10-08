# FollowTidy: material para as lojas

O que enviar: o zip criado por `scripts/empacotar.sh` (o mesmo ficheiro para Chrome, Edge e Firefox).
Imagens: pasta `docs/capturas/` (1280×800) e `promo-440x280.png`. Ícone da loja: `icone-128.png`.
Política de privacidade: `privacidade.html`. Tem de estar num endereço público (ver "Antes de enviar").

## Antes de enviar
1. Em `privacidade.html`, troque `CONTACTO@EXEMPLO.COM` pelo email de contacto que quer mostrar publicamente.
2. Publique `privacidade.html` num endereço público. A forma mais simples e gratuita é o GitHub Pages ou o Google Sites. Guarde o link para o formulário da loja.
3. Chrome Web Store: crie a conta em https://chrome.google.com/webstore/devconsole (pagamento único de 5 USD) e verifique o email.
4. Firefox: crie a conta em https://addons.mozilla.org/developers/ (gratuito).
5. Edge: crie a conta em https://partner.microsoft.com/dashboard/microsoftedge (gratuito).

---

## Texto da loja: Português

**Nome:** FollowTidy

**Resumo (até 132 caracteres):**
Veja quem não te segue de volta, deixe de seguir ou remova vários seguidores de uma vez, com ritmo seguro.

**Descrição:**
O FollowTidy ajuda a arrumar a sua lista de seguidores no instagram.com, diretamente no navegador.

• Lista quem você segue e quem o segue
• Mostra quem não o segue de volta, e quem você não segue de volta
• Seleção múltipla para deixar de seguir ou remover seguidores
• Fila lenta com espera aleatória e limite diário configurável, para reduzir o risco de bloqueio
• A fila para sozinha se o Instagram pedir para abrandar
• Ordenação por mais recentes ou mais antigos e filtro de mútuos
• Nos mútuos, deixar de seguir e remover dos seguidores de uma só vez
• Pesquisa por nome e exportação para CSV
• Alternativa sem pedidos ao Instagram: importe os ficheiros JSON da exportação oficial dos seus dados

Privacidade: o FollowTidy usa a sessão que já tem aberta e nunca pede a sua senha. Tudo fica guardado só no seu navegador, sem servidores, publicidade nem rastreamento.

Como usar: abra o instagram.com com a sua conta, clique no ícone do FollowTidy e depois em "Carregar do Instagram".

Aviso: o FollowTidy não tem qualquer ligação ao Instagram ou à Meta. Ações automáticas podem levar o Instagram a limitar temporariamente a sua conta. Mantenha um ritmo lento e use por sua conta e risco.

**Categoria:** Social e comunicação (Chrome) · Social e comunicação (Edge) · Social e comunicação (Firefox)
**Idioma principal:** Português (Brasil)

---

## Store listing: English

**Name:** FollowTidy

**Summary (max 132 chars):**
See who doesn't follow you back, then unfollow or remove many accounts at once, at a safe pace.

**Description:**
FollowTidy helps you tidy up your follower list on instagram.com, right in your browser.

• Lists who you follow and who follows you
• Shows who doesn't follow you back, and who you don't follow back
• Multi-select to unfollow accounts or remove followers
• Slow queue with random waits and a configurable daily limit, to reduce the risk of blocks
• Stops automatically if Instagram asks you to slow down
• Sort by newest or oldest and filter mutuals
• For mutuals, unfollow and remove as follower in one go
• Search by name and export to CSV
• No-request alternative: import the JSON files from Instagram's official data export

Privacy: FollowTidy uses the session you already have open and never asks for your password. Everything stays in your browser, with no servers, ads or tracking.

How to use: open instagram.com signed in, click the FollowTidy icon, then "Carregar do Instagram" (Load from Instagram). The interface is in Portuguese.

Disclaimer: FollowTidy is not affiliated with Instagram or Meta. Automated actions may lead Instagram to temporarily limit your account. Keep a slow pace and use at your own risk.

---

## Respostas para o formulário de privacidade (Chrome Web Store)

**Finalidade única (Single purpose):**
Ajudar o utilizador a ver e gerir as contas que segue e que o seguem no instagram.com, incluindo deixar de seguir e remover seguidores que ele próprio seleciona.
*EN: Help the user view and manage the accounts they follow and that follow them on instagram.com, including unfollowing and removing followers they select.*

**Justificação das permissões:**
- `storage`: guardar localmente as listas carregadas, as definições de ritmo e o contador diário. *EN: Store the loaded lists, pace settings and daily counter locally.*
- Acesso a `https://www.instagram.com/*`: mostrar o painel no instagram.com e fazer, com a sessão do utilizador, os pedidos para carregar as listas e executar as ações que ele escolhe. *EN: Show the panel on instagram.com and, using the user's session, load the lists and perform the actions the user selects.*
- Acesso a `https://*.cdninstagram.com/*` e `https://*.fbcdn.net/*`: carregar as fotos de perfil quando o navegador não as consegue mostrar diretamente. *EN: Load profile pictures when the browser can't display them directly.*

**Código remoto:** Não. Todo o código está incluído no pacote. *EN: No, all code is in the package.*

**Dados recolhidos:** marque "Conteúdo do site" e "Informações de identificação pessoal" (nomes de utilizador e nomes de perfil, guardados apenas localmente). Confirme as três declarações: não vende dados, não usa para fins não relacionados e não usa para avaliar crédito.
*EN: Tick "Website content" and "Personally identifiable information" (usernames and profile names, stored locally only), and confirm the three certifications.*

**Firefox (pergunta sobre recolha de dados):** "Nenhum dado é recolhido nem transmitido" (já declarado no manifesto).

---

## Notas para a revisão (campo "Notes to reviewer")
Para testar é preciso uma conta do Instagram com sessão iniciada em instagram.com. Clique no ícone da extensão para abrir o painel e use "Carregar do Instagram". As ações de deixar de seguir e remover seguidor só acontecem depois de o utilizador selecionar contas e confirmar, com espera de 30–60 s entre cada uma e limite diário.
*EN: Requires a signed-in Instagram account on instagram.com. Click the toolbar icon to open the panel and use "Carregar do Instagram" (Load from Instagram). Unfollow/remove only happen after the user selects accounts and confirms, with a 30–60 s wait between each and a daily limit.*

**Só para o Firefox (se o revisor perguntar pelos avisos de `innerHTML`):** todo o texto vindo do Instagram passa pela função `esc()` em `content.js` antes de entrar no HTML, e as imagens só aceitam URLs dos servidores do Instagram.
*EN: All text coming from Instagram goes through `esc()` in `content.js` before being inserted as HTML; images only load from Instagram's servers.*
