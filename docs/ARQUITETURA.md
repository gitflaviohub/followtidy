# FollowTidy: explicação técnica

## O que faz
O FollowTidy é uma extensão de navegador que lê as listas de **seguindo** e **seguidores** da conta com sessão iniciada no instagram.com e as compara entre si, para encontrar quem não segue de volta. Depois executa, em fila e devagar, as ações de **deixar de seguir** e **remover seguidor** sobre as contas que o utilizador seleciona. Não tem servidor: tudo corre no navegador do utilizador.

## Tecnologias
- **WebExtensions, Manifest V3.** É a API de extensões comum a Chrome, Edge, Brave, Opera e Firefox 128+. Um único `manifest.json` serve para todos:
  - declara `service_worker` (que o Chrome usa) e `scripts` (que o Firefox usa);
  - tem `browser_specific_settings.gecko` para o Firefox;
  - tem `_locales` (pt_BR, pt_PT, en) para o nome e a descrição.
- **JavaScript puro (ES2020).** Sem frameworks, sem dependências e sem passo de build. Os ficheiros carregam tal como estão.
- **Shadow DOM.** O painel fica isolado do CSS do Instagram e vice-versa. O CSS é próprio e segue o tema claro ou escuro do sistema (`prefers-color-scheme`).
- **`chrome.storage.local`** guarda as listas, as definições e o contador diário.
- **Ferramentas usadas só no desenvolvimento** (não fazem parte da extensão):
  - Playwright + Chromium, para testes automáticos contra um Instagram simulado;
  - `web-ext lint` da Mozilla, para validar a compatibilidade com o Firefox;
  - Python/Pillow, para gerar os ícones e as imagens da loja.

## Componentes
| Ficheiro | Contexto de execução | Função |
|---|---|---|
| `manifest.json` | — | Permissões: `storage` e acesso a `www.instagram.com`, `*.cdninstagram.com` e `*.fbcdn.net`. Também regista o content script e o background. |
| `background.js` | Service worker (Chrome) ou background script (Firefox) | (1) Ao clicar no ícone, envia `toggle` ao separador do Instagram, ou abre-o. (2) Serve de proxy de imagens: descarrega fotos de perfil do CDN e devolve-as como `data:` URL. |
| `content.js` | Content script injetado em `https://www.instagram.com/*` | Toda a lógica: pedidos ao Instagram, estado, fila, importação de JSON, CSV e interface. |

## Integração com o Instagram
Não usa a API oficial, porque a Graph API não devolve listas de seguidores nem tem endpoint de unfollow. Também não usa bibliotecas não oficiais, que exigem a senha. A extensão chama os **mesmos endpoints internos que o próprio site instagram.com usa**, a partir da página e com a sessão do utilizador.

**1. Autenticação.** Nenhuma credencial passa pela extensão.
- O content script corre na origem `https://www.instagram.com`, por isso os pedidos `fetch(..., {credentials:'include'})` levam automaticamente os cookies da sessão (`sessionid`, etc.).
- No Firefox, usa `content.fetch`, para o pedido sair com a origem da página e não com a da extensão.
- Lê dois cookies não-httpOnly:
  - `ds_user_id`, o id numérico da conta;
  - `csrftoken`, que vai no cabeçalho `X-CSRFToken` dos POST.

**2. Cabeçalhos** que imitam os pedidos AJAX do site:
- `X-IG-App-ID: 936619743392459`, o id público da app web
- `X-Requested-With: XMLHttpRequest`
- `X-ASBD-ID`
- `X-IG-WWW-Claim`, lido de `sessionStorage`

**3. Leitura das listas.**
- `GET /api/v1/friendships/{uid}/following/?count=50`
- `GET /api/v1/friendships/{uid}/followers/?count=50&search_surface=follow_list_page`

