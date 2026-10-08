// Clique no ícone: abre/fecha o painel no separador do Instagram (ou abre o Instagram).
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url && tab.url.startsWith('https://www.instagram.com/')) {
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'toggle' });
    } catch {
      // O separador foi aberto antes de instalar a extensão: recarregar injeta o script.
      await chrome.tabs.reload(tab.id);
    }
  } else {
    await chrome.tabs.create({ url: 'https://www.instagram.com/' });
  }
});

// Fotos de perfil: se o CDN do Instagram recusar a imagem dentro da página,
// a extensão descarrega-a aqui e devolve-a como data: URL.
function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== 'pic') return;
  let host = '';
  try {
    host = new URL(msg.url).hostname;
  } catch {
    /* URL inválida */
  }
  if (!/(\.|^)(cdninstagram\.com|fbcdn\.net)$/.test(host)) {
    sendResponse({});
    return;
  }
  fetch(msg.url, { credentials: 'omit' })
    .then(async (res) => {
      if (!res.ok) return sendResponse({});
      const type = res.headers.get('content-type') || 'image/jpeg';
      sendResponse({ dataUrl: `data:${type};base64,${toBase64(await res.arrayBuffer())}` });
    })
    .catch(() => sendResponse({}));
  return true; // resposta assíncrona
});
