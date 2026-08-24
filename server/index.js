import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, sembrarRanking, guardar, ranking, puestoDe, resumenJugador, actividad } from './db.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4174);

/**
 * Catálogo. `rango` es la horquilla de puntos de un jugador decente: sirve para sembrar
 * un ranking de referencia y para pintar la barra de "nivel" en la ficha del juego.
 */
export const JUEGOS = [
  {
    id: 'reflejo', nombre: 'Reflejo', familia: 'Reacción', color: '#FF5C4D', icono: '⚡',
    resumen: 'La pantalla se pone verde. Toca antes de que te dé tiempo a pensar.',
    instrucciones: 'Espera al verde y toca. Cinco intentos. Si te adelantas, ese intento se penaliza.',
    duracion: '~20 s', unidad: 'pts', rango: [520, 760],
    entrena: 'Tiempo de reacción puro',
  },
  {
    id: 'punteria', nombre: 'Puntería', familia: 'Precisión', color: '#FFA23E', icono: '◎',
    resumen: 'Dianas que aparecen y se van. Toca todas las que puedas en 30 segundos.',
    instrucciones: 'Cada diana acertada suma 12. Fallar el fondo resta 4. Las dianas encogen con el combo.',
    duracion: '30 s', unidad: 'pts', rango: [380, 780],
    entrena: 'Precisión y velocidad de mano',
  },
  {
    id: 'secuencia', nombre: 'Secuencia', familia: 'Memoria', color: '#8B7BFF', icono: '⬚',
    resumen: 'Cuatro casillas se encienden en orden. Repítelo. Cada ronda añade una más.',
    instrucciones: 'Un fallo y se acaba. Cada ronda superada vale más que la anterior.',
    duracion: '~60 s', unidad: 'pts', rango: [300, 900],
    entrena: 'Memoria de trabajo secuencial',
  },
  {
    id: 'calculo', nombre: 'Cálculo', familia: 'Mente', color: '#45E0B0', icono: '×',
    resumen: 'Operaciones sencillas a toda pastilla durante 40 segundos.',
    instrucciones: 'Acierto +25, fallo −12. Las operaciones se complican según encadenas aciertos.',
    duracion: '40 s', unidad: 'pts', rango: [300, 850],
    entrena: 'Cálculo mental bajo presión',
  },
  {
    id: 'tinta', nombre: 'Tinta', familia: 'Mente', color: '#FF6FB5', icono: '◧',
    resumen: 'La palabra dice un color y está escrita en otro. Elige el color de la tinta.',
    instrucciones: 'Ignora lo que pone, mira de qué color está pintado. Acierto +25, fallo −15.',
    duracion: '35 s', unidad: 'pts', rango: [280, 800],
    entrena: 'Control de la interferencia',
  },
  {
    id: 'intruso', nombre: 'El intruso', familia: 'Vista', color: '#5AC8FA', icono: '▦',
    resumen: 'Una casilla de la cuadrícula tiene un tono distinto. Encuéntrala.',
    instrucciones: 'Cada acierto afina la diferencia y agranda la cuadrícula. Tres fallos y fuera.',
    duracion: '~60 s', unidad: 'pts', rango: [250, 900],
    entrena: 'Discriminación visual fina',
  },
  {
    id: 'orden', nombre: 'Orden', familia: 'Memoria', color: '#C6E14B', icono: '⑫',
    resumen: 'Números repartidos por la pantalla. Se ocultan. Tócalos de menor a mayor.',
    instrucciones: 'Empiezas con 4 números y sube. Un fallo termina la partida.',
    duracion: '~60 s', unidad: 'pts', rango: [280, 880],
    entrena: 'Memoria espacial',
  },
  {
    id: 'parada', nombre: 'Parada', familia: 'Timing', color: '#FFD24B', icono: '⏱',
    resumen: 'Una barra va y viene. Párala dentro de la zona. La zona encoge cada vez.',
    instrucciones: 'Diez paradas. Cuanto más al centro, más puntos. Fallar fuera de zona resta.',
    duracion: '~40 s', unidad: 'pts', rango: [350, 850],
    entrena: 'Sentido del tiempo',
  },
];

sembrarRanking(JUEGOS);

/** Reto del día: determinista por fecha, igual para todo el mundo. */
function retoDelDia(fecha = new Date()) {
  const dias = Math.floor(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()) / 86400000);
  const juego = JUEGOS[dias % JUEGOS.length];
  return { fecha: fecha.toISOString().slice(0, 10), juego: juego.id, nombre: juego.nombre };
}

const rutas = {
  'GET /api/juegos': ({ url }) => {
    const jugador = url.searchParams.get('jugador');
    return {
      juegos: JUEGOS.map(j => ({
        ...j,
        top: ranking(j.id, 3),
        tuyo: jugador ? puestoDe(j.id, jugador) : null,
      })),
      reto: retoDelDia(),
      actividad: actividad(),
    };
  },

  'GET /api/ranking': ({ url }) => {
    const juego = url.searchParams.get('juego');
    const jugador = url.searchParams.get('jugador');
    if (!JUEGOS.some(j => j.id === juego)) throw new Error('Juego desconocido');
    return { juego, ranking: ranking(juego, 20), tuyo: jugador ? puestoDe(juego, jugador) : null };
  },

  'GET /api/jugador': ({ url }) => {
    const nombre = (url.searchParams.get('nombre') || '').trim();
    if (!nombre) throw new Error('Falta el nombre');
    return { nombre, ...resumenJugador(nombre) };
  },

  'POST /api/partida': ({ body }) => {
    const juego = JUEGOS.find(j => j.id === body.juego);
    if (!juego) throw new Error('Juego desconocido');
    const jugador = String(body.jugador || '').trim().slice(0, 20) || 'anónimo';
    const puntos = Math.max(0, Math.min(5000, Math.round(Number(body.puntos) || 0)));
    guardar({ juego: juego.id, jugador, puntos, detalle: body.detalle ? String(body.detalle).slice(0, 120) : null });
    const p = puestoDe(juego.id, jugador);
    return { ok: true, puntos, puesto: p, ranking: ranking(juego.id, 10), esRecord: p?.puntos === puntos };
  },
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json',
};

function leerCuerpo(req) {
  return new Promise((res, rej) => {
    let d = '';
    req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); });
    req.on('end', () => { try { res(d ? JSON.parse(d) : {}); } catch { rej(new Error('JSON no válido')); } });
    req.on('error', rej);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const clave = `${req.method} ${url.pathname}`;
  try {
    if (rutas[clave]) {
      const body = req.method === 'POST' ? await leerCuerpo(req) : {};
      const data = await rutas[clave]({ url, body });
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(data));
    }
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(404, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Endpoint no encontrado' }));
    }

    const rel = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(PUBLIC, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      // rutas tipo /juego/reflejo las sirve el mismo shell
      const shell = path.join(PUBLIC, 'index.html');
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
      return res.end(fs.readFileSync(shell));
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`Machaca en http://localhost:${PORT}`);
  console.log(`${JUEGOS.length} juegos · reto de hoy: ${retoDelDia().nombre}`);
});