A resposta traz `users[]` (com `pk`, `username`, `full_name`, `profile_pic_url`, `is_private` e `is_verified`) e `next_max_id`. A paginação usa `max_id` até deixar de haver `next_max_id`, com uma pausa aleatória de 1,5–3,5 s entre páginas.

**4. Ações.**
- Os pedidos são `POST` com `application/x-www-form-urlencoded`.
- Como o Instagram muda estes caminhos sem aviso, cada ação tem uma lista de alternativas. A extensão tenta-as por ordem e memoriza a primeira que responde com JSON válido:

| Ação | Caminhos tentados |
|---|---|
| Deixar de seguir | `/api/v1/friendships/destroy/{id}/` → `/api/v1/web/friendships/{id}/unfollow/` → `/web/friendships/{id}/unfollow/` |
| Remover seguidor | `/api/v1/web/friendships/{id}/remove_follower/` → `/api/v1/friendships/remove_follower/{id}/` → `/web/friendships/{id}/remove_follower/` |

Esta lógica de alternativas nasceu do erro "Pedido falhou (200)" que apareceu no teste real: o Instagram respondia com uma página HTML em vez de JSON.

**5. Contas importadas sem id.** O id numérico é obtido com `GET /api/v1/users/web_profile_info/?username=X`.

**6. Tratamento de respostas.**
- 429, ou JSON com `spam`, `feedback_required` ou `rate_limited`: é um bloqueio (`BlockedError`) e a fila para por completo.
- 401 ou 403, ou `login_required`: a sessão é inválida.
- 404, ou 200 sem JSON: o endpoint não existe nesta versão do site (`EndpointError`) e a extensão tenta o caminho seguinte.

**7. Fotos de perfil.**
- As imagens vêm do CDN (`*.cdninstagram.com` e `*.fbcdn.net`) e são carregadas com `loading="lazy"`.
- Se uma `<img>` falhar, o painel pede-a ao background. O background tem permissão para esses domínios, descarrega a imagem sem as restrições da página e devolve-a em base64. O resultado fica em cache.
- No início, o atributo `referrerpolicy="no-referrer"` fazia o CDN recusar as fotos; foi retirado.

**8. Importação offline (alternativa).** A extensão lê os JSON da exportação oficial ("Baixar suas informações"):
- `following.json`, em `relationships_following[]`;
- `followers_1.json`, um array de objetos.

O nome de utilizador sai de `title`, de `string_list_data[0].value` ou do `href`. Este modo não faz nenhum pedido ao Instagram para montar as listas.

## Fila e proteção contra bloqueios
- Entre cada ação há uma espera aleatória entre a mínima e a máxima (por omissão 30–60 s), com contagem decrescente na interface.
- O limite diário (por omissão 100) é guardado como `{date, count}` em `storage`, e o contador volta a zero quando muda o dia.
- A fila para sozinha em caso de bloqueio, de erro, de limite atingido ou quando o utilizador carrega em Parar. Cada conta tratada sai logo da lista guardada.

## Interface e estado
- O estado vive num único objeto: listas, aba, filtro, pesquisa, `Set` de selecionados, flags de ocupado/em execução e definições.
- `render()` volta a desenhar o painel com template strings. Todo o texto vindo do Instagram passa por `esc()`, como proteção contra XSS.
- `render()` preserva o `scrollTop` da lista e o foco da pesquisa. O scroll só volta ao topo quando muda a aba, o filtro ou a pesquisa.
- A lista é desenhada em blocos de 300 linhas, para manter a interface leve com milhares de contas.
- "Não segue de volta" é a diferença entre os dois conjuntos de usernames (em minúsculas).

## Limitações
- Os endpoints são internos e não documentados. Podem mudar a qualquer momento: a lista de alternativas reduz o impacto disso, mas não o elimina.
- Automatizar ações vai contra os termos de uso do Instagram. O risco principal é um bloqueio temporário de ações.
- A interface está só em português. Os `_locales` traduzem apenas o nome e a descrição.
