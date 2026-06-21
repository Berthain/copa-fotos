import { useState, useRef } from "react";

export default function App() {
  // Estado do textarea com as partidas informadas pelo usuário.
  const [matches, setMatches] = useState("");
  // Pasta de destino onde o backend irá salvar as imagens.
  const [folder, setFolder] = useState("");
  // Texto de status exibido na interface durante o processo.
  const [status, setStatus] = useState("Pronto");
  // Resultados retornados pelo backend após o processamento.
  const [results, setResults] = useState([]);
  // Se true, utiliza streaming SSE para receber progresso em tempo real.
  const [useStream, setUseStream] = useState(true);

  // Referência para o input file oculto de seleção de pasta.
  const folderInputRef = useRef(null);

  // Abre o diálogo nativo de seleção de pasta do sistema operacional.
  function handleSelectFolder() {
    folderInputRef.current?.click();
  }

  // Processa a pasta selecionada e atualiza o estado.
  function handleFolderSelect(e) {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Extrai o caminho da pasta a partir do primeiro arquivo selecionado.
      const filePath = files[0].webkitRelativePath || files[0].name;
      const folderPath = filePath.substring(0, filePath.lastIndexOf("/"));
      setFolder(folderPath || files[0].name);
    }
  }

  async function searchMatches() {
    try {
      setStatus("Processando...");

      // Converte o texto em linhas e remove entradas vazias.
      const matchesList = matches
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const response = await fetch(
        "http://localhost:3001/api/download-match-images",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            matches: matchesList,
            folder,
          }),
        }
      );

      const data = await response.json();

      // Atualiza status e armazena detalhes retornados pelo backend.
      setStatus(data.message);
      setResults(Array.isArray(data.details) ? data.details : []);
    } catch (err) {
      setStatus("Erro: " + err.message);
    }
  }

  // Inicia a versão com streaming: faz POST e lê o texto como stream SSE.
  async function searchMatchesStream() {
    try {
      setStatus("Processando (stream)...");
      setResults([]);

      const matchesList = matches
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean);

      const response = await fetch("http://localhost:3001/api/download-match-images-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matches: matchesList, folder }),
      });

      if (!response.body) {
        setStatus("Erro: streaming não disponível");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      // mapa temporário de resultados por partida para atualização incremental
      const map = {};

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // processa blocos SSE separados por \n\n
        let parts = buffer.split("\n\n");
        buffer = parts.pop();
        for (const part of parts) {
          const lines = part.split(/\n/).map((l) => l.trim());
          let event = null;
          let data = null;
          for (const line of lines) {
            if (line.startsWith("event:")) event = line.replace("event:", "").trim();
            if (line.startsWith("data:")) data = line.replace("data:", "").trim();
          }
          if (data) {
            try {
              const payload = JSON.parse(data);
              // trata eventos conhecidos
              if (event === "match-start") {
                map[payload.partida] = { partida: payload.partida, pasta: payload.pasta, resultados: [], totalEncontrado: 0, totalBaixado: 0, totalFalha: 0 };
              } else if (event === "image-downloaded") {
                const m = map[payload.partida] || (map[payload.partida] = { partida: payload.partida, resultados: [], totalEncontrado: 0, totalBaixado: 0, totalFalha: 0 });
                m.resultados.push({ url: payload.url, arquivo: payload.arquivo });
                m.totalBaixado = (m.totalBaixado || 0) + 1;
              } else if (event === "image-failed") {
                const m = map[payload.partida] || (map[payload.partida] = { partida: payload.partida, resultados: [], totalEncontrado: 0, totalBaixado: 0, totalFalha: 0 });
                m.totalFalha = (m.totalFalha || 0) + 1;
              } else if (event === "match-progress") {
                const m = map[payload.partida] || (map[payload.partida] = { partida: payload.partida, resultados: [], totalEncontrado: 0, totalBaixado: 0, totalFalha: 0 });
                m.totalEncontrado = payload.encontrado;
                m.totalBaixado = payload.baixado;
                m.totalFalha = payload.falha;
              } else if (event === "match-done") {
                map[payload.partida] = { ...(map[payload.partida] || {}), metadata: payload.metadata };
              } else if (event === "done") {
                setStatus(payload.message || "Concluído");
              }
              // atualiza estado com array de partidas
              setResults(Object.values(map));
            } catch (e) {
              // ignora parse errors
            }
          }
        }
      }

      // finaliza leitura
      setStatus("Concluído (stream)");
    } catch (err) {
      setStatus("Erro: " + err.message);
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Buscador de Fotos da Copa 2026</h1>

      <p>Digite uma partida por linha:</p>

      <textarea
        rows={10}
        cols={60}
        value={matches}
        onChange={(e) => setMatches(e.target.value)}
        placeholder={`Brasil x Argentina
Canadá x Qatar
França x Alemanha`}
      />

      <br />
      <br />

      <input
        type="text"
        style={{ width: "400px" }}
        placeholder="Pasta de destino"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />

      {/* Botão para selecionar pasta graficamente */}
      <button
        onClick={handleSelectFolder}
        style={{ marginLeft: 8, padding: "6px 12px", cursor: "pointer" }}
      >
        📁 Selecionar Pasta
      </button>

      {/* Input hidden para diálogo de seleção de pasta (webkitdirectory permite pasta inteira) */}
      <input
        ref={folderInputRef}
        type="file"
        webkitdirectory="true"
        style={{ display: "none" }}
        onChange={handleFolderSelect}
      />

      <br />
      <br />

      <label style={{ display: "block", marginBottom: 8 }}>
        <input type="checkbox" checked={useStream} onChange={(e) => setUseStream(e.target.checked)} /> Usar progresso em tempo real
      </label>

      <button onClick={() => (useStream ? searchMatchesStream() : searchMatches())}>Baixar Fotos</button>

      <p>{status}</p>

      {/* Se houver resultados, exibe resumo por partida */}
      {results.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h2>Resultados</h2>
          {/* Barra de progresso global */}
          <div style={{ marginBottom: 12 }}>
            <strong>Progresso geral: </strong>
            {(() => {
              const totalEncontrado = results.reduce((s, r) => s + (r.totalEncontrado || 0), 0);
              const totalBaixado = results.reduce((s, r) => s + (r.totalBaixado || 0), 0);
              const pct = totalEncontrado ? Math.round((totalBaixado / totalEncontrado) * 100) : 0;
              return (
                <div style={{ width: '100%', maxWidth: 600 }}>
                  <div style={{ background: '#eee', height: 12, borderRadius: 6 }}>
                    <div style={{ width: `${pct}%`, height: 12, background: '#4caf50', borderRadius: 6 }} />
                  </div>
                  <div style={{ fontSize: 12 }}>{totalBaixado} de {totalEncontrado} imagens — {pct}%</div>
                </div>
              );
            })()}
          </div>
          {results.map((r) => (
            <div key={r.partida} style={{ border: "1px solid #ddd", padding: 10, marginBottom: 10 }}>
              <strong>{r.partida}</strong>
              <div>Encontradas: {r.totalEncontrado} — Baixadas: {r.totalBaixado} — Falhas: {r.totalFalha}</div>
              {/* Barra de progresso da partida */}
              {(() => {
                const found = r.totalEncontrado || 0;
                const down = r.totalBaixado || 0;
                const pct = found ? Math.round((down / found) * 100) : 0;
                return (
                  <div style={{ width: '100%', maxWidth: 500, marginTop: 6 }}>
                    <div style={{ background: '#eee', height: 10, borderRadius: 5 }}>
                      <div style={{ width: `${pct}%`, height: 10, background: '#2196f3', borderRadius: 5 }} />
                    </div>
                    <div style={{ fontSize: 12 }}>{pct}% — {down} / {found}</div>
                  </div>
                );
              })()}
              {/* Lista de imagens (URLs) */}
              <details>
                <summary>Ver imagens ({r.resultados.length})</summary>
                <ul>
                  {r.resultados.map((img, idx) => (
                    <li key={idx} style={{ marginBottom: 6 }}>
                      <a href={img.url} target="_blank" rel="noreferrer">{img.titulo || img.url}</a>
                      <div style={{ fontSize: 12, color: "#666" }}>Fonte: {img.fonte}</div>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}