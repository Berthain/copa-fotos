import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs-extra";
import path from "path";
import crypto from "crypto";

const app = express();
app.use(cors());
app.use(express.json());

const DEFAULT_FOLDER = path.resolve("down_pics");
const HISTORY_FILE = path.resolve("download_history.json");
const DEDUPE_FILE = path.resolve("dedupe_map.json");

// Mapa de hash -> arquivo salvo (persistido em DEDUPE_FILE)
let dedupeMap = {};
// Carrega o mapa de duplicidade na inicialização, se existir
try {
  dedupeMap = await fs.readJson(DEDUPE_FILE);
  if (typeof dedupeMap !== 'object' || dedupeMap === null) dedupeMap = {};
} catch (err) {
  dedupeMap = {};
}

async function persistDedupeMap() {
  try {
    await fs.writeJson(DEDUPE_FILE, dedupeMap, { spaces: 2 });
  } catch (err) {
    console.error('Erro ao persistir dedupe map:', err.message);
  }
}

function sanitizeFolderName(name) {
  // Remove caracteres inválidos para pastas no Windows ou Linux.
  return name.replace(/[<>:"/\\|?*]+/g, "").trim();
}

function extractExtension(url) {
  // Tenta extrair a extensão do caminho da URL; usa .jpg como fallback.
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).split("?")[0];
    if (ext && ext.length <= 5) {
      return ext;
    }
  } catch (err) {
    // fallback
  }
  return ".jpg";
}

// Busca imagens via Wikimedia Commons API (API pública, sem autenticação).
async function fetchWikimediaImages(query, limit = 20) {
  // Wikimedia Commons oferece API completamente aberta com milhões de imagens
  // licenciadas para uso livre. Busca via Wikipedia search integrado.
  // Filtra apenas extensões de imagem válidas para evitar PDFs e outros tipos.
  const validExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  const forbiddenExtensions = [".pdf", ".doc", ".docx", ".txt", ".zip", ".rar"];

  const response = await axios.get("https://commons.wikimedia.org/w/api.php", {
    params: {
      action: "query",
      list: "search",
      srsearch: query,
      srprop: "size",
      srlimit: Math.min(limit * 5, 150), // Busca muito mais para filtrar agressivamente
      srnamespace: "6", // File namespace (imagens)
      format: "json",
    },
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/json",
    },
    timeout: 15000,
  });

  const searchResults = response.data?.query?.search ?? [];
  const imageData = [];

  // Busca detalhes de cada arquivo encontrado
  for (const item of searchResults) {
    if (imageData.length >= limit) break; // Para quando atinge o limite
    
    // Valida nome do arquivo ANTES de fazer requisição (economia de tempo)
    const titleLower = item.title.toLowerCase();
    const isForbidden = forbiddenExtensions.some(ext => titleLower.includes(ext));
    if (isForbidden) {
      continue; // Pula PDFs, documentos, etc antes de fazer requisição
    }

    try {
      const detailsResponse = await axios.get("https://commons.wikimedia.org/w/api.php", {
        params: {
          action: "query",
          titles: item.title,
          prop: "imageinfo|info",
          iiprop: "url|user|timestamp",
          format: "json",
        },
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        timeout: 10000,
      });

      const pages = detailsResponse.data?.query?.pages ?? {};
      const page = Object.values(pages)[0];

      if (page?.imageinfo?.[0]?.url) {
        const info = page.imageinfo[0];
        const urlString = info.url;
        const titleLower = item.title.toLowerCase();
        
        // Rejeição agressiva de não-imagens
        if (
          urlString.includes(".pdf") ||
          titleLower.includes(".pdf") ||
          urlString.includes(".doc") ||
          titleLower.includes(".doc") ||
          urlString.includes(".txt") ||
          titleLower.includes(".txt") ||
          urlString.includes(".zip") ||
          urlString.includes(".rar")
        ) {
          continue; // Pula arquivo
        }
        
        // Filtra apenas extensões de imagem válidas
        const cleanUrl = urlString.toLowerCase().split(/[?#]/)[0];
        const hasValidExtension = validExtensions.some(ext => cleanUrl.endsWith(ext));
        
        if (!hasValidExtension) {
          continue; // Pula se não terminar com extensão de imagem válida
        }

        imageData.push({
          url: urlString,
          titulo: item.title.replace(/File:|\.jpg|\.jpeg|\.png|\.gif|\.webp|\.svg/i, "").trim(),
          fonte: `Wikimedia Commons - ${info.user || "Unknown"}`,
          origem: `https://commons.wikimedia.org/wiki/${item.title.replace(/ /g, "_")}`,
        });
      }
    } catch (err) {
      // Continua para o próximo item se houver erro
      console.error(`Erro ao buscar detalhes de ${item.title}:`, err.message);
    }
  }

  return imageData.slice(0, limit);
}

async function searchImagesForMatch(match, maxResults = 20) {
  // Constrói múltiplas variações de pesquisa para garantir maior cobertura
  // de imagens relacionadas à partida e ao contexto esportivo.
  const queries = [
    `${match} futebol`,
    `${match}`,
    `${match} football`,
  ];

  const seenUrls = new Set();
  const results = [];

  for (const query of queries) {
    if (results.length >= maxResults) break;
    try {
      const images = await fetchWikimediaImages(query, maxResults);
      for (const image of images) {
        if (!seenUrls.has(image.url) && results.length < maxResults) {
          seenUrls.add(image.url);
          results.push(image);
        }
      }
    } catch (err) {
      console.error(`Erro ao buscar imagens para query=${query}:`, err.message);
    }
  }

  return results;
}

async function downloadImage(url, targetPath) {
  // Faz o download de uma imagem via stream para não carregar o arquivo em memória.
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
    timeout: 20000,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
    },
  });

  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(targetPath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// Faz download para arquivo temporário, calcula hash e evita duplicatas globais.
async function downloadAndDedupe(url, matchFolder, baseName, existingNames) {
  // cria nome temporário para escrita
  const tmpName = `${baseName}-${crypto.randomBytes(6).toString('hex')}.tmp`;
  const tmpPath = path.join(matchFolder, tmpName);

  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
      timeout: 20000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });

    const hash = crypto.createHash('sha256');
    const writer = fs.createWriteStream(tmpPath);

    await new Promise((resolve, reject) => {
      response.data.on('data', (chunk) => hash.update(chunk));
      response.data.pipe(writer);
      writer.on('finish', resolve);
      writer.on('error', reject);
      response.data.on('error', reject);
    });

    const digest = hash.digest('hex');
    // se já existe arquivo com esse hash, remove tmp e retorna info de duplicata
    if (dedupeMap[digest]) {
      await fs.remove(tmpPath);
      return { status: 'duplicate', arquivo: path.basename(dedupeMap[digest]), path: dedupeMap[digest], url };
    }

    // determina extensão e nome final
    const ext = extractExtension(url) || '.jpg';
    const fileName = buildFileName(`${baseName}`, ext, existingNames);
    const finalPath = path.join(matchFolder, fileName);

    // move tmp para destino final
    await fs.move(tmpPath, finalPath, { overwrite: false });

    // registra no mapa e persiste
    dedupeMap[digest] = finalPath;
    await persistDedupeMap();

    return { status: 'saved', arquivo: fileName, path: finalPath, url };
  } catch (err) {
    // tenta remover tmp se existir
    try { await fs.remove(tmpPath); } catch (e) {}
    return { status: 'failed', erro: err.message, url };
  }
}

