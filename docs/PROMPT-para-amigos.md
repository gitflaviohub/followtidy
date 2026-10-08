Quero que você crie uma extensão de navegador chamada **FollowTidy** para gerir quem eu sigo e quem me segue no instagram.com. Escreva todo o código completo, pronto a carregar como "extensão sem compactação", e explique no fim como instalar. A interface fica em português.

## Regras importantes
- A extensão funciona dentro da minha sessão já aberta no instagram.com. Nunca pede nem guarda a minha senha, e não usa a API oficial nem bibliotecas não oficiais.
- Não tem servidor. Os dados ficam só em `chrome.storage.local`.
- Não usa o nome nem o logótipo do Instagram. Mostra o aviso "não tem ligação ao Instagram ou à Meta".

## Estrutura (Manifest V3, compatível com Chrome, Edge, Brave e Firefox 128+)
- `manifest.json` com:
  - `permissions: ["storage"]`
  - `host_permissions` para `https://www.instagram.com/*`, `https://*.cdninstagram.com/*` e `https://*.fbcdn.net/*`
  - `background: { "service_worker": "background.js", "scripts": ["background.js"] }`, para servir ao Chrome e ao Firefox ao mesmo tempo
  - `browser_specific_settings.gecko` com um id próprio e `data_collection_permissions: { required: ["none"] }`
  - `content_scripts` em `https://www.instagram.com/*`
  - ícones de 16, 32, 48 e 128 px
  - `_locales` em pt_BR, pt_PT e en, para o nome e a descrição
- `background.js`:
  - Ao clicar no ícone da extensão: se o separador ativo for o instagram.com, envia `{type:'toggle'}` ao content script (se falhar, recarrega o separador); se não for, abre o instagram.com.
  - Recebe `{type:'pic', url}`, aceita só URLs de cdninstagram.com ou fbcdn.net, descarrega a imagem e devolve-a como `data:` URL em base64. Isto serve de alternativa quando a foto de perfil não carrega na página.
- `content.js`: um painel lateral injetado num Shadow DOM, para isolar os estilos, com tema claro e escuro.

## Como falar com o Instagram (pedidos internos do site, feitos a partir do content script)
- No Firefox, usar `content.fetch`, para os pedidos saírem como se fossem da própria página. Nos outros navegadores, usar `fetch` com `credentials: 'include'`.
- Cabeçalhos de cada pedido:
  - `X-IG-App-ID: 936619743392459`
  - `X-Requested-With: XMLHttpRequest`
  - `X-CSRFToken`, com o valor do cookie `csrftoken`
  - `X-ASBD-ID: 129477`
  - `X-IG-WWW-Claim`, com o valor de `sessionStorage['www-claim-v2']` (ou `'0'` se não existir)
- O id do utilizador vem do cookie `ds_user_id`.
- Listas: `GET /api/v1/friendships/{uid}/following/?count=50` e `GET /api/v1/friendships/{uid}/followers/?count=50&search_surface=follow_list_page`. Paginar com `max_id = next_max_id` e esperar 1,5–3,5 s aleatórios entre páginas.
- Deixar de seguir: o Instagram muda os caminhos com frequência, por isso a extensão tenta estes por ordem e memoriza o que funcionar:
  1. `POST /api/v1/friendships/destroy/{id}/`
  2. `/api/v1/web/friendships/{id}/unfollow/`
  3. `/web/friendships/{id}/unfollow/`
- Remover seguidor, pela mesma lógica:
  1. `/api/v1/web/friendships/{id}/remove_follower/`
  2. `/api/v1/friendships/remove_follower/{id}/`
  3. `/web/friendships/{id}/remove_follower/`
- Corpo dos POST: `user_id={id}&container_module=profile`, com `Content-Type: application/x-www-form-urlencoded`.
- Quando um caminho responde 404, ou 200 mas sem JSON, passa ao seguinte. Ler a resposta como texto e retirar um eventual prefixo `for (;;);` antes do `JSON.parse`.
- Bloqueio: se a resposta for 429, ou trouxer `spam`, `feedback_required` ou `rate_limited`, parar tudo e avisar "O Instagram pediu para abrandar".
- Mensagens de erro: devem mostrar o caminho e o início da resposta, para ser fácil diagnosticar.
- Contas sem id (vindas de uma importação): obter o id com `GET /api/v1/users/web_profile_info/?username=X`, em `data.user.id`.

## Funcionalidades do painel
- Botões **Carregar do Instagram**, **Importar exportação (JSON)** e **Exportar CSV** (com BOM UTF-8).
- Importação da exportação oficial:
  - `following.json`, com `relationships_following[]`
  - `followers_1.json`, que é um array, ou um objeto com `relationships_followers`
  - O nome de utilizador está em `title`, ou em `string_list_data[0].value`, ou no fim do `href`.
- Abas **Seguindo** e **Seguidores**, com contadores. Ao mudar de aba, a seleção é limpa.
- Filtro "Não me seguem de volta" (na aba Seguindo) ou "Eu não sigo de volta" (na aba Seguidores), e pesquisa por @ ou por nome.
- Cada linha tem: caixa de seleção, foto de perfil (sem `referrerpolicy="no-referrer"`, porque isso impede as fotos de carregar), @ com link para o perfil, nome, ícone de verificado ou privado, e uma etiqueta "Mútuo" ou "Não te segue".
- "Selecionar visíveis", "Limpar" e o contador de selecionadas.
- Botão de ação: "Deixar de seguir N" na aba Seguindo e "Remover seguidor N" na aba Seguidores, sempre com confirmação.
- Fila lenta:
  - espera aleatória entre a mínima e a máxima (por omissão 30–60 s), com contagem decrescente visível;
  - limite diário (por omissão 100), com o contador guardado por data;
  - botão Parar;
  - cada conta tratada sai da lista guardada.
- Secção "Ritmo e limites" para editar a espera mínima, a espera máxima e o limite por dia.
- Mostrar 300 linhas de cada vez, com um botão "Mostrar mais".
- Fotos de perfil:
  - usar `loading="lazy"`;
  - quando uma imagem dá erro (ouvir o evento `error` em fase de captura no shadow root), pedir a `data:` URL ao background, guardá-la em cache e voltar a desenhar.

## Detalhes que evitam problemas
- Escapar todo o texto vindo do Instagram antes de o meter no `innerHTML`.
- Ao redesenhar, manter o `scrollTop` da lista. Só voltar ao topo quando mudar a aba, o filtro ou a pesquisa.
- Manter o foco e o cursor no campo de pesquisa enquanto se escreve.
- Durante o carregamento ou a fila, bloquear os botões e as abas.

No fim, dê-me os ficheiros completos (`manifest.json`, `background.js`, `content.js`, os `_locales` e um script para gerar os ícones) e os passos para instalar no Chrome (`chrome://extensions` › Modo de programador › Carregar sem compactação) e no Firefox (`about:debugging` › Carregar extra temporário).
