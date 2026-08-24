import { IMPLEMENTACIONES } from './juegos.js';

const $ = s => document.querySelector(s);
const el = (t, a = {}, ...h) => {
  const n = document.createElement(t);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'class') n.className = v;
    else if (k === 'style') n.style.cssText = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v);
  }
  for (const c of h.flat()) if (c !== null && c !== undefined && c !== false) n.append(c.nodeType ? c : String(c));
  return n;
};
const api = async (ruta, opciones) => {
  const r = await fetch(ruta, { ...opciones, headers: opciones?.body ? { 'content-type': 'application/json' } : undefined });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `Error ${r.status}`);
  return r.json();
};

const vibrar = ms => { try { navigator.vibrate?.(ms); } catch {} };

const estado = {
  jugador: localStorage.getItem('machaca_jugador') || null,
  juegos: [], reto: null, actividad: null, filtro: 'Todos',
};

/* --------------------------------------------------------------- cabecera */

function pintarCabecera() {
  const yo = $('#yo');
  if (!estado.jugador) { yo.replaceChildren(); return; }
  yo.replaceChildren(
    el('span', { class: 'ficha' }, estado.jugador.slice(0, 2).toUpperCase()),
    el('span', { class: 'nom' }, estado.jugador),
    el('button', { onclick: pedirNombre, title: 'Cambiar de jugador' }, 'cambiar'));
}

function pedirNombre(inicial = false) {
  const entrada = el('input', {
    type: 'text', maxlength: 20, placeholder: 'Tu nombre o mote',
    value: inicial ? '' : (estado.jugador || ''),
  });
  const cerrar = () => $('#capa').replaceChildren();
  const aceptar = async () => {
    const v = entrada.value.trim().slice(0, 20);
    if (!v) return entrada.focus();
    estado.jugador = v;
    localStorage.setItem('machaca_jugador', v);
    cerrar(); pintarCabecera();
    await cargar();
    if (location.hash.startsWith('#/juego/')) return;
    pintarCatalogo();
  };
  $('#capa').replaceChildren(el('div', { class: 'velo' },
    el('div', { class: 'caja' },
      el('h2', {}, inicial ? 'Ponte un nombre' : 'Cambiar de jugador'),
      el('p', {}, 'Se usa solo para el ranking. Nada de correos ni contraseñas.'),
      entrada,
      el('div', { style: 'display:flex; gap:10px' },
        el('button', { class: 'btn', style: 'flex:1', onclick: aceptar }, 'Entrar'),
        !inicial && el('button', { class: 'btn suave', onclick: cerrar }, 'Cancelar')))));
  entrada.focus();
  entrada.addEventListener('keydown', e => { if (e.key === 'Enter') aceptar(); });
}

/* --------------------------------------------------------------- catálogo */

async function cargar() {
  const d = await api(`/api/juegos${estado.jugador ? `?jugador=${encodeURIComponent(estado.jugador)}` : ''}`);
  estado.juegos = d.juegos; estado.reto = d.reto; estado.actividad = d.actividad;
}

function cartaJuego(j) {
  const tuyo = j.tuyo;
  return el('article', { class: 'carta', style: `--juego:${j.color}` },
    el('div', { class: 'tapa' },
      el('span', { class: 'icono' }, j.icono),
      el('div', {}, el('span', { class: 'fam' }, j.familia), el('h3', {}, j.nombre))),
    el('p', {}, j.resumen),
    el('div', { class: 'pie' },
      el('span', { class: 'marca-chip' }, 'tu récord ', el('b', {}, tuyo ? String(tuyo.puntos) : '—')),
      tuyo && el('span', { class: 'marca-chip' }, `puesto ${tuyo.puesto}/${tuyo.de}`),
      !tuyo && el('span', { class: 'marca-chip' }, j.duracion),
      el('span', { style: 'flex:1' }),
      el('button', { class: 'btn', onclick: () => (location.hash = `#/juego/${j.id}`) }, 'Jugar')));
}

