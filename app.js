/* =========================================================
   Fonniñez · Agendas de campo
   El equipo toma agendas por municipio, descarga la planilla
   y registra el recorrido (salí → llegué → terminé).
   Datos en localStorage.
   ========================================================= */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const app = $("#app");

/* ---------- Utilidades ---------- */

const KEY = "fonninez.v1";
const YO_KEY = "fonninez.yo";

const load = (k, d) => {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; }
  catch { return d; }
};
const store = (k, v) => {
  try { localStorage.setItem(k, JSON.stringify(v)); }
  catch { toast("Almacenamiento lleno"); }
};
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
));

function isoLocal(d = new Date()) {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
}
const today = () => isoLocal();
const isoToDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
const addDaysIso = (iso, n) => { const d = isoToDate(iso); d.setDate(d.getDate() + n); return isoLocal(d); };
function dayLabel(iso) {
  const t = today();
  if (iso === t) return "Hoy";
  if (iso === addDaysIso(t, 1)) return "Mañana";
  if (iso === addDaysIso(t, -1)) return "Ayer";
  const s = isoToDate(iso).toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const fmtDate = (iso) => iso
  ? isoToDate(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "";
const fmtTime = (ts) => new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
const fmtDT = (ts) => new Date(ts).toLocaleString("es-CO", {
  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
});
const byFechaHora = (a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora);
const mapsUrl = (ev) => `https://maps.google.com/?q=${ev.lat},${ev.lng}`;

let toastTimer;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

/* ---------- Estados ---------- */

const ESTADOS = {
  disponible: "Disponible",
  asignada: "Asignada",
  en_camino: "En camino",
  en_sitio: "En sitio",
  completada: "Completada",
  cancelada: "Cancelada",
};
const FLUJO = ["asignada", "en_camino", "en_sitio", "completada"];
const NEXT = {
  asignada: { estado: "en_camino", label: "Salí" },
  en_camino: { estado: "en_sitio", label: "Llegué" },
  en_sitio: { estado: "completada", label: "Terminé" },
};
const badge = (e) => `<span class="badge st-${e}">${ESTADOS[e] || e}</span>`;

/* ---------- Datos de ejemplo ---------- */

const MUNICIPIOS = [
  "Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Marsella", "Belén de Umbría",
  "Apía", "Santuario", "Balboa", "La Celia", "Guática", "Quinchía", "Mistrató", "Pueblo Rico",
];

function seed() {
  const P = (nombre, rol) => ({ id: uid(), nombre, rol, telefono: "" });
  const personas = [
    P("Ana Gómez", "Psicosocial"),
    P("Carlos Ruiz", "Promotor"),
    P("Diana López", "Trabajo social"),
    P("Jorge Henao", "Promotor"),
    P("Laura Marín", "Coordinación"),
  ];
  const planillas = [
    { id: uid(), nombre: "Asistencia", columnas: ["Nombre completo", "Documento", "Edad", "Acudiente", "Teléfono", "Firma"], filas: 25 },
    { id: uid(), nombre: "Visita domiciliaria", columnas: ["Niño o niña", "Documento", "Dirección", "Acudiente", "Observaciones", "Firma"], filas: 15 },
    { id: uid(), nombre: "Entrega de kits", columnas: ["Nombre completo", "Documento", "Kit", "Cantidad", "Firma"], filas: 25 },
  ];
  const t = today();
  const A = (dia, hora, municipio, actividad, pl, per, estado) => {
    const personaId = per == null ? null : personas[per].id;
    return {
      id: uid(), fecha: addDaysIso(t, dia), hora, municipio, lugar: "", actividad,
      planillaId: planillas[pl].id, personaId, estado, notas: "", creada: Date.now(),
      eventos: estado === "disponible" ? [] : [{ t: Date.now(), estado, por: personaId }],
    };
  };
  return {
    personas,
    planillas,
    municipios: [...MUNICIPIOS],
    agendas: [
      A(0, "08:00", "Quinchía", "Jornada de registro", 0, 0, "en_sitio"),
      A(0, "09:00", "Mistrató", "Visita domiciliaria", 1, 1, "en_camino"),
      A(0, "10:30", "Santuario", "Taller con familias", 0, 2, "asignada"),
      A(0, "14:00", "Apía", "Entrega de kits", 2, null, "disponible"),
      A(1, "08:00", "Pueblo Rico", "Visita domiciliaria", 1, null, "disponible"),
      A(1, "09:30", "Belén de Umbría", "Taller con familias", 0, 3, "asignada"),
      A(2, "08:00", "Guática", "Entrega de kits", 2, null, "disponible"),
      A(-1, "08:00", "Marsella", "Jornada de registro", 0, 0, "completada"),
    ],
  };
}

/* ---------- Estado ---------- */

let db = load(KEY, null) || seed();
const saveDb = () => store(KEY, db);
saveDb();

function persona(id) { return db.personas.find((p) => p.id === id); }
function planilla(id) { return db.planillas.find((p) => p.id === id) || db.planillas[0]; }
function agenda(id) { return db.agendas.find((a) => a.id === id); }

let yo = load(YO_KEY, null);
if (yo && !persona(yo)) yo = null;
function setYo(id) {
  yo = id;
  store(YO_KEY, id);
  renderChrome();
}

function evento(a, estado) {
  const ev = { t: Date.now(), estado, por: yo };
  a.estado = estado;
  a.eventos.push(ev);
  return ev;
}

function asignar(a, personaId) {
  a.personaId = personaId;
  evento(a, "asignada").por = personaId;
  saveDb();
}
function liberar(a) {
  a.personaId = null;
  evento(a, "disponible");
  saveDb();
}
function avanzar(a, estado) {
  const ev = evento(a, estado);
  saveDb();
  // Ubicación opcional para el seguimiento
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((p) => {
      ev.lat = +p.coords.latitude.toFixed(5);
      ev.lng = +p.coords.longitude.toFixed(5);
      saveDb();
      route();
    }, () => {}, { timeout: 10000, maximumAge: 60000 });
  }
}

/* ---------- Enlace de formularios ---------- */
// data-bind="raiz.ruta" escribe en ctx; las raíces f, w y s son temporales (no se guardan).

const ctx = {};
let view = {};
const TEMP = ["f.", "w.", "s."];

const getPath = (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj);
function setPath(obj, path, val) {
  const keys = path.split(".");
  const last = keys.pop();
  keys.reduce((o, k) => (o[k] ??= {}), obj)[last] = val;
}
function fillBinds(root = app) {
  $$("[data-bind]", root).forEach((el) => { el.value = getPath(ctx, el.dataset.bind) ?? ""; });
}

document.addEventListener("input", (e) => {
  const el = e.target;
  const path = el.dataset?.bind;
  if (!path) return;
  setPath(ctx, path, el.type === "number" ? num(el.value) : el.value);
  if (!TEMP.some((p) => path.startsWith(p))) saveDb();
  view.onChange?.(path, el);
});

document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-act]");
  if (!b) return;
  const fn = view.actions?.[b.dataset.act] || globalActions[b.dataset.act];
  if (fn) { e.preventDefault(); fn(b, e); }
});

