// FollowTidy: painel injetado em instagram.com.
// Usa a sessão que já está aberta no navegador; nunca pede nem guarda a senha.
(() => {
  if (window.__igGestor) return;
  window.__igGestor = true;

  const APP_ID = '936619743392459'; // ID público da app web do Instagram
  const BASE = 'https://www.instagram.com';
  const PAGE_SIZE = 300;

  const state = {
    following: [],
    followers: [],
    updatedAt: null,
    tab: 'following',
    filter: 'all',
    sort: 'recent', // as listas ficam guardadas da mais recente para a mais antiga
    both: false, // nos mútuos, fazer também a ação inversa
    search: '',
    selected: new Set(),
    shown: PAGE_SIZE,
    busy: false,
    running: false,
    stopRequested: false,
    settings: { minDelay: 30, maxDelay: 60, dailyLimit: 100 },
    daily: { date: today(), count: 0 },
    status: '',
    statusKind: '',
  };

  // ---------- utilidades ----------
  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rand = (min, max) => min + Math.random() * (max - min);
  const esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const key = (u) => u.username.toLowerCase();

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  }

  class BlockedError extends Error {}
  // Endpoint que não existe (ou já não existe) nesta versão do Instagram: tentar o seguinte.
  class EndpointError extends Error {}

  // No Firefox, content.fetch faz o pedido como a própria página (mesma origem e cookies).
  const pageFetch = typeof content !== 'undefined' && content && content.fetch ? content.fetch.bind(content) : fetch;

  async function api(path, { method = 'GET', body } = {}) {
    const res = await pageFetch(BASE + path, {
      method,
      credentials: 'include',
      headers: {
        'X-IG-App-ID': APP_ID,
        'X-Requested-With': 'XMLHttpRequest',
        'X-CSRFToken': getCookie('csrftoken') || '',
        'X-ASBD-ID': '129477',
        'X-IG-WWW-Claim': sessionStorage.getItem('www-claim-v2') || '0',
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body,
    });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text.replace(/^for \(;;\);/, ''));
    } catch {
      /* resposta sem JSON */
    }
    if (res.status === 429 || (data && (data.spam || data.message === 'feedback_required' || data.message === 'rate_limited'))) {
      throw new BlockedError('O Instagram pediu para abrandar. Parei tudo; tente de novo daqui a algumas horas.');
    }
    if (res.status === 401 || res.status === 403 || (data && data.message === 'login_required')) {
      throw new Error('Sessão inválida. Entre na sua conta do Instagram neste navegador e tente de novo.');
    }
    if (res.status === 404 || (res.ok && !data)) {
      throw new EndpointError(`Resposta inesperada em ${path} (${res.status}): ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
    }
    if (!res.ok || !data || data.status === 'fail') {
      const why = (data && (data.message || data.error_type)) || text.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`Pedido falhou em ${path} (${res.status}: ${why}).`);
    }
    return data;
  }

  function normalizeUser(u) {
    return {
      id: String(u.pk ?? u.pk_id ?? u.id ?? ''),
      username: u.username,
      full_name: u.full_name || '',
      pic: u.profile_pic_url || '',
      is_private: !!u.is_private,
      is_verified: !!u.is_verified,
    };
  }

  // ---------- armazenamento ----------
  async function load() {
    const s = await chrome.storage.local.get(['lists', 'settings', 'daily']);
    if (s.lists) Object.assign(state, s.lists);
    if (s.settings) Object.assign(state.settings, s.settings);
    if (s.daily && s.daily.date === today()) state.daily = s.daily;
  }
  const saveLists = () =>
    chrome.storage.local.set({ lists: { following: state.following, followers: state.followers, updatedAt: state.updatedAt } });
  const saveSettings = () => chrome.storage.local.set({ settings: state.settings });
  const saveDaily = () => chrome.storage.local.set({ daily: state.daily });

  // ---------- carregar listas pela sessão ----------
  async function fetchList(kind) {
    const uid = getCookie('ds_user_id');
    if (!uid) throw new Error('Não encontrei a sessão. Entre na sua conta do Instagram neste navegador.');
    const out = [];
    let maxId = null;
    do {
      let path = `/api/v1/friendships/${uid}/${kind}/?count=50`;
      if (kind === 'followers') path += '&search_surface=follow_list_page';
      if (maxId) path += `&max_id=${encodeURIComponent(maxId)}`;
      const data = await api(path);
      for (const u of data.users || []) out.push(normalizeUser(u));
      maxId = data.next_max_id || null;
      setStatus(`A carregar ${kind === 'following' ? 'quem você segue' : 'seguidores'}: ${out.length}…`);
      if (state.stopRequested) throw new Error('Carregamento cancelado.');
      if (maxId) await sleep(rand(1500, 3500)); // ritmo humano entre páginas
    } while (maxId);
    return out;
  }

  async function refreshFromInstagram() {
    if (state.busy) return;
    state.busy = true;
    state.stopRequested = false;
    render();
    try {
      state.following = await fetchList('following');
      await sleep(rand(2000, 4000));
      state.followers = await fetchList('followers');
      state.updatedAt = new Date().toISOString();
      state.selected.clear();
      await saveLists();
      setStatus(`Pronto: segue ${state.following.length}, seguidores ${state.followers.length}.`, 'ok');
    } catch (e) {
      setStatus(e.message, 'err');
    } finally {
      state.busy = false;
      render();
    }
  }

  // ---------- importar exportação oficial (JSON) ----------
  function entriesToUsers(entries) {
    const users = [];
    for (const e of entries || []) {
      const sld = (e.string_list_data && e.string_list_data[0]) || {};
      let username = e.title || sld.value;
      if (!username && sld.href) username = sld.href.replace(/\/+$/, '').split('/').pop();
      if (username) users.push({ id: '', username, full_name: '', pic: '', is_private: false, is_verified: false, ts: sld.timestamp || 0 });
    }
    return users.sort((a, b) => b.ts - a.ts);
  }

  async function importFiles(files) {
    let gotFollowing = null;
    let gotFollowers = [];
    let foundFollowers = false;
    for (const f of files) {
      let json;
      try {
        json = JSON.parse(await f.text());
      } catch {
        setStatus(`${f.name} não é um JSON válido.`, 'err');
        return;
      }
      if (json && json.relationships_following) {
        gotFollowing = entriesToUsers(json.relationships_following);
      } else if (Array.isArray(json)) {
        gotFollowers = gotFollowers.concat(entriesToUsers(json));
        foundFollowers = true;
      } else if (json && json.relationships_followers) {
        gotFollowers = gotFollowers.concat(entriesToUsers(json.relationships_followers));
        foundFollowers = true;
      }
    }
    if (!gotFollowing && !foundFollowers) {
      setStatus('Não reconheci os ficheiros. Use following.json e followers_1.json da exportação.', 'err');
      return;
    }
    if (gotFollowing) state.following = gotFollowing;
    if (foundFollowers) state.followers = gotFollowers;
    state.updatedAt = new Date().toISOString();
    state.selected.clear();
    await saveLists();
    setStatus(`Importado: segue ${state.following.length}, seguidores ${state.followers.length}.`, 'ok');
    render();
  }

  // ---------- deixar de seguir ----------
  async function resolveId(username) {
    const data = await api(`/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`);
    const id = data && data.data && data.data.user && data.data.user.id;
    if (!id) throw new Error(`Não encontrei o perfil @${username}.`);
    return String(id);
  }

  // O Instagram muda estes caminhos com frequência: tenta-se cada um e memoriza-se o que funcionou.
  const ENDPOINTS = {
    unfollow: [
      (id) => `/api/v1/friendships/destroy/${id}/`,
      (id) => `/api/v1/web/friendships/${id}/unfollow/`,
      (id) => `/web/friendships/${id}/unfollow/`,
    ],
    remove: [
      (id) => `/api/v1/web/friendships/${id}/remove_follower/`,
      (id) => `/api/v1/friendships/remove_follower/${id}/`,
      (id) => `/web/friendships/${id}/remove_follower/`,
    ],
  };
  const working = {};

  async function postAction(kind, user) {
    if (!user.id) user.id = await resolveId(user.username);
    const body = `user_id=${encodeURIComponent(user.id)}&container_module=profile`;
    const list = ENDPOINTS[kind];
    const order = working[kind] != null ? [working[kind], ...list.keys()].filter((v, i, a) => a.indexOf(v) === i) : [...list.keys()];
    let lastErr;
    for (const i of order) {
      try {
        const data = await api(list[i](user.id), { method: 'POST', body });
        working[kind] = i;
        return data;
      } catch (e) {
        if (!(e instanceof EndpointError)) throw e;
        lastErr = e;
      }
    }
    throw new Error(`Nenhum caminho do Instagram funcionou. ${lastErr.message}`);
  }

  const unfollow = (user) => postAction('unfollow', user);
  const removeFollower = (user) => postAction('remove', user);

  // Textos e ação de cada aba: "following" deixa de seguir, "followers" remove o seguidor.
  const ACTIONS = {
    following: { run: unfollow, verb: 'Deixar de seguir', doing: 'A deixar de seguir', done: 'Deixou de seguir' },
    followers: { run: removeFollower, verb: 'Remover seguidor', doing: 'A remover', done: 'Removeu' },
  };

  const OTHER = { following: 'followers', followers: 'following' };

  async function countdown(seconds, label) {
    for (let s = Math.round(seconds); s > 0 && !state.stopRequested; s--) {
      setStatus(`${label} ${s}s…`);
      await sleep(1000);
    }
  }

  async function runQueue() {
    if (state.running || state.busy) return;
    const kind = state.tab;
    const other = OTHER[kind];
    const action = ACTIONS[kind];
    const both = state.both;
    const queue = state[kind].filter((u) => state.selected.has(key(u)));
    if (!queue.length) return;
    if (state.daily.date !== today()) state.daily = { date: today(), count: 0 };
    state.running = true;
    state.stopRequested = false;
    render();
    let done = 0;
    let extra = 0;
    try {
      for (const user of queue) {
        if (state.stopRequested) {
          setStatus(`Parado. ${action.done} ${done} conta(s).`, 'ok');
          break;
        }
        if (state.daily.count >= state.settings.dailyLimit) {
          setStatus(`Limite diário (${state.settings.dailyLimit}) atingido. Continue amanhã.`, 'err');
          break;
        }
        setStatus(`${action.doing} @${user.username}… (${done + 1}/${queue.length})`);
        const mutual = both && state[other].some((u) => key(u) === key(user));
        await action.run(user);
        done++;
        state.daily.count++;
        await saveDaily();
        state.selected.delete(key(user));
        state[kind] = state[kind].filter((u) => key(u) !== key(user));
        await saveLists();
        render();
        // Mútuo com "cortar ligação": fazer também a ação inversa, após uma pausa curta.
        if (mutual && !state.stopRequested) {
          if (state.daily.count >= state.settings.dailyLimit) {
            setStatus(`Limite diário (${state.settings.dailyLimit}) atingido antes de ${ACTIONS[other].doing.toLowerCase()} @${user.username}.`, 'err');
            break;
          }
          await countdown(rand(5, 12), `${ACTIONS[other].verb} @${user.username} em`);
          if (state.stopRequested) break;
          setStatus(`${ACTIONS[other].doing} @${user.username}…`);
          const twin = state[other].find((u) => key(u) === key(user));
          if (twin && !twin.id) twin.id = user.id;
          await ACTIONS[other].run(twin || user);
          state.daily.count++;
          await saveDaily();
          state[other] = state[other].filter((u) => key(u) !== key(user));
          extra++;
          await saveLists();
          render();
        }
        if (done < queue.length) {
          await countdown(rand(state.settings.minDelay, state.settings.maxDelay), `${action.done} ${done}/${queue.length}. Próxima em`);
        }
      }
      if (!state.stopRequested && done === queue.length) setStatus(`Concluído: ${action.done.toLowerCase()} ${done} conta(s)${extra ? ` e ${ACTIONS[other].done.toLowerCase()} ${extra} (mútuos)` : ''}.`, 'ok');
    } catch (e) {
      setStatus(`${e.message} (feitas: ${done})`, 'err');
    } finally {
      state.running = false;
      render();
    }
  }

  // ---------- vista ----------
  function currentList() {
    const followerSet = new Set(state.followers.map(key));
    const followingSet = new Set(state.following.map(key));
    let list = state.tab === 'following' ? state.following : state.followers;
    const otherSet = state.tab === 'following' ? followerSet : followingSet;
    if (state.filter === 'notBack') list = list.filter((u) => !otherSet.has(key(u)));
    else if (state.filter === 'mutual') list = list.filter((u) => otherSet.has(key(u)));
    if (state.sort === 'oldest') list = list.slice().reverse();
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((u) => u.username.toLowerCase().includes(q) || u.full_name.toLowerCase().includes(q));
    }
    return { list, followerSet, followingSet };
  }

  function exportCsv() {
    const { list } = currentList();
    const rows = [['username', 'nome', 'id', 'privado', 'verificado', 'desde']].concat(
      list.map((u) => [u.username, u.full_name, u.id, u.is_private, u.is_verified, u.ts ? new Date(u.ts * 1000).toISOString().slice(0, 10) : ''])
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = `instagram-${state.tab}-${today()}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- DOM ----------
  let host, root;
  let resetScroll = false;
  // Fotos que o navegador não conseguiu carregar diretamente, já convertidas em data: URL.
  const picCache = new Map();
  const picPending = new Set();

  async function onImgError(e) {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.pic) return;
    const url = img.dataset.pic;
    img.replaceWith(Object.assign(document.createElement('span'), { className: 'ph' }));
    if (picCache.has(url) || picPending.has(url)) return;
    picPending.add(url);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'pic', url });
      picCache.set(url, res && res.dataUrl ? res.dataUrl : '');
    } catch {
      picCache.set(url, '');
    }
    picPending.delete(url);
    schedulePicRender();
  }
  let picTimer = null;
  function schedulePicRender() {
    clearTimeout(picTimer);
    picTimer = setTimeout(() => render(), 300);
  }
  function picHtml(u) {
    if (!u.pic) return '<span class="ph"></span>';
    const cached = picCache.get(u.pic);
    if (cached === '') return '<span class="ph"></span>';
    return `<img src="${esc(cached || u.pic)}" data-pic="${esc(u.pic)}" alt="" loading="lazy">`;
  }

  function setStatus(msg, kind = '') {
    state.status = msg;
    state.statusKind = kind;
    const el = root && root.querySelector('.status');
    if (el) {
      el.textContent = msg;
      el.className = 'status ' + kind;
    }
  }

  function build() {
    host = document.createElement('div');
    host.id = 'ig-gestor-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:none;';
    document.documentElement.appendChild(host);
    root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${CSS}</style><div class="backdrop"></div><div class="panel" role="dialog" aria-label="FollowTidy"></div>`;
    root.querySelector('.backdrop').addEventListener('click', toggle);
    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    root.addEventListener('input', onInput);
    root.addEventListener('error', onImgError, true);
    // O Instagram tem atalhos de teclado (ex.: "B" abre o feedback) ligados ao documento.
    // As teclas escritas no painel não devem sair do Shadow DOM.
    for (const type of ['keydown', 'keypress', 'keyup']) host.addEventListener(type, (e) => e.stopPropagation());
  }

  function render() {
    if (!root) return;
    const panel = root.querySelector('.panel');
    const { list, followerSet, followingSet } = currentList();
    const isFollowing = state.tab === 'following';
    const visible = list.slice(0, state.shown);
    const selCount = state.selected.size;
    const otherKeys = isFollowing ? followerSet : followingSet;
    const selMutual = [...state.selected].filter((k) => otherKeys.has(k)).length;
    const allVisibleSelected = visible.length > 0 && visible.every((u) => state.selected.has(key(u)));
    const locked = state.busy || state.running;
    const searchHasFocus = root.activeElement && root.activeElement.classList.contains('search');
    const oldList = root.querySelector('.list');
    const scrollTop = resetScroll || !oldList ? 0 : oldList.scrollTop;
    resetScroll = false;

    panel.innerHTML = `
      <header>
        <h1>FollowTidy</h1>
        <button class="icon" data-act="close" aria-label="Fechar">✕</button>
      </header>
      <div class="toolbar">
        <button data-act="refresh" ${locked ? 'disabled' : ''}>Carregar do Instagram</button>
        <label class="btn">Importar exportação (JSON)<input type="file" accept=".json,application/json" multiple class="import" hidden ${locked ? 'disabled' : ''}></label>
        <button data-act="csv" ${list.length ? '' : 'disabled'}>Exportar CSV</button>
        ${state.busy ? '<button data-act="stop" class="danger">Cancelar</button>' : ''}
        <span class="muted">${state.updatedAt ? 'Atualizado ' + new Date(state.updatedAt).toLocaleString() : 'Sem dados ainda'}</span>
      </div>
      <nav class="tabs">
        <button data-tab="following" class="${isFollowing ? 'on' : ''}" ${locked ? 'disabled' : ''}>Seguindo (${state.following.length})</button>
        <button data-tab="followers" class="${!isFollowing ? 'on' : ''}" ${locked ? 'disabled' : ''}>Seguidores (${state.followers.length})</button>
      </nav>
      <div class="filters">
        <select class="filter">
          <option value="all" ${state.filter === 'all' ? 'selected' : ''}>Todos</option>
          <option value="notBack" ${state.filter === 'notBack' ? 'selected' : ''}>${isFollowing ? 'Não me seguem de volta' : 'Eu não sigo de volta'}</option>
          <option value="mutual" ${state.filter === 'mutual' ? 'selected' : ''}>Só mútuos</option>
        </select>
        <select class="sort" title="Ordem">
          <option value="recent" ${state.sort === 'recent' ? 'selected' : ''}>Mais recentes primeiro</option>
          <option value="oldest" ${state.sort === 'oldest' ? 'selected' : ''}>Mais antigos primeiro</option>
        </select>
        <input class="search" type="search" placeholder="Procurar por nome ou @" value="${esc(state.search)}">
        <span class="muted">${list.length} conta(s)</span>
      </div>
      <div class="selbar">
              <label><input type="checkbox" class="selall" ${allVisibleSelected ? 'checked' : ''} ${locked ? 'disabled' : ''}> Selecionar visíveis</label>
              <button data-act="selnone" ${selCount && !locked ? '' : 'disabled'}>Limpar</button>
              <span><b>${selCount}</b> selecionada(s)</span>
              <label class="both" title="Nas contas mútuas, faz as duas ações: deixa de seguir e remove dos seguidores">
                <input type="checkbox" class="bothchk" ${state.both ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                ${isFollowing ? 'Nos mútuos, remover também dos seguidores' : 'Nos mútuos, deixar também de seguir'}${selMutual ? ` (${selMutual})` : ''}
              </label>
              ${
                state.running
                  ? '<button data-act="stop" class="danger">Parar</button>'
                  : `<button data-act="run" class="primary" ${selCount && !locked ? '' : 'disabled'}>${ACTIONS[state.tab].verb} ${selCount || ''}</button>`
              }
      </div>
      <ul class="list">
        ${
          visible.length
            ? visible
                .map((u) => {
                  const k = key(u);
                  const mutual = isFollowing ? followerSet.has(k) : followingSet.has(k);
                  return `<li>
                    <input type="checkbox" class="sel" data-k="${esc(k)}" ${state.selected.has(k) ? 'checked' : ''} ${locked ? 'disabled' : ''}>
                    ${picHtml(u)}
                    <div class="who">
                      <a href="${BASE}/${esc(u.username)}/" target="_blank" rel="noopener">@${esc(u.username)}</a>${u.is_verified ? ' <span title="Verificado">✔</span>' : ''}${u.is_private ? ' <span class="muted" title="Privado">🔒</span>' : ''}
                      <div class="muted">${esc(u.full_name)}${u.ts ? `${u.full_name ? ' · ' : ''}desde ${new Date(u.ts * 1000).toLocaleDateString()}` : ''}</div>
                    </div>
                    <span class="tag ${mutual ? 'mut' : ''}">${mutual ? 'Mútuo' : isFollowing ? 'Não te segue' : 'Não segues'}</span>
                  </li>`;
                })
                .join('')
            : `<li class="empty">${state.following.length || state.followers.length ? 'Nada com estes filtros.' : 'Clique em “Carregar do Instagram” ou importe a exportação oficial.'}</li>`
        }
      </ul>
      ${list.length > state.shown ? `<button data-act="more" class="more">Mostrar mais (${list.length - state.shown} restantes)</button>` : ''}
      <details class="settings">
        <summary>Ritmo e limites (hoje: ${state.daily.date === today() ? state.daily.count : 0}/${state.settings.dailyLimit})</summary>
        <div class="grid">
          <label>Espera mínima (s) <input type="number" min="10" class="set" data-k="minDelay" value="${state.settings.minDelay}" ${state.running ? 'disabled' : ''}></label>
          <label>Espera máxima (s) <input type="number" min="10" class="set" data-k="maxDelay" value="${state.settings.maxDelay}" ${state.running ? 'disabled' : ''}></label>
          <label>Limite por dia <input type="number" min="1" class="set" data-k="dailyLimit" value="${state.settings.dailyLimit}" ${state.running ? 'disabled' : ''}></label>
        </div>
        <p class="muted">Ritmo lento reduz o risco de bloqueio. Se o Instagram pedir para abrandar, a fila para sozinha.</p>
        <p class="muted">O FollowTidy não tem qualquer ligação ao Instagram ou à Meta. Os dados ficam só neste navegador.</p>
      </details>
      <div class="status ${state.statusKind}" aria-live="polite">${esc(state.status)}</div>
    `;
    root.querySelector('.list').scrollTop = scrollTop;
    if (searchHasFocus) {
      const s = root.querySelector('.search');
      s.focus();
      s.setSelectionRange(s.value.length, s.value.length);
    }
  }

  function onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.tab) {
      if (state.tab !== t.dataset.tab) state.selected.clear();
      state.tab = t.dataset.tab;
      state.shown = PAGE_SIZE;
      resetScroll = true;
      return render();
    }
    switch (t.dataset.act) {
      case 'close':
        return toggle();
      case 'refresh':
        return refreshFromInstagram();
      case 'csv':
        return exportCsv();
      case 'stop':
        state.stopRequested = true;
        return setStatus('A parar…');
      case 'run':
        {
          const other = OTHER[state.tab];
          const mut = state.both ? [...state.selected].filter((k) => state[other].some((u) => key(u) === k)).length : 0;
          const extra = mut ? `\n\nNas ${mut} conta(s) mútua(s), também: ${ACTIONS[other].verb.toLowerCase()} (${state.selected.size + mut} ações no total).` : '';
          if (confirm(`${ACTIONS[state.tab].verb}: ${state.selected.size} conta(s), uma a cada ${state.settings.minDelay}–${state.settings.maxDelay}s?${extra}`)) runQueue();
        }
        return;
      case 'selnone':
        state.selected.clear();
        return render();
      case 'more':
        state.shown += PAGE_SIZE;
        return render();
    }
  }

  function onChange(e) {
    const t = e.target;
    if (t.classList.contains('sel')) {
      t.checked ? state.selected.add(t.dataset.k) : state.selected.delete(t.dataset.k);
      render();
    } else if (t.classList.contains('selall')) {
      const visible = currentList().list.slice(0, state.shown);
      for (const u of visible) t.checked ? state.selected.add(key(u)) : state.selected.delete(key(u));
      render();
    } else if (t.classList.contains('bothchk')) {
      state.both = t.checked;
      render();
    } else if (t.classList.contains('sort')) {
      state.sort = t.value;
      state.shown = PAGE_SIZE;
      resetScroll = true;
      render();
    } else if (t.classList.contains('filter')) {
      state.filter = t.value;
      state.shown = PAGE_SIZE;
      resetScroll = true;
      render();
    } else if (t.classList.contains('import') && t.files.length) {
      importFiles([...t.files]);
    } else if (t.classList.contains('set')) {
      const v = Math.max(Number(t.min) || 1, Math.round(Number(t.value) || 0));
      state.settings[t.dataset.k] = v;
      if (state.settings.maxDelay < state.settings.minDelay) state.settings.maxDelay = state.settings.minDelay;
      saveSettings();
      render();
    }
  }

  function onInput(e) {
    if (e.target.classList.contains('search')) {
      state.search = e.target.value;
      state.shown = PAGE_SIZE;
      resetScroll = true;
      render();
    }
  }

  async function toggle() {
    if (!host) {
      build();
      await load();
    }
    const open = host.style.display !== 'none';
    host.style.display = open ? 'none' : 'block';
    if (!open) render();
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg && msg.type === 'toggle') toggle();
  });

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    .backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); }
    .panel { position: fixed; top: 0; right: 0; height: 100vh; width: min(560px, 100vw); background: #fff; color: #111;
      display: flex; flex-direction: column; gap: 10px; padding: 16px; overflow: hidden; box-shadow: -4px 0 24px rgba(0,0,0,.25); font-size: 14px; }
    @media (prefers-color-scheme: dark) { .panel { background: #121212; color: #f2f2f2; } .list li { border-color: #2a2a2a; }
      button, .btn, select, input { background: #262626; color: #f2f2f2; border-color: #3a3a3a; } }
    header { display: flex; align-items: center; justify-content: space-between; }
    h1 { font-size: 18px; margin: 0; }
    .toolbar, .filters, .selbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    button, .btn { border: 1px solid #ccc; background: #f5f5f5; color: inherit; border-radius: 8px; padding: 6px 10px; cursor: pointer; font-size: 13px; }
    button:disabled { opacity: .5; cursor: default; }
    .primary { background: #0095f6; border-color: #0095f6; color: #fff; }
    .danger { background: #ed4956; border-color: #ed4956; color: #fff; }
    .icon { border: 0; background: none; font-size: 18px; }
    .tabs { display: flex; gap: 4px; }
    .tabs button { flex: 1; }
    .tabs .on { background: #111; color: #fff; border-color: #111; }
    select, input[type=search], input[type=number] { border: 1px solid #ccc; border-radius: 8px; padding: 6px 8px; font-size: 13px; }
    input[type=search] { flex: 1; min-width: 140px; }
    input[type=number] { width: 80px; }
    .list { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; min-height: 0; }
    .list li { display: flex; align-items: center; gap: 10px; padding: 8px 4px; border-bottom: 1px solid #eee; }
    .list img, .ph { width: 36px; height: 36px; border-radius: 50%; background: #ddd; flex: none; }
    .who { flex: 1; min-width: 0; overflow: hidden; }
    .who a { color: inherit; font-weight: 600; text-decoration: none; }
    .muted { color: #8e8e8e; font-size: 12px; }
    .tag { font-size: 11px; padding: 2px 8px; border-radius: 99px; background: #fde8ea; color: #b4232f; white-space: nowrap; }
    .tag.mut { background: #e6f4ea; color: #1e7b34; }
    .empty { justify-content: center; color: #8e8e8e; padding: 24px; }
    .more { align-self: center; }
    .settings .grid { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
    .settings label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
    .status { min-height: 18px; font-size: 13px; }
    .both { display: flex; align-items: center; gap: 4px; font-size: 12px; flex-basis: 100%; }
    .status.err { color: #ed4956; }
    .status.ok { color: #1e7b34; }
  `;
})();