function pintarCatalogo() {
  const familias = ['Todos', ...new Set(estado.juegos.map(j => j.familia))];
  const reto = estado.juegos.find(j => j.id === estado.reto.juego);
  const vista = el('div', {},
    el('section', { class: 'reto', style: `--juego:${reto.color}` },
      el('div', {},
        el('span', { class: 'etq' }, 'Reto de hoy'),
        el('h2', {}, `${reto.icono} ${reto.nombre}`),
        el('p', {}, reto.resumen)),
      el('span', { class: 'hueco' }),
      el('button', { class: 'btn grande', style: `background:${reto.color}`, onclick: () => (location.hash = `#/juego/${reto.id}`) }, 'Entrenar ahora')),

    el('div', { class: 'filtros' }, familias.map(f => el('button', {
      'aria-pressed': String(estado.filtro === f),
      onclick: () => { estado.filtro = f; pintarCatalogo(); },
    }, f))),

    el('div', { class: 'rejilla' },
      estado.juegos.filter(j => estado.filtro === 'Todos' || j.familia === estado.filtro).map(cartaJuego)),

    el('footer', { class: 'pie-pagina' },
      el('div', {}, `${estado.actividad.partidas} partidas jugadas · ${estado.actividad.jugadores} jugadores · ${estado.actividad.hoy} hoy`),
      el('div', { style: 'margin-top:6px' },
        'Gimnasio de minijuegos para entrenar reflejos, memoria y cálculo. ',
        'Juegos originales; las mecánicas son clásicas de entrenamiento cognitivo.')));

  $('#vista').replaceChildren(vista);
}

/* ------------------------------------------------------------ motor de juego */

function jugar(juego) {
  const impl = IMPLEMENTACIONES[juego.id];
  if (!impl) return pintarCatalogo();

  let puntos = 0, acabado = false;
  const temporizadores = [];
  const marcador = el('b', { class: 'cifra' }, '0');
  const extraEtq = el('span', {}, '—');
  const extraVal = el('b', { class: 'cifra' }, '—');
  const relojVal = el('b', { class: 'cifra' }, '—');
  const barra = el('i', { style: 'width:100%' });
  const tablero = el('div', { class: 'tablero' });

  const limpiar = () => { temporizadores.forEach(t => { clearTimeout(t); clearInterval(t); }); temporizadores.length = 0; };

  const ctx = {
    color: juego.color,
    puntos(n) { puntos = Math.round(n); marcador.textContent = String(puntos); },
    suma(n) { ctx.puntos(Math.max(0, puntos + n)); },
    hud(etiqueta, valor) { extraEtq.textContent = etiqueta; extraVal.textContent = valor; },
    espera(ms, fn) { const t = setTimeout(fn, ms); temporizadores.push(t); return t; },
    reloj(segundos, alAcabar) {
      const fin = performance.now() + segundos * 1000;
      relojVal.textContent = segundos.toFixed(0);
      const i = setInterval(() => {
        const queda = Math.max(0, fin - performance.now());
        relojVal.textContent = (queda / 1000).toFixed(1);
        barra.style.width = `${(queda / (segundos * 1000)) * 100}%`;
        if (queda <= 0) { clearInterval(i); alAcabar(); }
      }, 100);
      temporizadores.push(i);
    },
    vibra(ms) { vibrar(ms); },
    flotante(x, y, texto, color) {
      const f = el('div', { class: 'flotante', style: `left:${x}px; top:${y}px; color:${color}` }, texto);
      tablero.append(f);
      setTimeout(() => f.remove(), 620);
    },
    flotanteCentro(texto, color) {
      const r = tablero.getBoundingClientRect();
      ctx.flotante(r.width / 2 - 14, 26, texto, color);
    },
    fin(detalle) {
      if (acabado) return;
      acabado = true;
      limpiar();
      resultado(juego, puntos, detalle);
    },
  };

  const sala = el('div', { class: 'sala', style: `--juego:${juego.color}` },
    el('div', { class: 'hud' },
      el('div', { class: 'dato' }, el('span', {}, 'Puntos'), marcador),
      el('div', { class: 'dato' }, extraEtq, extraVal),
      el('span', { class: 'hueco' }),
      el('div', { class: 'dato' }, el('span', {}, 'Tiempo'), relojVal),
      el('button', { class: 'btn suave', onclick: () => { limpiar(); location.hash = '#/'; } }, 'Salir')),
    el('div', { class: 'barra-tiempo' }, barra),
    tablero,
    el('p', { class: 'instr' }, juego.instrucciones),
    el('div', { class: 'pie-juego' },
      el('button', { class: 'btn suave', onclick: () => { limpiar(); location.hash = '#/'; } }, 'Salir')));

  $('#vista').replaceChildren(sala);
  ctx.puntos(0);
  impl(tablero, ctx);
  return limpiar;
}