const globalActions = {
  yo: openYo,
  salir: () => { localStorage.removeItem(SESION); setYo(null); checkLogin(); },
  "set-yo": (b) => {
    setYo(b.dataset.id);
    $("#dlgYo").close();
    route();
  },
  open: (b) => { location.hash = `#/a/${b.dataset.id}`; },
  tomar: (b) => {
    if (!yo) return openYo();
    asignar(agenda(b.dataset.id), yo);
    toast("Agenda asignada");
    route();
  },
  avanzar: (b) => {
    avanzar(agenda(b.dataset.id), b.dataset.to);
    route();
  },
  xlsx: (b) => descargarPlanilla(agenda(b.dataset.id)),
  imprimir: (b) => imprimirPlanilla(agenda(b.dataset.id)),
};

function openYo() {
  $("#yoList").innerHTML = db.personas.length
    ? db.personas.map((p) => `
      <button type="button" class="person ${p.id === yo ? "on" : ""}" data-act="set-yo" data-id="${p.id}">
        <strong>${esc(p.nombre)}</strong><span>${esc(p.rol)}</span>
      </button>`).join("")
    : `<p class="empty">Sin equipo · <a href="#/ajustes">Ajustes</a></p>`;
  $("#dlgYo").showModal();
}

/* ---------- Ingreso ---------- */
// Pantalla de entrada local (sin servidor): elige la persona del equipo; no valida la contraseña.

const SESION = "fonninez.sesion";
function checkLogin() {
  const ok = !!load(SESION, null) && !!persona(yo);
  document.body.classList.toggle("locked", !ok);
  $("#login").hidden = ok;
  if (!ok) {
    $("#formLogin").reset();
    $("#loginUser").innerHTML = db.personas.length
      ? `<label>Usuario<select name="user" required>
          <option value="">—</option>
          ${db.personas.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}
        </select></label>`
      : `<label>Nombre<input name="nuevo" required autocomplete="name"></label>`;
  }
  return ok;
}
$("#formLogin").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = e.target;
  let id = f.user?.value;
  if (!id) {
    const p = { id: uid(), nombre: f.nuevo.value.trim(), rol: "", telefono: "" };
    db.personas.push(p);
    saveDb();
    id = p.id;
  }
  setYo(id);
  store(SESION, { t: Date.now() });
  checkLogin();
  route();
});

/* ---------- Router ---------- */

const views = {
  agenda: viewAgenda,
  mi: viewMi,
  seguimiento: viewSeguimiento,
  ajustes: viewAjustes,
  nueva: viewNueva,
  a: viewDetalle,
};
const navOf = { a: "agenda" };

