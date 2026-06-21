
# Buscador de Fotos da Copa 2026

Aplicação web para busca, download e organização automática de imagens relacionadas a partidas de futebol. Combina React (frontend) com Node.js/Express (backend) para oferecer uma experiência fluida de descoberta e download de imagens com controle de duplicidade e progresso em tempo real.

## Funcionalidades

✅ **Busca de imagens por partida**: Pesquisa automática de imagens via Wikimedia Commons  
✅ **Organização automática**: Cria pastas por partida automaticamente  
✅ **Streaming em tempo real**: Exibe progresso de download conforme acontece via SSE  
✅ **Controle de duplicidade**: Detecta e evita downloads duplicados usando hash SHA256  
✅ **Barra de progresso**: Visualização de progresso por partida e global  
✅ **Histórico**: Registra todos os downloads em JSON para consulta posterior  
✅ **Metadados**: Salva informações detalhadas de cada operação (data, quantidade, erros)  

---

## Requisitos

- Node.js 18+
- npm 9+
- Browser moderno (Chrome, Firefox, Edge)

---

## Estrutura do Projeto

```text
copa-fotos/
├── src/
│   ├── App.jsx          # Componente principal (React)
│   ├── main.jsx
│   └── index.css
├── server/
│   └── server.js        # Servidor Express com endpoints de busca/download
├── package.json
├── vite.config.js
├── eslint.config.js
└── README.md
```

---

## Instalação

Clone ou extraia o repositório e instale as dependências:

```bash
npm install
```

---

## Inicialização

### Backend (Terminal 1)

```bash
node server/server.js
```

Você verá:
```text
Servidor iniciado na porta 3001
```

### Frontend (Terminal 2)

```bash
npm run dev
```

Você verá:
```text
VITE v8.x.x ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

---

## Uso

1. **Abra o navegador** em `http://localhost:5173`

2. **Digite as partidas** (uma por linha):
   ```
   Brasil x Argentina
   Canadá x Qatar
   França x Alemanha
   ```

3. **Defina a pasta de destino** (opcional):
   - Deixe vazio para usar `down_pics/` na raiz do projeto
   - Ou forneça um caminho absoluto: `C:\Users\YourName\Pictures\copa-fotos`

4. **Marque "Usar progresso em tempo real"** para ver o streaming de download ao vivo (recomendado)

5. **Clique "Baixar Fotos"**

---

## Estrutura de Saída

Após a execução, as imagens serão organizadas assim:

```text
down_pics/
├── Brasil x Argentina/
│   ├── foto-001.jpg
│   ├── foto-002.jpg
│   ├── metadata.json
│   └── images.json
├── Canadá x Qatar/
│   ├── foto-001.jpg
│   ├── metadata.json
│   └── images.json
└── ...
```

### Conteúdo de `metadata.json`

```json
{
  "partida": "Brasil x Argentina",
  "dataDownload": "2026-06-20T20:46:12.123Z",
  "pasta": "down_pics/Brasil x Argentina",
  "quantidadeEncontrada": 20,
  "quantidadeBaixada": 18,
  "quantidadeFalha": 2,
  "resultados": [
    {
      "url": "...",
      "arquivo": "foto-001.jpg",
      "titulo": "...",
      "fonte": "..."
    }
  ],
  "falhas": [...]
}
```

---

## Recursos de Streaming SSE

Quando ativado, o progresso é transmitido em tempo real via eventos:

- `match-start`: Partida iniciada
- `image-downloaded`: Imagem baixada com sucesso (ou detectada como duplicata)
- `image-failed`: Erro ao baixar imagem
- `match-progress`: Atualização de progresso da partida
- `match-done`: Partida concluída
- `done`: Processo global concluído

---

## Histórico

Todos os downloads são registrados em `download_history.json`:

```json
[
  {
    "id": "uuid-aqui",
    "data": "2026-06-20T20:46:12.123Z",
    "pastaRaiz": "down_pics",
    "partidas": ["Brasil x Argentina", "Canadá x Qatar"],
    "totalEncontrado": 40,
    "totalBaixado": 36,
    "totalFalha": 4,
    "detalhes": [...]
  }
]
```

---

## Controle de Duplicidade

O sistema detecta imagens duplicadas usando **hash SHA256** e as registra como `"duplicate": true` no resultado. Isso evita:

```text
foto-001.jpg
foto-001 (1).jpg
foto-001 (2).jpg
```

quando são o mesmo arquivo.

O mapa de deduplicação é persistido em `dedupe_map.json` para evitar redownloads mesmo após reinicializar.

---

## Encerramento

Em cada terminal, pressione `Ctrl+C` para parar o serviço.

---

## Dependências Principais

- **React**: UI frontend
- **Vite**: Build tool e dev server
- **Express**: Servidor backend
- **Axios**: Requisições HTTP
- **fs-extra**: Manipulação de arquivos
- **CORS**: Cross-origin resource sharing

---

## Próximas Melhorias

- [ ] Interface avançada para filtrar/refinar resultados
- [ ] Cache de buscas anteriores
- [ ] Suporte a múltiplas fontes de imagens
- [ ] Validação de qualidade de imagem
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Agendamento de buscas periódicas

---

## Troubleshooting

**Porta 3001 ou 5173 já em uso?**  
Mude a porta no `server/server.js` ou `vite.config.js`

**Erros de CORS?**  
Verifique se o backend está rodando em `http://localhost:3001`

**Imagens não baixam?**  
A conexão com DuckDuckGo pode estar bloqueada. Tente novamente ou use um VPN.

---

## Licença

Aberto para uso pessoal e educacional.

# Rotina de Uso Diário

### Backend

```powershell
cd C:\Users\raulj\Documents\copa-fotos
node server/server.js
```

### Frontend

```powershell
cd C:\Users\raulj\Documents\copa-fotos
npm run dev
```

### Navegador

```text
http://localhost:5173
```

---

# Status Atual

Implementado:

- Frontend React (Vite)
- Backend Node.js (Express)
- Comunicação Frontend ↔ Backend
- Entrada de múltiplas partidas
- Definição da pasta de destino
- Estrutura preparada para módulos de pesquisa e gerenciamento de downloads

Pendente:

- Integração com fonte de imagens
- Organização automática por partida
- Barra de progresso
- Registro de logs
- Tratamento de duplicidades