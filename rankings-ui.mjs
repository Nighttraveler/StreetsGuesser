import { createRankedClient, errorMessage } from './ranked-game-client.mjs';

export function mountRankings({ showGame, practice, setBusy }, api = createRankedClient()) {
  const el = id => document.getElementById(id);
  let cities = [], player, game, finalGame, busy = false, pending, sequence = 0, offset = 0, publishing = false, blocked = false;
  let catalogLoading = false;
  const text = (id, value) => { el(id).textContent = value; };
  const remember = id => { try { localStorage.setItem('ranked-last-game', id); } catch { /* storage optional */ } };
  const lastId = () => { try { return localStorage.getItem('ranked-last-game'); } catch { return null; } };
  function lock(value) {
    busy = value;
    el('rank-start').disabled = value || Boolean(pending) || catalogLoading || !el('rank-difficulty').value;
    el('practice').disabled = value;
    el('publish').disabled = value || Boolean(pending) || publishing || blocked;
    setBusy(value || Boolean(pending));
  }
  async function run(operation) {
    if (busy) return;
    pending = operation;
    el('ranked-retry').hidden = true;
    lock(true);
    try {
      await operation();
      pending = undefined;
    } catch (error) {
      text('ranked-status', `${errorMessage(error)} La práctica sigue disponible.`);
      if (!error.retryable) pending = undefined;
      el('ranked-retry').hidden = !pending;
    } finally {
      lock(false);
      if (!pending && game) {
        if (game.status === 'completed' && !el('publication').hidden) el('username').focus();
        else if (game.status === 'active') el(game.round.resolved ? 'next' : 'answer').focus();
      }
    }
  }
  function publication(value) {
    if (!value.eligible_for_ranking || publishing || finalGame?.id === value.id) return;
    finalGame = value;
    blocked = false;
    el('publication').hidden = false;
    el('publication-form').hidden = false;
    text('publication-result', `${value.city_id} · dificultad ${value.difficulty} · ${value.score} puntos (servidor)`);
    el('username').value = player?.username || '';
    el('username').readOnly = Boolean(player?.username);
    el('publish-consent').checked = false;
    el('publish').disabled = false;
    text('publication-status', 'El nombre todavía no está confirmado para esta publicación.');
  }
  async function accept(value) {
    // Always request the immutable server snapshot, never map ranked IDs onto practice data.
    const dataset = await api.dataset(value);
    showGame(value, dataset);
    game = value;
    remember(value.id);
    text('ranked-status', `Modo clasificado · ${value.city_id} · dificultad ${value.difficulty} · ${value.status}`);
    publication(value);
  }
  async function startSelected() {
    if (publishing) return;
    const city = el('rank-city').value, difficulty = Number(el('rank-difficulty').value);
    if (!city || !difficulty) return;
    if (game?.status === 'active' && !confirm('¿Abandonar la partida clasificada y empezar desde cero?')) return;
    let abandoned = false, created;
    await run(async () => {
      if (!player) player = (await api.startSession()).player;
      if (game?.status === 'active' && !abandoned) { await api.abandon(game); abandoned = true; }
      if (!created) {
        try { created = await api.start(city, difficulty); }
        catch (error) {
          if (error.code !== 'ACTIVE_GAME_EXISTS') throw error;
          created = (await api.active()).game;
          if (!created) throw error;
        }
      }
      await accept(created);
    });
  }
  async function refresh(pageOffset = 0) {
    const ticket = ++sequence;
    const city = el('rank-city').value, difficulty = el('rank-difficulty').value;
    el('ranking-list').replaceChildren();
    el('rank-more').hidden = true;
    text('ranking-status', 'Cargando clasificación…');
    try {
      const result = await api.rankings(city, difficulty, pageOffset);
      if (ticket !== sequence) return;
      offset = pageOffset;
      for (const item of result.items) {
        const row = document.createElement('li');
        row.value = item.position;
        row.textContent = `${item.username} · ${item.score} puntos · ${new Date(item.completed_at).toLocaleString('es-AR')}`;
        el('ranking-list').append(row);
      }
      text('ranking-status', result.items.length ? `${result.pagination.total} jugadores · clasificación actual` : 'Todavía no hay resultados en esta página.');
      el('rank-more').hidden = !result.pagination.has_more;
    } catch (error) { if (ticket === sequence) text('ranking-status', `No se pudo cargar la clasificación. ${errorMessage(error)} Usá Refrescar para reintentar.`); }
  }
  function difficulties() {
    const city = cities.find(value => value.id === el('rank-city').value);
    el('rank-difficulty').replaceChildren(...(city?.difficulties || []).map(value => new Option(value.name, value.id)));
    const unavailable = !city?.difficulties.length;
    el('rank-difficulty').disabled = unavailable;
    el('rank-start').disabled = unavailable || busy || Boolean(pending);
    el('rank-refresh').disabled = unavailable;
    if (!unavailable) refresh();
  }
  async function loadCatalog() {
    if (catalogLoading) return;
    catalogLoading = true;
    el('catalog-load').disabled = true;
    el('cities-retry').disabled = true;
    el('cities-list').hidden = true;
    el('cities-list').replaceChildren();
    el('cities-list').setAttribute('aria-busy', 'true');
    text('cities-status', 'Cargando ciudades…');
    text('catalog-status', 'Cargando ciudades…');
    cities = [];
    ++sequence; // Discard ranking responses belonging to the previous catalog.
    el('ranking-list').replaceChildren();
    el('rank-more').hidden = true;
    text('ranking-status', '');
    el('rank-city').replaceChildren();
    el('rank-city').disabled = true;
    difficulties();
    try {
      cities = (await api.catalog()).cities;
      for (const city of cities) {
        const row = document.createElement('li');
        row.textContent = city.name;
        el('cities-list').append(row);
      }
      el('cities-list').hidden = !cities.length;
      text('cities-status', cities.length ? 'Ciudades cargadas en el catálogo actual.' : 'No hay ciudades disponibles. Podés jugar en práctica.');
      el('rank-city').replaceChildren(...cities.map(city => new Option(city.name, city.id)));
      el('rank-city').disabled = !cities.length;
      text('catalog-status', cities.length ? 'Elegí ciudad y dificultad.' : 'No hay ciudades disponibles. Podés jugar en práctica.');
      difficulties();
    } catch (error) {
      text('cities-status', 'No se pudieron cargar las ciudades. Reintentá o seguí jugando en práctica.');
      text('catalog-status', `Clasificado no disponible. ${errorMessage(error)} Podés jugar en práctica.`);
    } finally {
      catalogLoading = false;
      el('cities-list').setAttribute('aria-busy', 'false');
      el('catalog-load').disabled = false;
      el('cities-retry').disabled = false;
    }
  }
  el('catalog-load').addEventListener('click', loadCatalog);
  el('cities-retry').addEventListener('click', loadCatalog);
  el('rank-city').addEventListener('change', difficulties);
  el('rank-difficulty').addEventListener('change', () => refresh());
  el('rank-refresh').addEventListener('click', () => refresh());
  el('rank-more').addEventListener('click', () => refresh(offset + 20));
  el('rank-start').addEventListener('click', async () => {
    if (busy || pending || publishing) return;
    // Recovery uses an existing cookie only. Never create a new identity to reclaim an old game.
    if (!game && lastId()) {
      await run(async () => {
        player = (await api.session()).player;
        const active = (await api.active()).game;
        await accept(active || await api.game(lastId()));
      });
      return;
    }
    startSelected();
  });
  el('ranked-retry').addEventListener('click', () => { if (pending) run(pending); });
  el('practice').addEventListener('click', () => {
    if (busy) return;
    // Explicit exit also permits recovery from session loss, without reclaiming that identity.
    if (pending && !confirm('Hay una operación sin confirmar. ¿Salir a práctica? No se publicará ningún resultado local.')) return;
    pending = undefined;
    game = undefined;
    player = undefined;
    try { localStorage.removeItem('ranked-last-game'); } catch { /* optional */ }
    el('ranked-retry').hidden = true;
    lock(false);
    practice();
    text('ranked-status', 'Modo práctica · no publicable.');
  });
  el('publication-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (publishing || busy || pending || blocked || !finalGame || !el('publish-consent').checked) return;
    const username = el('username').value;
    const canonical = username.replace(/^ +| +$/g, '').replace(/[A-Z]/g, ch => ch.toLowerCase());
    if ([...username].length > 64 || !/^[a-z0-9_]{3,20}$/.test(canonical)) {
      text('publication-status', 'Nombre inválido: usá 3 a 20 letras ASCII, números o guion bajo.');
      el('username').focus(); return;
    }
    publishing = true;
    lock(true);
    el('username').disabled = true;
    text('publication-status', 'Enviando al servidor…');
    try {
      const result = await api.submit(finalGame.id, username);
      player = { ...player, username: result.submission.username };
      el('username').value = result.submission.username;
      el('username').readOnly = true;
      blocked = true;
      text('publication-status', result.already_submitted ? 'Este resultado ya estaba publicado.' : result.improved ? `Resultado publicado como ${result.submission.username}. ¡Nueva mejor marca!` : 'Resultado guardado; conservás tu mejor marca.');
      refresh();
    } catch (error) {
      text('publication-status', errorMessage(error));
      if (error.code === 'USERNAME_LOCKED') {
        try {
          player = (await api.session()).player;
          el('username').value = player.username || '';
          el('username').readOnly = Boolean(player.username);
        } catch (sessionError) { text('publication-status', errorMessage(sessionError)); blocked = true; }
      }
      if (['SESSION_REQUIRED', 'GAME_NOT_ELIGIBLE', 'BOARD_VERSION_CHANGED', 'GAME_NOT_FOUND'].includes(error.code)) blocked = true;
      el('username').focus();
    } finally {
      publishing = false;
      el('username').disabled = false;
      lock(false);
    }
  });
  loadCatalog();
  return {
    get game() { return game; },
    get busy() { return busy || Boolean(pending); },
    action(type, answer) {
      if (!game || busy || pending || publishing) return;
      const previous = game;
      let result;
      return run(async () => {
        result ||= await api.action(previous, type, answer);
        await accept(result.game);
        text('ranked-status', ({ wrong: 'Todavía no. Probá otra vez.', correct: `¡Bien! ${result.game.round.revealed_name}`, hint: result.game.round.hint_text, skip: `La respuesta es: ${result.game.round.revealed_name}`, next: 'Mirá la calle resaltada.' })[result.outcome]);
      });
    },
    changeDifficulty() { startSelected(); },
  };
}
