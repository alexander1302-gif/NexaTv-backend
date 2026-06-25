// lib/sources.js
// Fuentes M3U por defecto. Se usan solo la primera vez (cuando KV está
// vacío); después el usuario las gestiona vía /api/sources y quedan
// guardadas en KV, así que editar este archivo no afecta despliegues
// que ya tengan fuentes configuradas.

const DEFAULT_SOURCES = [
  {
    id: "movies",
    label: "Películas (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/movies.m3u",
    enabled: true,
  },
  {
    id: "kids",
    label: "Kids (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/kids.m3u",
    enabled: true,
  },
  {
    id: "general",
    label: "General / TV en vivo (iptv-org)",
    url: "https://iptv-org.github.io/iptv/categories/general.m3u",
    enabled: false,
  },
];

module.exports = { DEFAULT_SOURCES };
