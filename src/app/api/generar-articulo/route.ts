import { NextResponse } from "next/server";

export const maxDuration = 60;

interface FuenteCientifica {
  origen: string;
  titulo: string;
  url: string;
  resumen: string;
}

interface ParrafoArticulo {
  texto: string;
  fuente_url: string;
}

async function interpretarPromptUsuario(inputUsuario: string, apiKey: string) {
  const promptSistema = `
    Eres un bibliotecario científico experto. Analiza la petición informal de un usuario y extrae:
    1. "tema_limpio": El tema central redactado de forma formal y académica en español (elimina muletillas como "dame un texto sobre" o "quiero saber de").
    2. "keywords_en": De 3 a 4 palabras clave técnicas en INGLÉS ideales para buscar artículos en revistas científicas internacionales (separadas por espacios, sin operadores booleanos).

    Responde ÚNICAMENTE con un objeto JSON válido:
    {"tema_limpio": "...", "query_en": "..."}
  `;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: inputUsuario },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    }),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Error interpretando prompt: ${data.error.message}`);
  }

  const resultado = JSON.parse(data.choices[0].message.content);
  return {
    tema_limpio: resultado.tema_limpio || inputUsuario,
    keywords_en: resultado.query_en || resultado.keywords_en || inputUsuario,
  };
}

async function buscarOpenAlex(queryEn: string, maxRes = 5): Promise<FuenteCientifica[]> {
  try {
    const q = encodeURIComponent(queryEn);
    const url = `https://api.openalex.org/works?search=${q}&per-page=${maxRes}&filter=has_abstract:true`;
    const res = await fetch(url, {
      headers: { "User-Agent": "mailto:investigacion@proyecto.edu" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    const fuentes: FuenteCientifica[] = [];

    for (const item of data.results || []) {
      const invIndex: Record<string, number[]> = item.abstract_inverted_index || {};
      const palabras: Record<number, string> = {};
      for (const [palabra, posiciones] of Object.entries(invIndex)) {
        for (const pos of posiciones) palabras[pos] = palabra;
      }
      const resumen = Object.keys(palabras)
        .map(Number)
        .sort((a, b) => a - b)
        .map((i) => palabras[i])
        .join(" ");

      const urlReal = item.doi || item.primary_location?.landing_page_url || item.id;
      const revista = item.primary_location?.source?.display_name || "Publicación Académica";
      const anio = item.publication_year || "";

      if (resumen && urlReal) {
        fuentes.push({
          origen: `OpenAlex | ${revista} (${anio})`,
          titulo: item.title || "Sin título",
          url: urlReal,
          resumen: resumen.slice(0, 1800),
        });
      }
    }
    return fuentes;
  } catch {
    return [];
  }
}

async function buscarSemanticScholar(queryEn: string, maxRes = 5): Promise<FuenteCientifica[]> {
  try {
    const q = encodeURIComponent(queryEn);
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${q}&limit=${maxRes}&fields=title,abstract,url,venue,year`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json();
    const fuentes: FuenteCientifica[] = [];

    for (const item of data.data || []) {
      if (item.abstract && item.url) {
        fuentes.push({
          origen: `Semantic Scholar | ${item.venue || "Semantic Scholar"} (${item.year || ""})`,
          titulo: item.title || "",
          url: item.url,
          resumen: item.abstract.slice(0, 1800),
        });
      }
    }
    return fuentes;
  } catch {
    return [];
  }
}

async function buscarCrossRef(queryEn: string, maxRes = 4): Promise<FuenteCientifica[]> {
  try {
    const q = encodeURIComponent(queryEn);
    const url = `https://api.crossref.org/works?query=${q}&rows=${maxRes}&filter=has-abstract:true`;
    const res = await fetch(url, {
      headers: { "User-Agent": "InvestigacionAcademica/1.0 (mailto:contacto@proyecto.edu)" },
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json();
    const fuentes: FuenteCientifica[] = [];

    for (const item of data.message?.items || []) {
      const titulo = (item.title || ["Sin título"])[0];
      const resumenRaw: string = item.abstract || "";
      const resumen = resumenRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      const urlReal = item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""); const revista = (item["container-title"] \vert{}\vert{} ["Revista Indexada CrossRef"])[0];  if (resumen.length > 100 && urlReal) { fuentes.push({ origen: `CrossRef \vert{} ${revista}`,
          titulo,
          url: urlReal,
          resumen: resumen.slice(0, 1800),
        });
      }
    }
    return fuentes;
  } catch {
    return [];
  }
}

async function buscarArxiv(queryEn: string, maxRes = 3): Promise<FuenteCientifica[]> {
  try {
    const q = encodeURIComponent(queryEn);
    const url = `https://export.arxiv.org/api/query?search_query=ti:${q}+OR+abs:${q}&start=0&max_results=${maxRes}&sortBy=relevance`; const res = await fetch(url, { signal: AbortSignal.timeout(10000) }); const xml = await res.text(); const fuentes: FuenteCientifica[] = [];  const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) \vert{}\vert{} []; for (const entry of entries) { const titulo = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/\s+/g, " ").trim() \vert{}\vert{} ""; const urlId = entry.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() \vert{}\vert{} ""; const summary = entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.replace(/\s+/g, " ").trim() \vert{}\vert{} "";  if (titulo && urlId && summary) { fuentes.push({ origen: "Repositorio ArXiv", titulo, url: urlId, resumen: summary.slice(0, 1800), }); } } return fuentes; } catch { return []; } }  async function recopilarFuentesVariadas(queryEn: string) { const [f1, f2, f3, f4] = await Promise.all([ buscarOpenAlex(queryEn, 5), buscarSemanticScholar(queryEn, 5), buscarCrossRef(queryEn, 4), buscarArxiv(queryEn, 3), ]);  const todas = [...f1, ...f2, ...f3, ...f4]; const vistas = new Set<string>(); const fuentesUnicas: FuenteCientifica[] = []; let contextoTexto = "";  todas.forEach((f, idx) => { const clave = f.titulo.toLowerCase().trim().slice(0, 45); if (!vistas.has(clave)) { vistas.add(clave); fuentesUnicas.push(f); contextoTexto += `\n--- [Fuente ${idx + 1} | ${f.origen}] ---\nTítulo: ${f.titulo}\nURL: ${f.url}\nResumen:${f.resumen}\n`;
    }
  });

  return { contextoTexto, fuentesUnicas };
}

