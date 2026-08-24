/* Los ocho minijuegos. Cada uno recibe (tablero, ctx) y llama a ctx.fin() cuando acaba.
   Implementaciones propias: mecánicas clásicas de entrenamiento (reacción, memoria, cálculo),
   nada copiado de ninguna app concreta. */

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
const az = (a, b) => a + Math.random() * (b - a);
const azEnt = (a, b) => Math.floor(az(a, b + 1));
const mezclar = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(p => p[1]);

/* ------------------------------------------------------------------ REFLEJO */

function reflejo(tablero, ctx) {
  const RONDAS = 5;
  let ronda = 0, tiempos = [], t0 = 0, esperando = false, listo = false;
  const centro = el('div', { class: 'centro' });
  tablero.classList.add('pulsable');
  tablero.append(centro);

  const pintar = (titulo, texto, fondo) => {
    tablero.style.background = fondo || 'var(--fondo-2)';
    centro.replaceChildren(el('h2', {}, titulo), el('p', {}, texto));
  };

  const siguiente = () => {
    ronda++;
    if (ronda > RONDAS) return terminar();
    ctx.hud('Ronda', `${ronda}/${RONDAS}`);
    listo = false; esperando = true;
    pintar('Espera…', 'Toca en cuanto se ponga verde');
    ctx.espera(az(900, 2600), () => {
      if (!esperando) return;
      listo = true; t0 = performance.now();
      pintar('¡YA!', 'toca', 'var(--menta)');
    });
  };

  const terminar = () => {
    const media = tiempos.reduce((s, t) => s + t, 0) / tiempos.length;
    ctx.puntos(Math.max(0, Math.round(1000 - media * 1.6)));
    ctx.fin(`media ${Math.round(media)} ms`);
  };

  tablero.addEventListener('pointerdown', () => {
    if (!esperando) return;
    if (!listo) {
      esperando = false;
      tiempos.push(800);
      pintar('Te has adelantado', 'Esa ronda cuenta como 800 ms', 'var(--coral)');
      ctx.espera(850, siguiente);
      return;
    }
    const ms = Math.round(performance.now() - t0);
    tiempos.push(ms);
    esperando = false; listo = false;
    tablero.style.background = 'var(--fondo-2)';
    centro.replaceChildren(el('div', { class: 'grande-cifra' }, `${ms}`), el('p', {}, 'milisegundos'));
    ctx.espera(700, siguiente);
  });

  pintar('Reflejo', 'Toca para empezar');
  const arranque = () => { tablero.removeEventListener('pointerdown', arranque, true); siguiente(); };
  tablero.addEventListener('pointerdown', arranque, true);
}

/* ----------------------------------------------------------------- PUNTERÍA */

function punteria(tablero, ctx) {
  let combo = 0, viva = null, timer = null;
  const capa = el('div', { style: 'position:absolute; inset:0' });
  tablero.append(capa);
  tablero.classList.add('pulsable');

  const soltar = () => {
    if (viva) viva.remove();
    const r = Math.max(20, 40 - combo * 1.6);
    const x = az(r + 6, capa.clientWidth - r - 6);
    const y = az(r + 6, capa.clientHeight - r - 6);
    viva = el('div', {
      class: 'diana',
      style: `left:${x - r}px; top:${y - r}px; width:${r * 2}px; height:${r * 2}px`,
      onpointerdown: e => {
        e.stopPropagation();
        combo++;
        ctx.vibra(12);
        ctx.suma(12 + Math.min(combo, 10));
        ctx.hud('Combo', `×${combo}`);
        ctx.flotante(x, y, `+${12 + Math.min(combo, 10)}`, 'var(--menta)');
        viva.remove(); viva = null;
        clearTimeout(timer); soltar();
      },
    });
    capa.append(viva);
    timer = ctx.espera(Math.max(620, 1250 - combo * 28), () => {
      combo = 0; ctx.hud('Combo', '×0');
      soltar();
    });
  };

  capa.addEventListener('pointerdown', e => {
    combo = 0; ctx.hud('Combo', '×0'); ctx.suma(-4);
    ctx.flotante(e.offsetX, e.offsetY, '−4', 'var(--coral)');
  });

  ctx.hud('Combo', '×0');
  ctx.reloj(30, () => ctx.fin(`combo máximo ×${combo}`));
  soltar();
}

