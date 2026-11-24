# Painel Zootécnico + Incubatório (GitHub Pages)

Site estático. Não usa Google Apps Script: lê as planilhas do Google Sheets
diretamente (elas precisam estar compartilhadas como "Qualquer pessoa com o
link – Leitor").

## Publicar
1. Envie todos os arquivos para o repositório (mantenha o arquivo `.nojekyll`).
2. Settings > Pages > Branch: main / (root).

## Onde alterar a planilha
- Painel zootécnico: `js/config.js`
- Painel de incubatório: `incubatorio/ (painel próprio)js/config.js`

## Como a atualização funciona
- Ao abrir, mostra na hora a última base guardada no navegador e busca a planilha em segundo plano.
- Verifica novos dados a cada 10 minutos e sempre que você volta para a aba.
- O botão "Atualizar dados" no topo força a sincronização imediata.
