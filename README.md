# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# Buscador de Fotos da Copa 2026

Aplicação web desenvolvida com React (Vite) e Node.js para gerenciamento de pesquisas de partidas e processamento de downloads.

---

# Requisitos

- Node.js 24+
- npm 11+
- Visual Studio Code (recomendado)

---

# Estrutura do Projeto

```text
copa-fotos
│
├── src
│   └── App.jsx
│
├── server
│   └── server.js
│
├── package.json
├── node_modules
└── ...
```

---

# Instalação

Entrar na pasta do projeto:

```powershell
cd C:\Users\raulj\Documents\copa-fotos
```

Instalar dependências:

```powershell
npm install
npm install express axios fs-extra cors
```

---

# Inicialização do Backend

Abrir um terminal na raiz do projeto:

```powershell
cd C:\Users\raulj\Documents\copa-fotos
node server/server.js
```

Resultado esperado:

```text
Servidor iniciado na porta 3001
```

Manter este terminal aberto durante a utilização da aplicação.

---

# Inicialização do Frontend

Abrir um segundo terminal na raiz do projeto:

```powershell
cd C:\Users\raulj\Documents\copa-fotos
npm run dev
```

Resultado esperado:

```text
VITE v8.x.x

Local: http://localhost:5173/
```

Manter este terminal aberto durante a utilização da aplicação.

---

# Acesso ao Sistema

Abrir o navegador e acessar:

```text
http://localhost:5173
```

---

# Utilização

No campo de partidas, informar uma partida por linha:

```text
México x Coreia
Brasil x Argentina
França x Alemanha
```

No campo de destino, informar a pasta onde os arquivos serão organizados:

```text
D:\FOOTBTOTAL\down_pics
```

Clique em:

```text
Baixar Fotos
```

---

# Encerramento

Para encerrar os serviços:

Em cada terminal pressionar:

```text
CTRL + C
```

---

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