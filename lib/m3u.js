// lib/m3u.js
// Parser M3U (formato M3U Plus / extendido) + normalización al shape
// que consume el frontend de NexaTV. Vive en el backend para que el
// trabajo pesado de parseo no recaiga en el navegador del usuario.

/**
 * Parsea texto crudo de una lista M3U extendida.
 * Lee #EXTINF con atributos tvg-logo, group-title, tvg-name, tvg-id,
 * tvg-country, tvg-language, y la URL del stream en la línea siguiente.
 */
function parseM3U(text, sourceLabel) {
  const lines = text.split(/\r?\n/);
  const items = [];
  let current = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith("#EXTINF")) {
      const attrs = {};
      const attrRegex = /([a-zA-Z-]+)="([^"]*)"/g;
      let m;
      while ((m = attrRegex.exec(line)) !== null) {
        attrs[m[1].toLowerCase()] = m[2];
      }
      const titleMatch = line.match(/,(.*)$/);
      const title = (titleMatch ? titleMatch[1] : attrs["tvg-name"] || "Sin título").trim();
      current = {
        title,
        logo: attrs["tvg-logo"] || null,
        group: attrs["group-title"] || "General",
        tvgId: attrs["tvg-id"] || null,
        country: attrs["tvg-country"] || null,
        language: attrs["tvg-language"] || null,
        source: sourceLabel,
      };
    } else if (line.startsWith("#")) {
      continue; // otras directivas (#EXTVLCOPT, #EXTGRP, #EXTM3U...)
    } else if (current) {
      current.url = line;
      current.id = slugify(`${sourceLabel}-${current.title}-${items.length}`);
      items.push(current);
      current = null;
    }
  }
  return items;
}

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

const GROUP_TO_SECTION = [
  { keys: ["kids", "cartoon", "infantil", "niñ", "children"], section: "Kids" },
  { keys: ["anime"], section: "Anime" },
  { keys: ["movie", "cine", "pelicul", "film"], section: "Película" },
  { keys: ["series", "serie", "tv show", "drama"], section: "Series" },
  { keys: ["news", "sport", "music", "general", "documentary", "religious"], section: "TV" },
];

function mapGroupToSection(group) {
  const g = (group || "").toLowerCase();
  for (const rule of GROUP_TO_SECTION) {
    if (rule.keys.some((k) => g.includes(k))) return rule.section;
  }
  return "TV";
}

const FALLBACK_PALETTE = [
  "linear-gradient(160deg,#3a2a1a,#0f0a08)",
  "linear-gradient(160deg,#1a2a4a,#05101f)",
  "linear-gradient(160deg,#4a1a1a,#1a0808)",
  "linear-gradient(160deg,#1a4a4a,#081a1a)",
  "linear-gradient(160deg,#3a1a4a,#150a1f)",
  "linear-gradient(160deg,#5a4a1a,#1a1408)",
];

function fallbackGradient(seed) {
  let h = 0;
  const s = String(seed || "x");
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % FALLBACK_PALETTE.length;
  return FALLBACK_PALETTE[Math.abs(h)];
}

/** Normaliza un item M3U crudo al shape que consume el frontend. */
function normalizeItem(raw) {
  const section = mapGroupToSection(raw.group);
  const fallback = fallbackGradient(raw.title || raw.id);
  return {
    id: raw.id,
    title: raw.title,
    cat: section,
    tags: [raw.group ? raw.group.toLowerCase() : "general"].filter(Boolean),
    year: null,
    mins: null,
    blurb: `Canal en vivo · ${raw.group || "General"}${raw.country ? " · " + raw.country : ""}`,
    logoUrl: raw.logo || null,
    img: raw.logo ? `url("${raw.logo}")` : fallback,
    fallbackGrad: fallback,
    isLogoImg: !!raw.logo,
    streamUrl: raw.url,
    live: true,
    source: raw.source,
  };
}

/** Deduplica por título normalizado, conservando el primero con logo si hay choque. */
function dedupe(items) {
  const byKey = new Map();
  for (const item of items) {
    const key = item.title.toLowerCase().trim();
    const existing = byKey.get(key);
    if (!existing || (!existing.isLogoImg && item.isLogoImg)) {
      byKey.set(key, item);
    }
  }
  return Array.from(byKey.values());
}

module.exports = { parseM3U, slugify, mapGroupToSection, normalizeItem, dedupe, fallbackGradient };