function route() {
  const [name = "agenda", id] = location.hash.replace(/^#\/?/, "").split("/");
  view = {};
  $$("dialog[open]").forEach((d) => d.close());
  const nav = navOf[name] ?? name;
  $$("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === nav));
  (views[name] || viewAgenda)(id ? decodeURIComponent(id) : undefined);
  renderChrome();
}
window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });

function renderChrome() {
  $("#btnYo").textContent = persona(yo)?.nombre || "";
}

function notFound() {
  app.innerHTML = `<div class="page narrow"><p class="empty">No encontrado · <a href="#/agenda">Volver</a></p></div>`;
}

/* ---------- Componentes ---------- */

function agendaRow(a) {
  const p = persona(a.personaId);
  const tomar = a.estado === "disponible" && a.fecha >= today();
  return `
    <div class="row" role="link" tabindex="0" data-act="open" data-id="${a.id}">
      <span class="hora">${esc(a.hora) || "—"}</span>
      <span class="main">
        <strong>${esc(a.municipio)}</strong>
        <span>${esc(a.actividad)}${a.lugar ? ` · ${esc(a.lugar)}` : ""}</span>
      </span>
      <span class="who">${p ? esc(p.nombre) : ""}</span>
      ${badge(a.estado)}
      <span class="row-act">${tomar ? `<button class="small" data-act="tomar" data-id="${a.id}">Asignarme</button>` : ""}</span>
    </div>`;
}

function grouped(list, desc = false) {
  const by = {};
  list.forEach((a) => (by[a.fecha] ??= []).push(a));
  const fechas = Object.keys(by).sort();
  if (desc) fechas.reverse();
  return fechas.map((f) => `
    <section class="day">
      <h3>${dayLabel(f)} <small>${by[f].length}</small></h3>
      <div class="rows">${by[f].sort(byFechaHora).map(agendaRow).join("")}</div>
    </section>`).join("") || `<p class="empty">Sin agendas</p>`;
}

function trackBar(a) {
  if (a.estado === "cancelada") return `<div class="track-cancel">Cancelada</div>`;
  const idx = FLUJO.indexOf(a.estado);
  return `<ol class="track">${FLUJO.map((e, i) =>
    `<li class="${i <= idx ? "on" : ""}"><span></span>${ESTADOS[e]}</li>`).join("")}</ol>`;
}

function timeline(a) {
  if (!a.eventos.length) return "";
  return `<ul class="timeline">${[...a.eventos].reverse().map((ev) => {
    const quien = persona(ev.por);
    return `<li>
      <span class="t">${fmtDT(ev.t)}</span>
      <span>${ESTADOS[ev.estado] || ev.estado}${quien ? ` · ${esc(quien.nombre)}` : ""}</span>
      ${ev.lat ? `<a href="${mapsUrl(ev)}" target="_blank" rel="noopener">Ubicación ↗</a>` : ""}
    </li>`;
  }).join("")}</ul>`;
}

/* ---------- Vista: Agenda ---------- */

const fAg = { vista: "proximas", municipio: "", persona: "" };

