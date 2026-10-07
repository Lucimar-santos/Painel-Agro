/* ============================================================
   WEB WORKER — baixa a planilha do Google Sheets (só as colunas
   necessárias) e transforma no formato do painel, fora da thread
   principal, para a tela não travar.

   Não usa Google Apps Script: lê a planilha diretamente pelo link
   público de exportação CSV. A planilha precisa estar compartilhada
   como "Qualquer pessoa com o link – Leitor".
   ============================================================ */
importScripts("sheet_core.js");

function buildUrl(cfg){
  var p = new URLSearchParams();
  p.set("tqx", "out:csv");
  p.set("headers", "1");
  if (cfg.SHEET_NAME) p.set("sheet", cfg.SHEET_NAME);
  if (cfg.SELECT) p.set("tq", "select " + cfg.SELECT);
  p.set("_", String(Date.now())); // evita cache intermediário
  return "https://docs.google.com/spreadsheets/d/" + cfg.SHEET_ID + "/gviz/tq?" + p.toString();
}

self.onmessage = async function(ev){
  var cfg = (ev.data && ev.data.config) || {};
  try {
    if (!cfg.SHEET_ID) throw new Error("SHEET_ID não configurado em js/config.js.");

    postMessage({ type: "progress", stage: "baixando" });
    var resp = await fetch(buildUrl(cfg), { cache: "no-store", credentials: "omit", redirect: "follow" });
    if (!resp.ok){
      throw new Error("O Google Sheets respondeu com erro HTTP " + resp.status +
        ". Confira se a planilha está compartilhada como \"Qualquer pessoa com o link – Leitor\" e se a aba \"" + (cfg.SHEET_NAME || "") + "\" existe.");
    }
    var text = await resp.text();
    if (/^\s*</.test(text) || /<html/i.test(text.slice(0, 500))){
      throw new Error("A planilha não está acessível publicamente. No Google Sheets: Compartilhar > Acesso geral > \"Qualquer pessoa com o link\" (Leitor).");
    }
    if (/google\.visualization\.Query\.setResponse/.test(text.slice(0, 200))){
      var m = text.match(/"message":"([^"]+)"/);
      throw new Error("O Google Sheets recusou a consulta" + (m ? ": " + m[1] : "") + ". Verifique o nome da aba e as colunas em js/config.js.");
    }

    postMessage({ type: "progress", stage: "lendo" });
    var aoa = parseCSV(text);

    postMessage({ type: "progress", stage: "processando" });
    var rawData = buildRawData(aoa);
    postMessage({ type: "done", rawData: rawData, signature: dataSignature(rawData) });
  } catch (err){
    postMessage({ type: "error", message: (err && err.message) ? err.message : String(err) });
  }
};