async function saveHistory(record) {
  // Registra os resultados do processo em um arquivo JSON de histórico.
  let history = [];
  try {
    history = await fs.readJson(HISTORY_FILE);
    if (!Array.isArray(history)) {
      history = [];
    }
  } catch (err) {
    history = [];
  }

  history.unshift(record);
  await fs.writeJson(HISTORY_FILE, history, { spaces: 2 });
}

function buildFileName(baseName, ext, existingNames) {
  // Cria nomes sequenciais de arquivo evitando duplicatas na mesma pasta.
  let name = `${baseName}${ext}`;
  let counter = 1;
  while (existingNames.has(name)) {
    name = `${baseName} (${counter})${ext}`;
    counter += 1;
  }
  existingNames.add(name);
  return name;
}

app.post("/api/download-match-images", async (req, res) => {
  const { matches, folder } = req.body ?? {};
  if (!Array.isArray(matches) || matches.length === 0) {
    return res.status(400).json({ success: false, message: "Envie a lista de partidas." });
  }

  // Determina a pasta raiz onde os downloads serão salvos.
  const rootFolder = folder ? path.resolve(folder) : DEFAULT_FOLDER;
  await fs.ensureDir(rootFolder);

  const details = [];
  let totalFound = 0;
  let totalDownloaded = 0;
  let totalFailed = 0;

  for (const match of matches) {
    const partida = String(match).trim();
    if (!partida) continue;

    // Cria ou reutiliza a pasta específica para cada partida.
    const sanitized = sanitizeFolderName(partida) || "partida";
    const matchFolder = path.join(rootFolder, sanitized);
    await fs.ensureDir(matchFolder);

    const results = await searchImagesForMatch(partida, 15);
    const existingNames = new Set();
    const downloadList = [];
    const failedList = [];

    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];
      const baseName = `foto-${String(index + 1).padStart(3, "0")}`;
      try {
        const r = await downloadAndDedupe(item.url, matchFolder, baseName, existingNames);
        if (r.status === 'saved') {
          downloadList.push({ ...item, arquivo: r.arquivo, path: r.path });
        } else if (r.status === 'duplicate') {
          // referência ao arquivo existente
          downloadList.push({ ...item, arquivo: r.arquivo, path: r.path, duplicate: true });
        } else {
          failedList.push({ ...item, erro: r.erro || 'unknown' });
        }
      } catch (error) {
        failedList.push({ ...item, erro: error.message });
      }
    }

    totalFound += results.length;
    totalDownloaded += downloadList.length;
    totalFailed += failedList.length;

    const metadata = {
      partida,
      dataDownload: new Date().toISOString(),
      pasta: matchFolder,
      quantidadeEncontrada: results.length,
      quantidadeBaixada: downloadList.length,
      quantidadeFalha: failedList.length,
      resultados: downloadList,
      falhas: failedList,
    };

    // Salva metadados por partida para permitir histórico e análise.
    await fs.writeJson(path.join(matchFolder, "metadata.json"), metadata, { spaces: 2 });
    await fs.writeJson(path.join(matchFolder, "images.json"), results, { spaces: 2 });

    details.push({
      partida,
      pasta: matchFolder,
      totalEncontrado: results.length,
      totalBaixado: downloadList.length,
      totalFalha: failedList.length,
      resultados: results,
    });
  }

  const historyRecord = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    pastaRaiz: rootFolder,
    partidas: matches.filter(Boolean),
    totalEncontrado: totalFound,
    totalBaixado: totalDownloaded,
    totalFalha: totalFailed,
    detalhes: details,
  };

  await saveHistory(historyRecord);

  return res.json({
    success: true,
    message: `Processo concluído: ${totalDownloaded} de ${totalFound} imagens baixadas.`,
    details,
  });
});

