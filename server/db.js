import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DB_PATH = process.env.MACHACA_DB || path.join(ROOT, 'data', 'machaca.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS partidas (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       TEXT NOT NULL,
  juego    TEXT NOT NULL,
  jugador  TEXT NOT NULL,
  puntos   REAL NOT NULL,
  detalle  TEXT
);
CREATE INDEX IF NOT EXISTS idx_partidas_juego ON partidas(juego, puntos DESC);
CREATE INDEX IF NOT EXISTS idx_partidas_jug   ON partidas(jugador);
`);

/** Nombres de fantasía para sembrar un ranking que no esté vacío el primer día. */
const RIVALES = [
  'La Chispa', 'Dedos', 'Rayo Mena', 'Kiko99', 'Bea', 'Turbo', 'Nano', 'Mar',
  'El Búho', 'Pili', 'Zas', 'Cuco', 'Vera', 'Tato', 'Lucía', 'Chumi',
];

let semilla = 8712345;
const rnd = () => { semilla = (semilla * 1103515245 + 12345) % 2147483648; return semilla / 2147483648; };

/**
 * Marcas de referencia por juego para el ranking inicial: [mínimo, máximo] de puntos
 * plausibles de un jugador decente. Se generan una sola vez.
 */
export function sembrarRanking(juegos) {
  if (db.prepare('SELECT COUNT(*) c FROM partidas').get().c > 0) return false;
  const ins = db.prepare('INSERT INTO partidas (ts,juego,jugador,puntos,detalle) VALUES (?,?,?,?,?)');
  const base = new Date('2026-08-24T09:00:00.000Z').getTime();
  for (const j of juegos) {
    const [min, max] = j.rango;
    for (let i = 0; i < 9; i++) {
      const p = Math.round(min + rnd() * (max - min));
      const cuando = new Date(base - Math.floor(rnd() * 6) * 86400000).toISOString();
      ins.run(cuando, j.id, RIVALES[Math.floor(rnd() * RIVALES.length)], p, 'marca de referencia');
    }
  }
  return true;
}

export function guardar({ juego, jugador, puntos, detalle }) {
  const info = db.prepare('INSERT INTO partidas (ts,juego,jugador,puntos,detalle) VALUES (?,?,?,?,?)')
    .run(new Date().toISOString(), juego, jugador, puntos, detalle || null);
  return Number(info.lastInsertRowid);
}

/** Mejor marca por jugador (una fila por persona), ordenada de mayor a menor. */
export function ranking(juego, limite = 15) {
  return db.prepare(`SELECT jugador, MAX(puntos) puntos, COUNT(*) partidas, MAX(ts) ultima
    FROM partidas WHERE juego = ? GROUP BY jugador ORDER BY puntos DESC LIMIT ?`).all(juego, limite);
}

export function mejorDe(juego, jugador) {
  const r = db.prepare('SELECT MAX(puntos) p FROM partidas WHERE juego=? AND jugador=?').get(juego, jugador);
  return r?.p ?? null;
}

export function puestoDe(juego, jugador) {
  const mejor = mejorDe(juego, jugador);
  if (mejor === null) return null;
  const mejores = db.prepare(`SELECT MAX(puntos) p FROM partidas WHERE juego=? GROUP BY jugador`).all(juego);
  const porEncima = mejores.filter(m => m.p > mejor).length;
  return { puesto: porEncima + 1, de: mejores.length, puntos: mejor };
}

export function resumenJugador(jugador) {
  return {
    partidas: db.prepare('SELECT COUNT(*) c FROM partidas WHERE jugador=?').get(jugador).c,
    juegos: db.prepare('SELECT COUNT(DISTINCT juego) c FROM partidas WHERE jugador=?').get(jugador).c,
    mejores: db.prepare(`SELECT juego, MAX(puntos) puntos FROM partidas WHERE jugador=? GROUP BY juego`).all(jugador),
    ultimas: db.prepare(`SELECT juego, puntos, ts FROM partidas WHERE jugador=? ORDER BY id DESC LIMIT 8`).all(jugador),
  };
}

export function actividad() {
  return {
    partidas: db.prepare('SELECT COUNT(*) c FROM partidas').get().c,
    jugadores: db.prepare('SELECT COUNT(DISTINCT jugador) c FROM partidas').get().c,
    hoy: db.prepare("SELECT COUNT(*) c FROM partidas WHERE substr(ts,1,10)=?")
      .get(new Date().toISOString().slice(0, 10)).c,
  };
}

export { DB_PATH };