async function llamarBloqueGroq(
  temaLimpio: string,
  contexto: string,
  estructuraJson: string,
  apiKey: string
): Promise<Record<string, ParrafoArticulo[]>> {
  const promptSistema = `
    Eres un investigador senior redactando un artículo científico de revisión para una revista indexada (Q1/Q2).
    Reglas estrictas de redacción y rigor académico:
    1. EXTENSIÓN Y PROFUNDIDAD: Cada párrafo debe ser extenso, analítico y exhaustivo (entre 115 y 160 palabras por párrafo), desarrollando fundamentos técnicos, mecanismos, metodologías y contrastes entre autores con lenguaje académico impecable en español.
    2. CERO ALUCINACIONES: Usa exclusivamente los datos, nombres exactos de datasets/modelos y URLs entregados en las fuentes. PROHIBIDO inventar porcentajes, métricas, experimentos propios o enlaces que no figuren literalmente en el texto fuente.
    3. DIVERSIDAD DE CITAS: Integra y contrasta la mayor variedad posible de las fuentes proporcionadas, citando los estudios en la narrativa y asignando a cada párrafo su URL exacta correspondiente.
    4. Responde ÚNICAMENTE con un objeto JSON válido siguiendo exactamente este esquema:
    ${estructuraJson}
  `;

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      messages: [
        { role: "system", content: promptSistema },
        { role: "user", content: `Tema del artículo: ${temaLimpio}\n\nBase bibliográfica recopilada:\n${contexto}