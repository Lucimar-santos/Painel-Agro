/* Worker: baixa a planilha do Google Sheets e devolve a base já processada. */
importScripts('parse-core.js');

function buildUrl(cfg){
  var base = 'https://docs.google.com/spreadsheets/d/' + cfg.SHEET_ID + '/gviz/tq';
  var params = ['tqx=out:csv'];
  if (cfg.SELECT) params.push('tq=' + encodeURIComponent('select ' + cfg.SELECT));
  if (cfg.SHEET_NAME) params.push('sheet=' + encodeURIComponent(cfg.SHEET_NAME));
  params.push('_=' + Date.now()); // evita cache intermediário
  return base + '?' + params.join('&');
}

self.onmessage = function (e) {
  var cfg = e.data && e.data.config;
  fetch(buildUrl(cfg), { credentials: 'omit' })
    .then(function (res) {
      if (!res.ok) throw new Error('A planilha respondeu com erro HTTP ' + res.status + '. Verifique se ela está compartilhada com "Qualquer pessoa com o link".');
      return res.text();
    })
    .then(function (text) {
      var t = text.slice(0, 60).toUpperCase();
      if (t.indexOf('<HTML') >= 0 || t.indexOf('<!DOCTYPE') >= 0) {
        throw new Error('A planilha não está pública. Compartilhe como "Qualquer pessoa com o link – Leitor".');
      }
      self.postMessage({ ok: true, data: buildDataset(text) });
    })
    .catch(function (err) {
      self.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
    });
};