function viewAgenda() {
  ctx.f = fAg;
  const t = today();
  const VISTAS = {
    proximas: ["Próximas", (a) => a.fecha >= t && !["cancelada", "completada"].includes(a.estado)],
    hoy: ["Hoy", (a) => a.fecha === t],
    disponibles: ["Disponibles", (a) => a.estado === "disponible" && a.fecha >= t],
    completadas: ["Completadas", (a) => a.estado === "completada"],
    todas: ["Todas", () => true],
  };

  app.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Agenda</h1></div>
      <div class="toolbar">
        <div class="chips" id="chips"></div>
        <div class="selects">
          <select data-bind="f.municipio" aria-label="Municipio">
            <option value="">Todos los municipios</option>
            ${db.municipios.map((m) => `<option>${esc(m)}</option>`).join("")}
          </select>
          <select data-bind="f.persona" aria-label="Responsable">
            <option value="">Todo el equipo</option>
            <option value="-">Sin asignar</option>
            ${db.personas.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div id="lista"></div>
    </div>`;

  function render() {
    $("#chips").innerHTML = Object.entries(VISTAS).map(([k, [label, fn]]) => `
      <button class="chip ${fAg.vista === k ? "on" : ""}" data-act="chip" data-v="${k}">
        ${label} <small>${db.agendas.filter(fn).length}</small>
      </button>`).join("");
    const list = db.agendas
      .filter(VISTAS[fAg.vista][1])
      .filter((a) => !fAg.municipio || a.municipio === fAg.municipio)
      .filter((a) => !fAg.persona || (fAg.persona === "-" ? !a.personaId : a.personaId === fAg.persona));
    $("#lista").innerHTML = grouped(list, ["completadas", "todas"].includes(fAg.vista));
  }

  view.actions = { chip: (b) => { fAg.vista = b.dataset.v; render(); } };
  view.onChange = render;
  fillBinds();
  render();
}

/* ---------- Vista: Mi agenda ---------- */

function viewMi() {
  if (!yo) {
    app.innerHTML = `
      <div class="page narrow">
        <div class="page-head"><h1>¿Quién eres?</h1></div>
        <div class="people">${db.personas.map((p) => `
          <button type="button" class="person" data-act="set-yo" data-id="${p.id}">
            <strong>${esc(p.nombre)}</strong><span>${esc(p.rol)}</span>
          </button>`).join("") || `<p class="empty">Sin equipo · <a href="#/ajustes">Ajustes</a></p>`}
        </div>
      </div>`;
    return;
  }
  const p = persona(yo);
  const t = today();
  const mias = db.agendas.filter((a) => a.personaId === yo);
  const ahora = mias.filter((a) => ["en_camino", "en_sitio"].includes(a.estado)).sort(byFechaHora);
  const prox = mias.filter((a) => a.estado === "asignada").sort(byFechaHora);
  const hechas = mias.filter((a) => a.estado === "completada").sort(byFechaHora).reverse();
  const libres = db.agendas.filter((a) => a.estado === "disponible" && a.fecha >= t).length;

  app.innerHTML = `
    <div class="page narrow">
      <div class="page-head">
        <div><h1>${esc(p.nombre)}</h1><p class="muted">${esc(p.rol)}</p></div>
        ${libres ? `<button data-act="ver-libres">Disponibles <small class="pill">${libres}</small></button>` : ""}
      </div>
      ${ahora.length ? `<h2 class="sec">Ahora</h2><div class="cards">${ahora.map(miCard).join("")}</div>` : ""}
      <h2 class="sec">Próximas</h2>
      ${prox.length ? `<div class="cards">${prox.map(miCard).join("")}</div>` : `<p class="empty">Sin agendas</p>`}
      ${hechas.length ? `
        <details class="done">
          <summary>Completadas · ${hechas.length}</summary>
          <div class="rows">${hechas.map(agendaRow).join("")}</div>
        </details>` : ""}
    </div>`;

  view.actions = {
    "ver-libres": () => { fAg.vista = "disponibles"; location.hash = "#/agenda"; },
  };
}

function miCard(a) {
  const next = NEXT[a.estado];
  return `
    <article class="mcard">
      <div class="mcard-top">
        <div>
          <span class="muted">${dayLabel(a.fecha)} · ${esc(a.hora)}</span>
          <h3>${esc(a.municipio)}</h3>
          <p>${esc(a.actividad)}${a.lugar ? ` · ${esc(a.lugar)}` : ""}</p>
        </div>
        ${badge(a.estado)}
      </div>
      ${trackBar(a)}
      <div class="mcard-actions">
        <button data-act="xlsx" data-id="${a.id}">Planilla ↓</button>
        <a class="btn" href="#/a/${a.id}">Ver</a>
        ${next ? `<button class="primary grow" data-act="avanzar" data-id="${a.id}" data-to="${next.estado}">${next.label}</button>` : ""}
      </div>
    </article>`;
}

/* ---------- Vista: Seguimiento ---------- */

let segFecha = null;

function viewSeguimiento() {
  segFecha ??= today();
  ctx.s = { fecha: segFecha };

  app.innerHTML = `
    <div class="page">
      <div class="page-head">
        <h1>Seguimiento</h1>
        <div class="head-actions">
          <input type="date" data-bind="s.fecha" class="date-in" aria-label="Fecha">
          <button data-act="export">Exportar ↓</button>
        </div>
      </div>
      <div class="stats" id="stats"></div>
      <div class="ttable" id="tabla"></div>
    </div>`;

  function render() {
    const dia = db.agendas.filter((a) => a.fecha === segFecha && a.estado !== "cancelada");
    const count = (e) => dia.filter((a) => a.estado === e).length;
    $("#stats").innerHTML = [
      ["", "Agendas", dia.length],
      ["disponible", "Sin asignar", count("disponible")],
      ["asignada", "Asignadas", count("asignada")],
      ["en_camino", "En camino", count("en_camino")],
      ["en_sitio", "En sitio", count("en_sitio")],
      ["completada", "Completadas", count("completada")],
    ].map(([k, l, n]) => `<div class="stat ${k ? `s-${k}` : ""}"><b>${n}</b><span>${l}</span></div>`).join("");

    const tags = (ags) => ags.sort(byFechaHora).map((a) =>
      `<button class="tag st-${a.estado}" data-act="open" data-id="${a.id}">${esc(a.hora)} · ${esc(a.municipio)}</button>`
    ).join("") || `<span class="muted">—</span>`;

    const filas = db.personas.map((p) => {
      const ags = dia.filter((a) => a.personaId === p.id);
      const last = ags.flatMap((a) => a.eventos).sort((x, y) => y.t - x.t)[0];
      return `
        <div class="trow">
          <div class="tp"><strong>${esc(p.nombre)}</strong><span>${esc(p.rol)}</span></div>
          <div class="tags">${tags(ags)}</div>
          <div class="tlast">${last ? `${ESTADOS[last.estado]} · ${fmtTime(last.t)}${
            last.lat ? ` · <a href="${mapsUrl(last)}" target="_blank" rel="noopener">Ubicación ↗</a>` : ""}` : ""}</div>
        </div>`;
    });
    const libres = dia.filter((a) => !a.personaId);
    if (libres.length) {
      filas.push(`
        <div class="trow">
          <div class="tp"><strong>Sin asignar</strong></div>
          <div class="tags">${tags(libres)}</div>
          <div class="tlast"></div>
        </div>`);
    }
    $("#tabla").innerHTML = filas.join("") || `<p class="empty">Sin equipo</p>`;
  }

  view.onChange = () => { segFecha = ctx.s.fecha || today(); render(); };
  view.actions = { export: exportarSeguimiento };
  fillBinds();
  render();
}

function exportarSeguimiento() {
  const head = ["Fecha", "Hora", "Municipio", "Lugar", "Actividad", "Responsable", "Estado",
    "Salida", "Llegada", "Fin", "Ubicación llegada"];
  const hora = (a, e) => { const ev = a.eventos.filter((x) => x.estado === e).pop(); return ev ? fmtTime(ev.t) : ""; };
  const rows = [
    [{ v: "Fonniñez · Seguimiento de agendas", s: 1 }],
    [],
    head.map((h) => ({ v: h, s: 3 })),
    ...[...db.agendas].sort(byFechaHora).map((a) => {
      const lleg = a.eventos.filter((x) => x.estado === "en_sitio").pop();
      return [
        a.fecha, a.hora, a.municipio, a.lugar, a.actividad, persona(a.personaId)?.nombre || "",
        ESTADOS[a.estado], hora(a, "en_camino"), hora(a, "en_sitio"), hora(a, "completada"),
        lleg?.lat ? `${lleg.lat}, ${lleg.lng}` : "",
      ].map((v) => ({ v, s: 4 }));
    }),
  ];
  XLSX.download(`Seguimiento Fonniñez ${today()}.xlsx`, "Seguimiento", rows,
    [12, 8, 18, 18, 22, 20, 13, 9, 9, 9, 20]);
}

/* ---------- Planillas ---------- */

function planillaInfo(a) {
  const p = a && persona(a.personaId);
  return [
    ["Municipio", a?.municipio || ""],
    ["Lugar", a?.lugar || ""],
    ["Fecha", a ? fmtDate(a.fecha) : ""],
    ["Hora", a?.hora || ""],
    ["Actividad", a?.actividad || ""],
    ["Responsable", p?.nombre || ""],
  ];
}

function descargarPlanilla(a, pl = planilla(a?.planillaId)) {
  if (!pl) return toast("No hay planillas");
  const cols = ["N.º", ...pl.columnas];
  const rows = [
    [{ v: `Fonniñez · Planilla de ${pl.nombre}`, s: 1 }],
    [],
    ...planillaInfo(a).map(([k, v]) => [{ v: k, s: 2 }, { v }]),
    [],
    cols.map((c) => ({ v: c, s: 3 })),
    ...Array.from({ length: num(pl.filas) || 1 }, (_, i) => cols.map((c, j) => ({ v: j === 0 ? i + 1 : "", s: 4 }))),
  ];
  const widths = cols.map((c, j) => (j === 0 ? 6 : /firma/i.test(c) ? 22 : /observ/i.test(c) ? 34 : 24));
  const nombre = a ? `Planilla ${pl.nombre} - ${a.municipio} - ${a.fecha}.xlsx` : `Planilla ${pl.nombre}.xlsx`;
  XLSX.download(nombre, pl.nombre, rows, widths);
}

function imprimirPlanilla(a) {
  const pl = planilla(a.planillaId);
  if (!pl) return toast("No hay planillas");
  $("#print").innerHTML = `
    <div class="pl-head">
      <div><div class="pl-brand">Fonniñez</div><h1>Planilla de ${esc(pl.nombre)}</h1></div>
      <dl>${planillaInfo(a).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v) || "&nbsp;"}</dd>`).join("")}</dl>
    </div>
    <table class="pl-table">
      <thead><tr><th>N.º</th>${pl.columnas.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead>
      <tbody>${Array.from({ length: num(pl.filas) || 1 }, (_, i) =>
        `<tr><td>${i + 1}</td>${pl.columnas.map(() => "<td></td>").join("")}</tr>`).join("")}</tbody>
    </table>`;
  document.body.classList.add("printing");
  window.addEventListener("afterprint", () => document.body.classList.remove("printing"), { once: true });
  window.print();
}

