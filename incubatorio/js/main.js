/* ===================== Carregador / sincronização =====================
   1. Mostra imediatamente a última base guardada no navegador (IndexedDB).
   2. Em segundo plano, busca a planilha do Google Sheets.
   3. Se a planilha mudou, guarda e recarrega o painel automaticamente.
   ====================================================================== */
(function () {
  var CFG = window.PAINEL_CONFIG;
  var DB_NAME = 'painel-incubatorio';
  var STORE = 'cache';
  var KEY = 'dataset';

  var statusEl = document.getElementById('syncStatus');
  var overlay = document.getElementById('loadingOverlay');
  var started = false, reloading = false, syncing = false;

  function setStatus(text, cls) {
    if (!statusEl) return;
    statusEl.textContent = text;
    statusEl.className = 'sync-pill ' + (cls || '');
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  function idbGet() {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var r = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
        r.onsuccess = function () { resolve(r.result || null); };
        r.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }

  function idbPut(value) {
    return openDB().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, KEY);
        tx.oncomplete = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  function signature(d) {
    if (!d) return '';
    var ti = d.rows.ti, soma = 0;
    for (var i = 0; i < ti.length; i++) soma += ti[i];
    return d.n + '|' + d.dict.dataNasc[d.dict.dataNasc.length - 1] + '|' + Math.round(soma);
  }

  function showError(msg) {
    if (overlay && !started) {
      overlay.innerHTML = '<div class="load-error"><b>Não foi possível carregar os dados</b><p>' + msg +
        '</p><button onclick="location.reload()">Tentar novamente</button></div>';
      overlay.style.display = 'flex';
    }
    setStatus('sem conexão com a planilha', 'err');
  }

  function startApp(data) {
    if (started) return;
    started = true;
    try {
      window.PainelIncubatorio.start(data);
    } catch (err) {
      started = false;
      showError('Erro ao montar o painel: ' + (err && err.message ? err.message : err));
      return;
    }
    if (overlay) overlay.style.display = 'none';
  }

  function fetchFromSheet() {
    return new Promise(function (resolve, reject) {
      var worker = new Worker('js/data-worker.js');
      worker.onmessage = function (e) {
        worker.terminate();
        if (e.data.ok) resolve(e.data.data); else reject(new Error(e.data.error));
      };
      worker.onerror = function () { worker.terminate(); reject(new Error('Falha ao processar a planilha.')); };
      worker.postMessage({ config: CFG });
    });
  }

  function horaAgora() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function sync(cachedSig) {
    if (syncing || reloading) return Promise.resolve();
    syncing = true;
    setStatus('sincronizando…', 'busy');
    return fetchFromSheet().then(function (data) {
      var sig = signature(data);
      return idbPut({ sig: sig, data: data, savedAt: Date.now() }).then(function () {
        if (started && cachedSig && sig !== cachedSig) {
          reloading = true;
          setStatus('novos dados — atualizando…', 'busy');
          setTimeout(function () { location.reload(); }, 400);
          return;
        }
        startApp(data);
        setStatus('atualizado às ' + horaAgora(), 'ok');
      });
    }).catch(function (err) {
      if (!started) showError(err.message);
      else setStatus('sem conexão — dados de ' + horaAgora(), 'err');
    }).then(function () { syncing = false; });
  }

  /* ---- Início ---- */
  idbGet().then(function (cached) {
    var cachedSig = null;
    if (cached && cached.data) {
      cachedSig = cached.sig;
      startApp(cached.data);
      setStatus('atualizando dados da planilha…', 'busy');
    }
    sync(cachedSig);
  });

  var intervalo = Math.max(2, CFG.AUTO_SYNC_MINUTOS || 10) * 60000;
  setInterval(function () { idbGet().then(function (c) { sync(c && c.sig); }); }, intervalo);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') idbGet().then(function (c) { sync(c && c.sig); });
  });
  if (statusEl) statusEl.addEventListener('click', function () { idbGet().then(function (c) { sync(c && c.sig); }); });
})();