async function resultado(juego, puntos, detalle) {
  const marca = el('div', { class: 'centro' },
    el('span', { class: 'fam' }, 'Se acabó'),
    el('div', { class: 'grande-cifra', style: `color:${juego.color}` }, String(puntos)),
    el('p', {}, detalle || ''),
    el('p', { style: 'color:var(--apagado)' }, 'Guardando marca…'));
  $('#vista').querySelector('.tablero')?.replaceChildren(marca);

  let r = null;
  try {
    r = await api('/api/partida', {
      method: 'POST',
      body: JSON.stringify({ juego: juego.id, jugador: estado.jugador, puntos, detalle }),
    });
  } catch { /* sin conexión: se muestra igual */ }

  const tabla = r ? el('div', { class: 'tabla', style: 'margin-top:16px' },
    r.ranking.map((f, i) => el('div', { class: 'fila' + (f.jugador === estado.jugador ? ' tu' : '') },
      el('span', { class: 'pos' + (i < 3 ? ' podio' : '') }, String(i + 1)),
      el('span', { class: 'nom' }, f.jugador),
      el('span', { class: 'pts' }, String(Math.round(f.puntos)))))) : null;

  const esRecord = r?.esRecord;
  vibrar(esRecord ? [40, 60, 40] : 25);
  document.body.classList.remove('jugando');
  $('#vista').replaceChildren(el('div', { class: 'sala', style: `--juego:${juego.color}` },
    el('div', { class: 'tablero', style: 'min-height:auto; padding:26px 0' },
      el('div', { class: 'centro' },
        el('span', { class: 'fam' }, esRecord ? 'Nuevo récord tuyo' : 'Fin de partida'),
        el('div', { class: 'grande-cifra', style: `color:${juego.color}` }, String(puntos)),
        el('p', {}, detalle || ''),
        r?.puesto && el('p', { style: 'color:var(--tinta-2)' },
          `Puesto ${r.puesto.puesto} de ${r.puesto.de} en ${juego.nombre}`),
        el('div', { class: 'pie-juego', style: 'margin-top:18px' },
          el('button', {
            class: 'btn', style: `background:${juego.color}`,
            onclick: () => { document.body.classList.add('jugando'); jugar(juego); },
          }, 'Otra vez'),
          el('button', { class: 'btn suave', onclick: () => (location.hash = '#/') }, 'Al catálogo')))),
    tabla));
  await cargar();
}

/* ----------------------------------------------------------------- ruteo -- */

let limpiarActual = null;

async function ruta() {
  if (limpiarActual) { limpiarActual(); limpiarActual = null; }
  const h = location.hash.replace(/^#/, '') || '/';
  if (!estado.juegos.length) await cargar();

  if (h.startsWith('/juego/')) {
    const juego = estado.juegos.find(j => j.id === h.split('/')[2]);
    if (!juego) { location.hash = '#/'; return; }
    if (!estado.jugador) { document.body.classList.remove('jugando'); pedirNombre(true); return; }
    limpiarActual = jugar(juego);
    document.body.classList.add('jugando');
    return;
  }
  document.body.classList.remove('jugando');
  pintarCatalogo();
}

async function arrancar() {
  pintarCabecera();
  await cargar();
  await ruta();
  if (!estado.jugador) pedirNombre(true);
  window.addEventListener('hashchange', ruta);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

arrancar();