/* ---------- Vista: Detalle de agenda ---------- */

function viewDetalle(id) {
  const a = agenda(id);
  if (!a) return notFound();
  ctx.ag = a;
  const next = NEXT[a.estado];
  const pl = planilla(a.planillaId);
  const cerrada = ["completada", "cancelada"].includes(a.estado);
  const municipios = db.municipios.includes(a.municipio) ? db.municipios : [a.municipio, ...db.municipios];

  app.innerHTML = `
    <div class="page">
      <a class="back" href="#/agenda">← Agenda</a>
      <div class="page-head">
        <div>
          <h1>${esc(a.municipio)}</h1>
          <p class="muted">${dayLabel(a.fecha)} · ${esc(a.hora)} · ${esc(a.actividad)}</p>
        </div>
        ${badge(a.estado)}
      </div>

      <div class="two-col">
        <section class="panel">
          <div class="assign">
            <label>Responsable
              <select id="asignarSel" ${cerrada ? "disabled" : ""}>
                <option value="">Sin asignar</option>
                ${db.personas.map((p) => `<option value="${p.id}" ${p.id === a.personaId ? "selected" : ""}>${esc(p.nombre)}</option>`).join("")}
              </select>
            </label>
            ${a.estado === "disponible" ? `<button class="primary" data-act="tomar" data-id="${a.id}">Asignarme</button>` : ""}
            ${next ? `<button class="primary" data-act="avanzar" data-id="${a.id}" data-to="${next.estado}">${next.label}</button>` : ""}
          </div>
          ${trackBar(a)}
          ${timeline(a)}
          <div class="planilla-box">
            <div><strong>Planilla</strong><span class="muted">${esc(pl?.nombre || "—")}</span></div>
            <div class="head-actions">
              <button data-act="xlsx" data-id="${a.id}">Excel ↓</button>
              <button data-act="imprimir" data-id="${a.id}">Imprimir</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <div class="grid">
            <label>Fecha<input type="date" data-bind="ag.fecha"></label>
            <label>Hora<input type="time" data-bind="ag.hora"></label>
            <label class="span-2">Municipio
              <select data-bind="ag.municipio">${municipios.map((m) => `<option>${esc(m)}</option>`).join("")}</select>
            </label>
            <label class="span-2">Lugar<input data-bind="ag.lugar" placeholder="Vereda, escuela, salón…"></label>
            <label class="span-2">Actividad<input data-bind="ag.actividad" list="actividades"></label>
            <label class="span-2">Planilla
              <select data-bind="ag.planillaId">${db.planillas.map((p) => `<option value="${p.id}">${esc(p.nombre)}</option>`).join("")}</select>
            </label>
            <label class="span-2">Notas<textarea data-bind="ag.notas" rows="3"></textarea></label>
          </div>
          <div class="foot-actions">
            ${cerrada ? "" : `<button class="danger-ghost" data-act="cancelar">Cancelar agenda</button>`}
            <button class="danger-ghost" data-act="eliminar">Eliminar</button>
          </div>
        </section>
      </div>
    </div>`;

  $("#asignarSel").addEventListener("change", (e) => {
    if (e.target.value) asignar(a, e.target.value); else liberar(a);
    route();
  });

  view.actions = {
    cancelar: () => {
      if (!confirm("¿Cancelar esta agenda?")) return;
      evento(a, "cancelada");
      saveDb();
      route();
    },
    eliminar: () => {
      if (!confirm("¿Eliminar esta agenda?")) return;
      db.agendas = db.agendas.filter((x) => x.id !== a.id);
      saveDb();
      location.hash = "#/agenda";
    },
  };
  fillBinds();
}

