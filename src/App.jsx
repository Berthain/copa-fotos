import { useState } from "react";

export default function App() {
  const [matches, setMatches] = useState("");
  const [folder, setFolder] = useState("");
  const [status, setStatus] = useState("Pronto");

  async function searchMatches() {
    try {
      setStatus("Processando...");

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

      setStatus(data.message);
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
        style={{ width: "500px" }}
        placeholder="Pasta de destino"
        value={folder}
        onChange={(e) => setFolder(e.target.value)}
      />

      <br />
      <br />

      <button onClick={searchMatches}>
        Baixar Fotos
      </button>

      <p>{status}</p>
    </div>
  );
}