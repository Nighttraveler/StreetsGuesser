import { selectStreet, matchesAnswer, initialState, updateState, hintFor, isMapDrag, panView, streetId, getProgress, nextLevel } from './game.mjs';

const byId = id => document.getElementById(id);
const map = byId('map');
const level = byId('level');
const answer = byId('answer');
const feedback = byId('feedback');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const controls = ['submit', 'hint', 'skip', 'zoom-in', 'zoom-out', 'overview', 'locate'];
let streets = [];
let groups = [];
let current;
let state = initialState();
let fullView;
let targetView;
let view = [0, 0, 1000, 800];
let animation;
let projected = [];
let drag;
let suppressMapClick = false;

function stopDrag() {
  drag = undefined;
  map.classList.remove('dragging');
}
// A new press (including one on a control) cannot inherit a suppressed click.
window.addEventListener('mousedown', () => { suppressMapClick = false; }, true);
map.addEventListener('mousedown', event => {
  if (event.button !== 0 || !fullView ||
      event.target.closest('button, a, input, select, textarea, [role="button"], [contenteditable]')) return;
  drag = { x: event.clientX, y: event.clientY, active: false };
});
window.addEventListener('mousemove', event => {
  if (!drag) return;
  if (!(event.buttons & 1)) { stopDrag(); return; }
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  if (!drag.active && !isMapDrag(dx, dy)) return;
  const matrix = map.getScreenCTM();
  if (!matrix) { stopDrag(); return; }
  cancelAnimationFrame(animation);
  drag.active = true;
  suppressMapClick = true;
  map.classList.add('dragging');
  setView(panView(view, dx, dy, matrix.inverse()));
  drag.x = event.clientX;
  drag.y = event.clientY;
  event.preventDefault();
});
window.addEventListener('mouseup', event => { if (event.button === 0) stopDrag(); });
window.addEventListener('blur', stopDrag);
document.addEventListener('visibilitychange', () => { if (document.hidden) stopDrag(); });
map.addEventListener('click', event => {
  if (!suppressMapClick || event.detail === 0) return;
  suppressMapClick = false;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

function message(text, kind = '') {
  feedback.textContent = text;
  feedback.className = `feedback ${kind}`;
}
function nextDifficulty() {
  const options = [...level.options].filter(option => !option.disabled);
  const value = nextLevel(level.value, options.map(option => option.value));
  return options.find(option => option.value === value);
}
function focusCompletion() {
  (byId('advance').hidden ? level : byId('advance')).focus();
}
function renderState() {
  const { correct, total, completed } = getProgress(streets, level.value, state);
  byId('progress').textContent = `${correct}/${total}`;
  byId('progress-note').hidden = false;
  const destination = nextDifficulty();
  byId('advance').hidden = !completed || !destination;
  byId('advance').textContent = destination ? `Subir a ${destination.textContent} →` : '';
  const unavailable = !current || state.resolved || completed;
  byId('score').textContent = state.score;
  byId('streak').textContent = state.streak;
  answer.disabled = unavailable;
  byId('submit').disabled = unavailable;
  byId('hint').disabled = unavailable || state.hinted;
  byId('skip').disabled = unavailable;
  byId('next').hidden = !state.resolved || completed || !current;
}
function setView(box) {
  view = box;
  map.setAttribute('viewBox', box.join(' '));
}
function zoomTo(box) {
  stopDrag();
  cancelAnimationFrame(animation);
  if (reducedMotion.matches) { setView(box); return; }
  const start = [...view];
  const started = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - started) / 650);
    const eased = 1 - (1 - t) ** 3;
    setView(box.map((value, i) => start[i] + (value - start[i]) * eased));
    if (t < 1) animation = requestAnimationFrame(frame);
  }
  animation = requestAnimationFrame(frame);
}
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches && targetView) { cancelAnimationFrame(animation); setView(targetView); }
});
function bounds(points, minimum = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y);
    x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  const width = Math.max(x1 - x0, minimum, 1);
  const height = Math.max(y1 - y0, minimum, 1);
  return [(x0 + x1 - width) / 2 - width * .18, (y0 + y1 - height) / 2 - height * .18, width * 1.36, height * 1.36];
}
function drawMap() {
  const all = streets.flatMap(s => s.segmentos.flatMap(segment => segment.coordenadas));
  const centerLat = all.reduce((sum, p) => sum + p[1], 0) / all.length;
  const centerLon = all.reduce((sum, p) => sum + p[0], 0) / all.length;
  const cos = Math.cos(centerLat * Math.PI / 180);
  const project = ([lon, lat]) => [(lon - centerLon) * cos * 100000, (centerLat - lat) * 100000];
  projected = streets.map(s => s.segmentos.map(segment => segment.coordenadas.map(project)));
  const ns = 'http://www.w3.org/2000/svg';
  groups = projected.map((segments, index) => {
    const group = document.createElementNS(ns, 'g');
    group.dataset.streetIndex = index;
    for (const points of segments) {
      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', points.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join(' '));
      path.setAttribute('class', 'road');
      group.append(path);
    }
    return group;
  });
  map.replaceChildren(...groups);
  fullView = bounds(projected.flat(2));
  setView(fullView);
}
function nextRound() {
  const previous = current;
  current = selectStreet(streets, level.value, previous, Math.random, state.solvedByLevel[level.value]);
  state = updateState(state, 'next');
  groups.forEach(group => group.querySelectorAll('path').forEach(path => path.classList.remove('active')));
  answer.value = '';
  byId('hint-text').textContent = '';
  const count = getProgress(streets, level.value, state).total;
  byId('level-note').textContent = `${count} calles · ${['Avenidas y vías principales', 'Conexiones intermedias', 'Calles residenciales'][Number(level.value) - 1]}`;
  if (!current) {
    targetView = fullView;
    zoomTo(fullView);
    message('Nivel completado. Podés elegir otra dificultad.', 'success');
    renderState();
    return;
  }
  const index = streets.indexOf(current);
  const group = groups[index];
  group.querySelectorAll('path').forEach(path => path.classList.add('active'));
  // Dibujar la calle activa por encima de toda la red, conservando sus tramos separados.
  map.append(group);
  targetView = bounds(projected[index].flat(), Math.min(fullView[2], fullView[3]) / 6);
  zoomTo(targetView);
  message('Mirá la calle resaltada y probá con su nombre.');
  renderState();
}
byId('answer-form').addEventListener('submit', event => {
  event.preventDefault();
  if (!current || state.resolved || !answer.value.trim()) return;
  const correct = matchesAnswer(answer.value, current);
  state = updateState(state, correct ? 'correct' : 'wrong', current);
  renderState();
  if (correct) {
    message(`¡Bien! Es ${current.nombre}. +${state.hinted ? 5 : 10} puntos.`, 'success');
    if (getProgress(streets, level.value, state).completed) {
      message(`¡Bien! Es ${current.nombre}. +${state.hinted ? 5 : 10} puntos. Nivel completado.`, 'success');
      focusCompletion();
    } else {
      byId('next').focus();
    }
  } else {
    message('Todavía no. Probá otra vez o pedí una pista. Tu racha vuelve a cero.', 'error');
    answer.select();
  }
});
byId('hint').addEventListener('click', () => {
  if (!current || state.resolved) return;
  state = updateState(state, 'hint');
  byId('hint-text').textContent = hintFor(current);
  renderState();
});
byId('skip').addEventListener('click', () => {
  if (!current || state.resolved) return;
  state = updateState(state, 'skip');
  message(`La respuesta es: ${current.nombre}. Mirá el recorrido; avanzá cuando quieras.`);
  renderState();
  byId('next').focus();
});
byId('next').addEventListener('click', () => {
  if (!state.resolved) return;
  nextRound();
  answer.focus();
});
function changeLevel() {
  state = initialState(state.solvedByLevel);
  nextRound();
  if (current) {
    message('Nuevo nivel: puntos y racha reiniciados. ¿Qué calle está resaltada?');
    answer.focus();
  } else {
    focusCompletion();
  }
}
level.addEventListener('change', changeLevel);
byId('advance').addEventListener('click', () => {
  const destination = nextDifficulty();
  if (!getProgress(streets, level.value, state).completed || !destination) return;
  level.value = destination.value;
  changeLevel();
});
byId('overview').addEventListener('click', () => zoomTo(fullView));
byId('locate').addEventListener('click', () => zoomTo(targetView));
function changeZoom(factor) {
  const width = Math.max(fullView[2] / 25, Math.min(fullView[2] * 1.5, view[2] * factor));
  const height = width * view[3] / view[2];
  zoomTo([view[0] + (view[2] - width) / 2, view[1] + (view[3] - height) / 2, width, height]);
}
byId('zoom-in').addEventListener('click', () => changeZoom(.75));
byId('zoom-out').addEventListener('click', () => changeZoom(1 / .75));