/* ---------------------------------------------------------------- SECUENCIA */

function secuencia(tablero, ctx) {
  const COLORES = ['var(--coral)', 'var(--ambar)', 'var(--menta)', 'var(--lila)'];
  let serie = [], paso = 0, nivel = 0, aceptando = false;

  const malla = el('div', { class: 'malla', style: 'grid-template-columns:repeat(2,1fr)' });
  const casillas = COLORES.map((c, i) => el('button', {
    class: 'casilla', style: `height:110px; --c:${c}`,
    onpointerdown: () => pulsar(i),
  }));
  malla.append(...casillas);
  tablero.append(malla);

  const brillo = (i, ms = 340) => {
    const b = casillas[i];
    b.style.background = COLORES[i]; b.style.borderColor = COLORES[i];
    ctx.espera(ms, () => { b.style.background = ''; b.style.borderColor = ''; });
  };

  const reproducir = () => {
    aceptando = false;
    ctx.hud('Ronda', String(nivel));
    serie.forEach((v, k) => ctx.espera(420 * k + 350, () => brillo(v, 280)));
    ctx.espera(420 * serie.length + 420, () => { aceptando = true; paso = 0; });
  };

  const subirNivel = () => {
    nivel++;
    serie.push(azEnt(0, 3));
    reproducir();
  };

  const pulsar = i => {
    if (!aceptando) return;
    brillo(i, 180);
    if (serie[paso] === i) {
      paso++;
      if (paso === serie.length) {
        ctx.suma(nivel * 40);
        aceptando = false;
        ctx.espera(520, subirNivel);
      }
    } else {
      aceptando = false;
      casillas[i].classList.add('mal');
      ctx.espera(600, () => ctx.fin(`ronda ${nivel}`));
    }
  };

  subirNivel();
}

/* ------------------------------------------------------------------ CÁLCULO */

function calculo(tablero, ctx) {
  let racha = 0;
  const centro = el('div', { class: 'centro', style: 'width:100%' });
  const enunciado = el('div', { class: 'grande-cifra' });
  const opciones = el('div', { class: 'opciones' });
  centro.append(enunciado, opciones);
  tablero.append(centro);

  const nueva = () => {
    const dif = Math.min(4, Math.floor(racha / 3));
    const ops = ['+', '−', '×'];
    const op = ops[azEnt(0, dif >= 2 ? 2 : 1)];
    let a, b, r;
    if (op === '×') { a = azEnt(2, 4 + dif * 2); b = azEnt(2, 5 + dif * 2); r = a * b; }
    else if (op === '+') { a = azEnt(5, 20 + dif * 25); b = azEnt(4, 18 + dif * 25); r = a + b; }
    else { a = azEnt(12, 30 + dif * 30); b = azEnt(3, a - 1); r = a - b; }

    enunciado.textContent = `${a} ${op} ${b}`;
    const falsos = new Set();
    while (falsos.size < 3) {
      const d = r + azEnt(-9, 9) || r + 1;
      if (d !== r && d >= 0) falsos.add(d);
    }
    opciones.replaceChildren(...mezclar([r, ...falsos]).map(v => el('button', {
      class: 'opcion',
      onpointerdown: () => responder(v === r, v),
    }, String(v))));
  };

  const responder = (bien, v) => {
    if (bien) { racha++; ctx.suma(25); ctx.hud('Racha', String(racha)); ctx.vibra(12); }
    else { racha = 0; ctx.suma(-12); ctx.hud('Racha', '0'); ctx.vibra([18, 40, 18]); }
    ctx.flotanteCentro(bien ? '+25' : '−12', bien ? 'var(--menta)' : 'var(--coral)');
    nueva();
  };

  ctx.hud('Racha', '0');
  ctx.reloj(40, () => ctx.fin(`mejor racha ${racha}`));
  nueva();
}

/* -------------------------------------------------------------------- TINTA */

