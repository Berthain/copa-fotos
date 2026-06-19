import express from "express";
import cors from "cors";
import axios from "axios";
import fs from "fs";

const app = express();

app.use(cors());
app.use(express.json());

// FUNÇÃO DE DOWNLOAD
async function baixarImagem(url, destino) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  const writer = fs.createWriteStream(destino);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

app.post("/api/download-match-images", async (req, res) => {

  // Aqui você chamaria:
  // await baixarImagem(...)

  res.json({
    success: true,
    message: "Teste concluído"
  });

});

app.listen(3001, () => {
  console.log("Servidor iniciado na porta 3001");
});