function validDataset(data) {
  return Array.isArray(data) && data.length > 0 && [1, 2, 3].every(n => data.some(s => s.nivel === n)) && data.every(s =>
    typeof s.nombre === 'string' && s.nombre.trim() && [1, 2, 3].includes(s.nivel) &&
    Array.isArray(s.osm_way_ids) && s.osm_way_ids.length > 0 &&
    s.osm_way_ids.every(id => Number.isSafeInteger(id) && id > 0) &&
    Array.isArray(s.segmentos) && s.segmentos.length && s.segmentos.every(segment =>
      Array.isArray(segment.coordenadas) && segment.coordenadas.length >= 2 && segment.coordenadas.every(p =>
        Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90))) &&
    new Set(data.map(streetId)).size === data.length;
}
async function load() {
  byId('retry').hidden = true;
  message('Cargando el mapa…');
  try {
    const response = await fetch('./arrecifes_calles.json', { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!validDataset(data)) throw new Error('Formato de calles inválido');
    streets = data;
    drawMap();
    controls.forEach(id => { byId(id).disabled = false; });
    level.disabled = false;
    nextRound();
  } catch (error) {
    message(`No se pudo cargar el mapa (${error.message}). Serví los archivos por HTTP y verificá que arrecifes_calles.json esté junto al índice.`, 'error');
    byId('level-note').textContent = 'Mapa no disponible';
    byId('retry').hidden = false;
  }
}
byId('retry').addEventListener('click', load);
load();
