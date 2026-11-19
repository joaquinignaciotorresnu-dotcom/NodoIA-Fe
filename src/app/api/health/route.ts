export async function GET() {
  return Response.json({ status: "ok" });
}



"use client";

import { useState } from "react";


interface FilaArticulo {
  parrafo_id: number;
  seccion: string;
  texto: string;
  fuente_url: string;
  aprobado: boolean;
  estado_revision: string;
}

interface RespuestaGenerador {
  tema_limpio: string;
  keywords_en: string;
  total_fuentes: number;
  filas: FilaArticulo[];
}

export default function GeneradorPage() {
  const [prompt, setPrompt] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<RespuestaGenerador | null>(null);

  async function manejarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;

    setCargando(true);
    setError(null);
    setResultado(null);

    try {
      const res = await fetch("/api/generar-articulo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al generar el artículo");
      }

      setResultado(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setCargando(false);
    }
  }

  function alternarAprobacion(id: number) {
    if (!resultado) return;
    setResultado({
      ...resultado,
      filas: resultado.filas.map((fila) =>
        fila.parrafo_id === id
          ? {
              ...fila,
              aprobado: !fila.aprobado,
              estado_revision: !fila.aprobado ? "Aprobado" : "Pendiente de revisión",
            }
          : fila
      ),
    });
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Generador Científico NodoIA</h1>
        <p className="text-gray-600">
          Ingresa un tema de investigación para consultar OpenAlex, Semantic Scholar, CrossRef y ArXiv y generar un artículo estructurado.
        </p>
      </header>

      <form onSubmit={manejarEnvio} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ej: texto sobre la música en el mundo moderno..."
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-600"
          disabled={cargando}
        />
        <button
          type="submit"
          disabled={cargando || !prompt.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-6 py-3 rounded-lg transition"
        >
          {cargando ? "Investigando y redactando..." : "Generar artículo"}
        </button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {resultado && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
            <div>
              <span className="text-xs font-semibold uppercase text-gray-500">Tema interpretado</span>
              <p className="font-medium">{resultado.tema_limpio}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-gray-500">Keywords (EN)</span>
              <p className="font-mono text-sm">{resultado.keywords_en}</p>
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-gray-500">Métricas</span>
              <p className="font-medium">
                {resultado.filas.length} párrafos · {resultado.total_fuentes} fuentes únicas
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-3 font-semibold">#</th>
                  <th className="p-3 font-semibold">Sección</th>
                  <th className="p-3 font-semibold">Texto generado</th>
                  <th className="p-3 font-semibold">Fuente</th>
                  <th className="p-3 font-semibold">Revisión</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {resultado.filas.map((fila) => (
                  <tr key={fila.parrafo_id} className="hover:bg-gray-50 align-top">
                    <td className="p-3 font-mono text-gray-500">{fila.parrafo_id}</td>
                    <td className="p-3 font-semibold whitespace-nowrap">{fila.seccion}</td>
                    <td className="p-3 leading-relaxed">{fila.texto}</td>
                    <td className="p-3">
                      <a
                        href={fila.fuente_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline break-all"
                      >
                        Ver fuente
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => alternarAprobacion(fila.parrafo_id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          fila.aprobado
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {fila.estado_revision}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}