/* ---------- Vista: Nueva agenda (asistente) ---------- */

function viewNueva() {
  const w = {
    municipios: [], fecha: today(), hora: "08:00", lugar: "", actividad: "",
    planillaId: db.planillas[0]?.id || "", personaId: "",
  };
  ctx.w = w;
  const STEPS = [["donde", "Municipios"], ["cuando", "Fecha"], ["que", "Actividad"], ["quien", "Responsable"]];
  let step = 0;
  let maxStep = 0;

  app.innerHTML = `
    <div class="page narrow">
      <a class="back" href="#/agenda">← Agenda</a>
      <div class="page-head"><h1>Nueva agenda</h1></div>
      <ol class="stepper" id="stepper"></ol>
      <form id="wiz" class="wizard" autocomplete="off">
        <div id="stepBody"></div>
        <div class="wizard-foot">
          <button type="button" data-act="prev" id="btnPrev">← Atrás</button>
          <button type="submit" class="primary" id="btnNext"></button>
        </div>
      </form>
    </div>`;

  const choice = (on, act, attr, label, sub = "") =>
    `<button type="button" class="choice ${on ? "on" : ""}" data-act="${act}" ${attr}>${label}${sub ? `<small>${sub}</small>` : ""}</button>`;

  const bodies = {
    donde: () => `
      <h2 class="step-title">¿Dónde?</h2>
      <div class="choices">${db.municipios.map((m) =>
        choice(w.municipios.includes(m), "tog-mun", `data-m="${esc(m)}"`, esc(m))).join("")}</div>`,
    cuando: () => `
      <h2 class="step-title">¿Cuándo?</h2>
      <div class="grid">
        <label>Fecha *<input type="date" data-bind="w.fecha" required></label>
        <label>Hora<input type="time" data-bind="w.hora"></label>
        <label class="span-2">Lugar<input data-bind="w.lugar" placeholder="Vereda, escuela, salón…"></label>
      </div>`,
    que: () => `
      <h2 class="step-title">¿Qué se hará?</h2>
      <div class="grid">
        <label class="span-2">Actividad *<input data-bind="w.actividad" list="actividades" required></label>
      </div>
      <p class="label">Planilla</p>
      <div class="choices">${db.planillas.map((p) =>
        choice(w.planillaId === p.id, "pick-pl", `data-id="${p.id}"`, esc(p.nombre))).join("")}</div>`,
    quien: () => `
      <h2 class="step-title">¿Quién va?</h2>
      <div class="choices">
        ${choice(!w.personaId, "pick-p", `data-id=""`, "Disponible", "Cualquiera la toma")}
        ${db.personas.map((p) => choice(w.personaId === p.id, "pick-p", `data-id="${p.id}"`, esc(p.nombre), esc(p.rol))).join("")}
      </div>`,
  };

  function render() {
    $("#stepper").innerHTML = STEPS.map(([, label], i) => `
      <li class="${i === step ? "now" : i < step ? "done" : ""}">
        <button type="button" data-act="goto" data-i="${i}" ${i > maxStep ? "disabled" : ""}>
          <span class="n">${i < step ? "✓" : i + 1}</span><span class="l">${label}</span>
        </button>
      </li>`).join("");
    $("#stepBody").innerHTML = bodies[STEPS[step][0]]();
    fillBinds($("#stepBody"));
    $("#btnPrev").style.visibility = step === 0 ? "hidden" : "visible";
    const n = w.municipios.length;
    $("#btnNext").textContent = step === STEPS.length - 1
      ? `Crear ${n} agenda${n === 1 ? "" : "s"}`
      : `Siguiente →${step === 0 && n ? ` (${n})` : ""}`;
  }

  function goTo(i) {
    step = i;
    maxStep = Math.max(maxStep, step);
    render();
    window.scrollTo(0, 0);
  }

  view.actions = {
    "tog-mun": (b) => {
      const m = b.dataset.m;
      w.municipios = w.municipios.includes(m) ? w.municipios.filter((x) => x !== m) : [...w.municipios, m];
      render();
    },
    "pick-pl": (b) => { w.planillaId = b.dataset.id; render(); },
    "pick-p": (b) => { w.personaId = b.dataset.id; render(); },
    prev: () => goTo(Math.max(0, step - 1)),
    goto: (b) => goTo(Number(b.dataset.i)),
  };

  $("#wiz").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!w.municipios.length) { goTo(0); return toast("Elige al menos un municipio"); }
    if (step < STEPS.length - 1) return goTo(step + 1);
    if (!w.actividad.trim()) return goTo(2);

    w.municipios.forEach((m) => {
      db.agendas.push({
        id: uid(), fecha: w.fecha, hora: w.hora, municipio: m, lugar: w.lugar.trim(),
        actividad: w.actividad.trim(), planillaId: w.planillaId, personaId: w.personaId || null,
        estado: w.personaId ? "asignada" : "disponible", notas: "", creada: Date.now(),
        eventos: w.personaId ? [{ t: Date.now(), estado: "asignada", por: w.personaId }] : [],
      });
    });
    saveDb();
    toast(`${w.municipios.length} agenda(s) creada(s)`);
    fAg.vista = "proximas";
    location.hash = "#/agenda";
  });

  render();
}