app.get("/api/history", async (req, res) => {
  try {
    const history = await fs.readJson(HISTORY_FILE);
    return res.json({ success: true, history });
  } catch (err) {
    return res.json({ success: true, history: [] });
  }
});

app.listen(3001, () => {
  console.log("Servidor iniciado na porta 3001");
});

// Endpoint que envia eventos SSE (Server-Sent Events) com progresso do download.
app.post("/api/download-match-images-stream", async (req, res) => {
  const { matches, folder } = req.body ?? {};
  if (!Array.isArray(matches) || matches.length === 0) {
    res.status(400).json({ success: false, message: "Envie a lista de partidas." });
    return;
  }

  // Configura headers para SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function sendEvent(event, payload) {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      console.error("Erro ao enviar evento SSE:", err.message);
    }
  }

  const rootFolder = folder ? path.resolve(folder) : DEFAULT_FOLDER;
  await fs.ensureDir(rootFolder);

  let totalFound = 0;
  let totalDownloaded = 0;
  let totalFailed = 0;

  // Processa partidas sequencialmente e envia eventos de progresso
  for (const match of matches) {
    const partida = String(match).trim();
    if (!partida) continue;

    const sanitized = sanitizeFolderName(partida) || "partida";
    const matchFolder = path.join(rootFolder, sanitized);
    await fs.ensureDir(matchFolder);

    sendEvent("match-start", { partida, pasta: matchFolder });

    const results = await searchImagesForMatch(partida, 20);
    totalFound += results.length;

    const existingNames = new Set();
    const downloadList = [];
    const failedList = [];

    for (let index = 0; index < results.length; index += 1) {
      const item = results[index];
      const baseName = `foto-${String(index + 1).padStart(3, "0")}`;
      try {
        const r = await downloadAndDedupe(item.url, matchFolder, baseName, existingNames);
        if (r.status === 'saved') {
          downloadList.push({ ...item, arquivo: r.arquivo, path: r.path });
          totalDownloaded += 1;
          sendEvent('image-downloaded', { partida, arquivo: r.arquivo, url: item.url, duplicate: false });
        } else if (r.status === 'duplicate') {
          downloadList.push({ ...item, arquivo: r.arquivo, path: r.path, duplicate: true });
          sendEvent('image-downloaded', { partida, arquivo: r.arquivo, url: item.url, duplicate: true });
        } else {
          failedList.push({ ...item, erro: r.erro || 'unknown' });
          totalFailed += 1;
          sendEvent('image-failed', { partida, url: item.url, erro: r.erro || 'unknown' });
        }
      } catch (error) {
        failedList.push({ ...item, erro: error.message });
        totalFailed += 1;
        sendEvent('image-failed', { partida, url: item.url, erro: error.message });
      }
      // envia progresso parcial da partida
      sendEvent('match-progress', {
        partida,
        encontrado: results.length,
        baixado: downloadList.length,
        falha: failedList.length,
      });
    }

    const metadata = {
      partida,
      dataDownload: new Date().toISOString(),
      pasta: matchFolder,
      quantidadeEncontrada: results.length,
      quantidadeBaixada: downloadList.length,
      quantidadeFalha: failedList.length,
      resultados: downloadList,
      falhas: failedList,
    };

    await fs.writeJson(path.join(matchFolder, "metadata.json"), metadata, { spaces: 2 });
    await fs.writeJson(path.join(matchFolder, "images.json"), results, { spaces: 2 });

    sendEvent("match-done", { partida, metadata });
  }

  const historyRecord = {
    id: crypto.randomUUID(),
    data: new Date().toISOString(),
    pastaRaiz: rootFolder,
    partidas: matches.filter(Boolean),
    totalEncontrado: totalFound,
    totalBaixado: totalDownloaded,
    totalFalha: totalFailed,
  };

  await saveHistory(historyRecord);

  sendEvent("done", { message: `Concluído: ${totalDownloaded} de ${totalFound} imagens baixadas.`, historyId: historyRecord.id });
  res.end();
});