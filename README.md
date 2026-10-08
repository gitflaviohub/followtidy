# FollowTidy

Extensão de navegador (Chrome, Edge, Brave, Opera e Firefox 128+) para gerir quem você segue e quem o segue no instagram.com. Mostra quem não segue de volta e permite deixar de seguir ou remover seguidores em lote, com um ritmo seguro.

![Captura](docs/capturas/1-nao-seguem-de-volta.png)

## Funcionalidades
- Listas de **Seguindo** e **Seguidores**, carregadas a partir da sua sessão no instagram.com ou importadas da exportação oficial (JSON)
- Filtros "Não me seguem de volta", "Eu não sigo de volta" e "Só mútuos", pesquisa e ordenação por mais recentes ou mais antigos
- Seleção múltipla para **deixar de seguir** ou **remover seguidor**. Nos mútuos, pode fazer as duas ações de uma vez
- Fila lenta com espera aleatória (por omissão 30–60 s) e limite diário (por omissão 100). A fila para sozinha se o Instagram pedir para abrandar
- Exportação para CSV
- Interface em português ou inglês, com seletor PT/EN no painel (por omissão segue o idioma do navegador)
- Nunca pede a senha. Os dados ficam só no navegador, sem servidor

## Instalar (modo programador)
1. Descarregue ou clone este repositório.
2. Chrome/Edge/Brave: abra `chrome://extensions`, ligue o **Modo de programador**, clique em **Carregar sem compactação** e escolha a pasta `extensao`.
3. Firefox: abra `about:debugging#/runtime/this-firefox`, clique em **Carregar extra temporário** e escolha `extensao/manifest.json`.
4. Abra o instagram.com com a sua conta e clique no ícone do FollowTidy.

## Empacotar para as lojas
```sh
./scripts/empacotar.sh   # cria dist/followtidy-<versão>.zip
```
O texto da loja, as justificações de permissões e as imagens estão em [`docs/`](docs/LOJA.md). A política de privacidade é [`docs/privacidade.html`](docs/privacidade.html) e pode ser publicada com GitHub Pages (pasta `docs`).

## Como funciona
Ver [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

## Aviso
O FollowTidy não tem qualquer ligação ao Instagram ou à Meta. Automatizar ações vai contra os termos de uso do Instagram e pode levar a bloqueios temporários. Use por sua conta e risco.