/* ---------- Vista: Ajustes ---------- */

function viewAjustes() {
  ctx.cfg = db;
  app.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>Ajustes</h1></div>
      <div class="settings">
        <section class="panel">
          <div class="panel-head"><h2>Equipo</h2></div>
          <div id="equipo"></div>
          <button class="add" data-act="add-p">+ Persona</button>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Planillas</h2></div>
          <div id="plans"></div>
          <button class="add" data-act="add-pl">+ Planilla</button>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Municipios</h2></div>
          <div class="mchips" id="muns"></div>
          <form class="inline-add" id="addMun">
            <input id="munIn" placeholder="Municipio" required>
            <button>Agregar</button>
          </form>
        </section>

        <section class="panel">
          <div class="panel-head"><h2>Datos</h2></div>
          <div class="head-actions">
            <button class="danger-ghost" data-act="blank">Empezar en blanco</button>
            <button data-act="reset">Restablecer ejemplo</button>
          </div>
        </section>
      </div>
    </div>`;

  function renderEquipo() {
    $("#equipo").innerHTML = db.personas.map((p, i) => `
      <div class="prow">
        <input data-bind="cfg.personas.${i}.nombre" placeholder="Nombre">
        <input data-bind="cfg.personas.${i}.rol" placeholder="Rol">
        <input data-bind="cfg.personas.${i}.telefono" type="tel" placeholder="Teléfono">
        <button class="icon" data-act="del-p" data-i="${i}" title="Quitar">✕</button>
      </div>`).join("") || `<p class="empty">—</p>`;
    fillBinds($("#equipo"));
  }

  function renderPlans() {
    $("#plans").innerHTML = db.planillas.map((p, i) => `
      <div class="plan">
        <div class="plan-top">
          <input data-bind="cfg.planillas.${i}.nombre" placeholder="Nombre">
          <label class="filas">Filas<input type="number" min="1" max="500" data-bind="cfg.planillas.${i}.filas"></label>
          <button class="icon" data-act="del-pl" data-i="${i}" title="Quitar">✕</button>
        </div>
        <input data-cols="${i}" value="${esc(p.columnas.join(", "))}" placeholder="Columnas, separadas por coma">
        <button class="small" data-act="xlsx-blank" data-i="${i}">Descargar ↓</button>
      </div>`).join("");
    fillBinds($("#plans"));
  }

  function renderMuns() {
    $("#muns").innerHTML = db.municipios.map((m, i) =>
      `<span class="mchip">${esc(m)}<button class="x" data-act="del-m" data-i="${i}" title="Quitar">✕</button></span>`
    ).join("");
  }

  $("#plans").addEventListener("input", (e) => {
    const i = e.target.dataset.cols;
    if (i == null) return;
    db.planillas[i].columnas = e.target.value.split(",").map((s) => s.trim()).filter(Boolean);
    saveDb();
  });

  $("#addMun").addEventListener("submit", (e) => {
    e.preventDefault();
    const m = $("#munIn").value.trim();
    if (!m) return;
    if (!db.municipios.includes(m)) db.municipios.push(m);
    db.municipios.sort((x, y) => x.localeCompare(y, "es"));
    saveDb();
    $("#munIn").value = "";
    renderMuns();
  });

  view.onChange = renderChrome;
  view.actions = {
    "add-p": () => {
      db.personas.push({ id: uid(), nombre: "", rol: "", telefono: "" });
      saveDb();
      renderEquipo();
      $("#equipo .prow:last-child input")?.focus();
    },
    "del-p": (b) => {
      const p = db.personas[b.dataset.i];
      if (!confirm(`¿Quitar a ${p.nombre || "esta persona"}? Sus agendas pendientes quedan disponibles.`)) return;
      db.agendas.forEach((a) => {
        if (a.personaId === p.id && !["completada", "cancelada"].includes(a.estado)) {
          a.personaId = null;
          a.estado = "disponible";
        }
      });
      db.personas.splice(b.dataset.i, 1);
      saveDb();
      if (yo === p.id) { localStorage.removeItem(SESION); setYo(null); checkLogin(); return; }
      renderEquipo();
    },
    "add-pl": () => {
      db.planillas.push({ id: uid(), nombre: "Nueva planilla", columnas: ["Nombre completo", "Documento", "Firma"], filas: 20 });
      saveDb();
      renderPlans();
    },
    "del-pl": (b) => {
      if (db.planillas.length === 1) return toast("Debe quedar al menos una");
      const [quitada] = db.planillas.splice(b.dataset.i, 1);
      db.agendas.forEach((a) => { if (a.planillaId === quitada.id) a.planillaId = db.planillas[0].id; });
      saveDb();
      renderPlans();
    },
    "xlsx-blank": (b) => descargarPlanilla(null, db.planillas[b.dataset.i]),
    "del-m": (b) => {
      db.municipios.splice(b.dataset.i, 1);
      saveDb();
      renderMuns();
    },
    blank: () => {
      if (!confirm("¿Borrar equipo y agendas? Se conservan planillas y municipios.")) return;
      db.personas = [];
      db.agendas = [];
      setYo(null);
      saveDb();
      checkLogin();
    },
    reset: () => {
      if (!confirm("¿Volver a los datos de ejemplo? Se pierde lo actual.")) return;
      db = seed();
      setYo(null);
      saveDb();
      checkLogin();
    },
  };

  renderEquipo();
  renderPlans();
  renderMuns();
}

/* ---------- Inicio ---------- */

checkLogin();
route();