function tinta(tablero, ctx) {
  const COLORES = [
    { nombre: 'ROJO', css: '#FF5C4D' }, { nombre: 'VERDE', css: '#45E0B0' },
    { nombre: 'AZUL', css: '#5AC8FA' }, { nombre: 'AMARILLO', css: '#FFD24B' },
    { nombre: 'MORADO', css: '#8B7BFF' }, { nombre: 'ROSA', css: '#FF6FB5' },
  ];
  let aciertos = 0;
  const centro = el('div', { class: 'centro', style: 'width:100%' });
  const palabra = el('div', { style: 'font-family:"Bricolage Grotesque",sans-serif; font-weight:800; font-size:clamp(34px,10vw,62px); letter-spacing:-.03em' });
  const pista = el('p', {}, 'Elige el color de la TINTA, no lo que pone');
  const opciones = el('div', { class: 'opciones' });
  centro.append(palabra, pista, opciones);
  tablero.append(centro);

  const nueva = () => {
    const baraja = mezclar(COLORES);
    const texto = baraja[0], tintaColor = baraja[1];
    palabra.textContent = texto.nombre;
    palabra.style.color = tintaColor.css;
    const otras = mezclar(COLORES.filter(c => c !== tintaColor)).slice(0, 3);
    opciones.replaceChildren(...mezclar([tintaColor, ...otras]).map(c => el('button', {
      class: 'opcion color', style: `background:${c.css}; color:#12101B; border-color:${c.css}`,
      onpointerdown: () => responder(c === tintaColor),
    }, c.nombre)));
  };

  const responder = bien => {
    if (bien) { aciertos++; ctx.suma(25); ctx.vibra(12); } else { ctx.suma(-15); ctx.vibra([18, 40, 18]); }
    ctx.hud('Aciertos', String(aciertos));
    ctx.flotanteCentro(bien ? '+25' : '−15', bien ? 'var(--menta)' : 'var(--coral)');
    nueva();
  };

  ctx.hud('Aciertos', '0');
  ctx.reloj(35, () => ctx.fin(`${aciertos} aciertos`));
  nueva();
}

/* ------------------------------------------------------------------ INTRUSO */

function intruso(tablero, ctx) {
  let nivel = 1, fallos = 0;
  const malla = el('div', { class: 'malla' });
  const info = el('div', { class: 'aviso' });
  tablero.append(info, malla);

  const ronda = () => {
    const lado = Math.min(2 + Math.floor(nivel / 2), 6);
    const total = lado * lado;
    const dif = Math.max(4, 46 - nivel * 3.2);           // diferencia de luminosidad
    const tono = azEnt(0, 359);
    const base = `hsl(${tono} 68% 56%)`;
    const raro = `hsl(${tono} 68% ${56 + dif}%)`;
    const cual = azEnt(0, total - 1);

    info.textContent = `Nivel ${nivel} · fallos ${fallos}/3`;
    ctx.hud('Nivel', String(nivel));
    malla.style.gridTemplateColumns = `repeat(${lado},1fr)`;
    malla.replaceChildren(...Array.from({ length: total }, (_, i) => el('button', {
      class: 'casilla',
      style: `aspect-ratio:1; background:${i === cual ? raro : base}; border-color:transparent`,
      onpointerdown: () => elegir(i === cual),
    })));
  };

  const elegir = bien => {
    if (bien) {
      ctx.vibra(12);
      ctx.suma(nivel * 30);
      nivel++;
      ronda();
    } else {
      fallos++;
      ctx.suma(-20);
      if (fallos >= 3) return ctx.fin(`nivel ${nivel}`);
      ronda();
    }
  };

  ctx.reloj(70, () => ctx.fin(`nivel ${nivel}`));
  ronda();
}

/* -------------------------------------------------------------------- ORDEN */

