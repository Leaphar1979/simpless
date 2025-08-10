# Simple$$ — Controle de Gastos por Caixas (PWA)

Simple$$ é um app **PWA** minimalista para controle de gastos por “caixas” e períodos (diário / semanal / mensal). Tudo roda **localmente no navegador**, com dados salvos em **LocalStorage** — rápido, privado e offline.

## ✨ Recursos
- Múltiplas caixas com períodos: **D / S / M**
- Saldo por período com **rollover** automático
- Registro/edição/remoção de gastos
- **PWA**: instala em Android, iOS e Desktop
- Funciona **offline**
- Dados **locais** (não enviamos nada para servidores)

## 🛠 Tecnologias
- HTML, CSS e JavaScript puro
- PWA: `manifest.json` + `sw.js` (service worker)

## 📦 Estrutura

simpless/
├── index.html
├── style.css
├── js/
│ └── app.js
├── manifest.json
├── sw.js
├── icons/
│ ├── icon-192.png
│ ├── icon-512.png
│ ├── maskable-512.png
│ ├── apple-touch-icon.png
│ ├── favicon-64.png
│ └── favicon-32.png
└── sobre.html


## 🚀 Uso (GitHub Pages)
1. Publique/atualize o repositório.
2. Acesse `https://<seu-usuario>.github.io/simpless/`.
3. Para forçar atualização: **Ctrl+F5** (ou limpe cache do site).

> **Service Worker**: quando fizer mudanças grandes, aumente `CACHE_VERSION` em `sw.js` e publique.

## 🔐 Privacidade
- Os dados ficam **apenas no dispositivo** do usuário (LocalStorage).
- Não há back-end, nem coleta/telemetria.

## 🧾 Licença
Este projeto é distribuído sob **licença proprietária** (ver arquivo `LICENSE`).  
**O código-fonte não é disponibilizado ao usuário final** e não pode ser redistribuído.

## 📄 Sobre
Veja `sobre.html` para informações de licença e créditos.