function orden(tablero, ctx) {
  let cuantos = 4, esperando = false, siguiente = 1, cajas = [];
  const capa = el('div', { style: 'position:absolute; inset:0' });
  const info = el('div', { class: 'aviso' });
  tablero.append(info, capa);

  const ronda = () => {
    siguiente = 1;
    ctx.hud('Números', String(cuantos));
    info.textContent = 'Memoriza…';
    capa.replaceChildren();
    const puestos = [];
    for (let i = 1; i <= cuantos; i++) {
      let x, y, choca, intentos = 0;
      do {
        x = az(6, 78); y = az(10, 76);
        choca = puestos.some(p => Math.abs(p.x - x) < 15 && Math.abs(p.y - y) < 17);
      } while (choca && ++intentos < 40);
      puestos.push({ x, y, n: i });
    }
    cajas = puestos.map(p => {
      const b = el('button', {
        class: 'casilla',
        style: `position:absolute; left:${p.x}%; top:${p.y}%; width:56px; height:56px; font-size:22px`,
        onpointerdown: () => tocar(p.n, b),
      }, String(p.n));
      capa.append(b);
      return b;
    });
    esperando = false;
    ctx.espera(700 + cuantos * 320, () => {
      cajas.forEach(b => { b.textContent = ''; b.style.background = 'var(--panel-3)'; });
      info.textContent = 'De menor a mayor';
      esperando = true;
    });
  };

  const tocar = (n, boton) => {
    if (!esperando) return;
    if (n === siguiente) {
      boton.textContent = String(n);
      boton.classList.add('viva');
      siguiente++;
      if (siguiente > cuantos) {
        ctx.suma(cuantos * 45);
        esperando = false;
        cuantos++;
        ctx.espera(520, ronda);
      }
    } else {
      boton.classList.add('mal');
      esperando = false;
      cajas.forEach((b, i) => { b.textContent = String(i + 1); });
      ctx.espera(900, () => ctx.fin(`llegó a ${cuantos}`));
    }
  };

  ctx.reloj(75, () => ctx.fin(`llegó a ${cuantos}`));
  ronda();
}

/* ------------------------------------------------------------------- PARADA */

function parada(tablero, ctx) {
  const TOTAL = 10;
  let intento = 0, ancho = 26, pos = 0, dir = 1, vel = 0.9, corriendo = false, raf = null;

  const centro = el('div', { class: 'centro', style: 'width:100%; max-width:520px' });
  const pistaEl = el('div', { style: 'position:relative; height:54px; background:var(--panel-2); border:1px solid var(--linea); border-radius:12px; overflow:hidden; margin-bottom:16px' });
  const zona = el('div', { style: 'position:absolute; top:0; bottom:0; background:color-mix(in srgb, var(--menta) 34%, transparent); border-left:2px solid var(--menta); border-right:2px solid var(--menta)' });
  const aguja = el('div', { style: 'position:absolute; top:0; bottom:0; width:4px; background:var(--tinta); border-radius:2px' });
  const texto = el('p', {}, 'Toca para parar la aguja dentro de la zona');
  pistaEl.append(zona, aguja);
  centro.append(pistaEl, texto);
  tablero.append(centro);
  tablero.classList.add('pulsable');

  const colocar = () => {
    const izq = 50 - ancho / 2;
    zona.style.left = izq + '%';
    zona.style.width = ancho + '%';
  };

  const bucle = () => {
    pos += dir * vel;
    if (pos >= 100) { pos = 100; dir = -1; }
    if (pos <= 0) { pos = 0; dir = 1; }
    aguja.style.left = `calc(${pos}% - 2px)`;
    if (corriendo) raf = requestAnimationFrame(bucle);
  };

  const nueva = () => {
    intento++;
    if (intento > TOTAL) return ctx.fin(`zona final ${ancho.toFixed(0)}%`);
    ctx.hud('Parada', `${intento}/${TOTAL}`);
    colocar();
    pos = azEnt(0, 100); dir = Math.random() > .5 ? 1 : -1;
    vel = 0.9 + intento * 0.16;
    corriendo = true;
    raf = requestAnimationFrame(bucle);
  };

  const parar = () => {
    if (!corriendo) return;
    corriendo = false;
    cancelAnimationFrame(raf);
    const dist = Math.abs(pos - 50);
    const dentro = dist <= ancho / 2;
    const puntos = dentro ? Math.round(40 + (1 - dist / (ancho / 2)) * 60) : -15;
    ctx.suma(puntos);
    texto.textContent = dentro
      ? (dist < 2 ? '¡Clavada!' : `Dentro · +${puntos}`)
      : 'Fuera de zona · −15';
    ctx.flotanteCentro(puntos > 0 ? `+${puntos}` : '−15', puntos > 0 ? 'var(--menta)' : 'var(--coral)');
    if (dentro) ancho = Math.max(7, ancho - 2);
    ctx.espera(680, nueva);
  };

  tablero.addEventListener('pointerdown', parar);
  ctx.hud('Parada', `0/${TOTAL}`);
  nueva();
}

export const IMPLEMENTACIONES = {
  reflejo, punteria, secuencia, calculo, tinta, intruso, orden, parada,
};
