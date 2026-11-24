/* ============================================================
   BOOTSTRAP / SINCRONIZAÇÃO (thread principal)

   1. Mostra imediatamente a última base guardada no navegador
      (IndexedDB) — a tela abre em instantes.
   2. Em segundo plano, o data_worker.js baixa a planilha do Google
      Sheets (só as colunas usadas) e monta window.RAW_DATA.
   3. Se a planilha mudou, o painel é atualizado automaticamente.
   4. Repete a checagem a cada AUTO_SYNC_MINUTOS e ao voltar para a aba.
   ============================================================ */
(function(){
  "use strict";

  var CFG = window.PAINEL_CONFIG || {};
  var DB_NAME = "painel_agro_cache";
  var STORE_NAME = "raw_data";
  var CACHE_KEY = "sheet:" + (CFG.SHEET_ID || "") + ":" + (CFG.SHEET_NAME || "") + ":" + (CFG.SELECT || "");

  var STAGE_LABELS = {
    "cache-hit":   "Carregando do cache local&hellip;",
    "baixando":    "Baixando dados da planilha&hellip;",
    "lendo":       "Lendo a planilha&hellip;",
    "processando": "Processando os lotes&hellip;"
  };

  var appStarted = false;
  var syncing = false;
  var currentSig = null;
  var pendingUpdate = null;   // rawData novo aguardando aplicação
  var firstSyncDone = false;

  /* ---------- UI: tela de carregamento ---------- */
  function setLoadingMessage(html){
    var el = document.getElementById("loadingScreen");
    if (el && !appStarted) el.innerHTML = html;
  }
  function setStage(stage){
    var label = STAGE_LABELS[stage] || "Carregando painel zootécnico&hellip;";
    setLoadingMessage(
      '<div class="loading-spinner"></div>' +
      '<div style="font-family:\'Manrope\',sans-serif;font-weight:700;color:var(--red);font-size:14px;">' + label + '</div>'
    );
  }
  function showFatalError(title, detail){
    setLoadingMessage(
      '<div style="max-width:560px;text-align:center;padding:24px;font-family:Inter,sans-serif;">' +
        '<div style="font-family:\'Manrope\',sans-serif;font-weight:800;font-size:19px;color:#DC3223;margin-bottom:10px;">' + title + '</div>' +
        '<div style="font-size:14px;color:#786F68;line-height:1.6;">' + detail + '</div>' +
        '<button onclick="location.reload()" style="margin-top:18px;padding:9px 18px;border:0;border-radius:8px;background:#DC3223;color:#fff;font-weight:700;cursor:pointer;">Tentar novamente</button>' +
      '</div>'
    );
  }

  /* ---------- UI: etiqueta de status no topo ---------- */
  function setStatus(text, cls){
    var el = document.getElementById("syncStatus");
    if (!el) return;
    el.textContent = text;
    el.className = "sync-pill " + (cls || "");
    el.title = "Clique para sincronizar com a planilha agora";
  }
  function horaAgora(){
    return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }

  /* ---------- UI: aviso de dados novos ---------- */
  function showUpdateToast(){
    var t = document.getElementById("updateToast");
    if (!t){
      t = document.createElement("div");
      t.id = "updateToast";
      t.className = "update-toast";
      t.innerHTML = '<span>A planilha recebeu novos registros.</span><button type="button" id="updateToastBtn">Atualizar painel</button>';
      document.body.appendChild(t);
      t.querySelector("#updateToastBtn").addEventListener("click", applyPending);
    }
    t.classList.add("show");
  }
  function hideUpdateToast(){
    var t = document.getElementById("updateToast");
    if (t) t.classList.remove("show");
  }

  /* ---------- IndexedDB ---------- */
  function openDB(){
    return new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function(){ req.result.createObjectStore(STORE_NAME); };
      req.onsuccess = function(){ resolve(req.result); };
      req.onerror = function(){ reject(req.error); };
    });
  }
  function idbGet(){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        var req = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(CACHE_KEY);
        req.onsuccess = function(){ resolve(req.result || null); };
        req.onerror = function(){ resolve(null); };
      });
    }).catch(function(){ return null; });
  }
  function idbSet(value){
    return openDB().then(function(db){
      return new Promise(function(resolve){
        var tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(value, CACHE_KEY);
        tx.oncomplete = function(){ resolve(true); };
        tx.onerror = function(){ resolve(false); };
      });
    }).catch(function(){ return false; });
  }

  /* ---------- Worker ---------- */
  function loadScript(src){
    return new Promise(function(resolve, reject){
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function(){ reject(new Error("Falha ao carregar " + src)); };
      document.body.appendChild(s);
    });
  }

  function fetchFromSheet(){
    return new Promise(function(resolve, reject){
      var worker;
      try { worker = new Worker("js/data_worker.js"); }
      catch (e){ reject(e); return; }
      worker.onmessage = function(ev){
        var msg = ev.data || {};
        if (msg.type === "progress"){ setStage(msg.stage); }
        else if (msg.type === "done"){ worker.terminate(); resolve(msg); }
        else if (msg.type === "error"){ worker.terminate(); reject(new Error(msg.message || "Erro ao processar a planilha.")); }
      };
      worker.onerror = function(e){
        worker.terminate();
        reject(new Error("Não foi possível ler a planilha do Google Sheets. Verifique a conexão com a internet e se a planilha está compartilhada como \"Qualquer pessoa com o link – Leitor\"." + (e && e.message ? " (" + e.message + ")" : "")));
      };
      worker.postMessage({ config: CFG });
    });
  }

  /* ---------- Início do app ---------- */
  async function startApp(rawData){
    if (appStarted) return;
    window.RAW_DATA = rawData;
    setStage("processando");
    await loadScript("js/app_logic.js");
    appStarted = true;
  }

  function applyPending(){
    if (!pendingUpdate) return;
    var data = pendingUpdate;
    pendingUpdate = null;
    hideUpdateToast();
    var NZ = window.__NZ;
    if (NZ && typeof NZ.applySheetUpdate === "function"){
      try { NZ.applySheetUpdate(data); return; } catch (e){ console.error(e); }
    }
    location.reload();
  }

  /* ---------- Sincronização ---------- */
  function sync(auto){
    if (syncing) return Promise.resolve();
    syncing = true;
    setStatus("sincronizando…", "busy");
    return fetchFromSheet().then(async function(msg){
      var rawData = msg.rawData, sig = msg.signature;
      await idbSet({ signature: sig, rawData: rawData, savedAt: Date.now() });

      if (!appStarted){
        currentSig = sig;
        await startApp(rawData);
      } else if (sig !== currentSig){
        currentSig = sig;
        pendingUpdate = rawData;
        // Na primeira checagem após abrir o painel (ou quando o usuário pediu),
        // aplica na hora; nas checagens periódicas, avisa e deixa o usuário decidir.
        if (!firstSyncDone || !auto) applyPending();
        else showUpdateToast();
      }
      firstSyncDone = true;
      setStatus("planilha sincronizada às " + horaAgora(), "ok");
    }).catch(function(err){
      console.error(err);
      if (!appStarted){
        showFatalError("Não foi possível carregar a base de dados", (err && err.message) ? err.message : String(err));
      } else {
        setStatus("sem conexão com a planilha — dados de " + horaAgora(), "err");
      }
    }).then(function(){ syncing = false; });
  }

  async function boot(){
    setStage("cache-hit");
    var cached = await idbGet();
    if (cached && cached.rawData){
      currentSig = cached.signature || null;
      try { await startApp(cached.rawData); } catch (e){ console.error(e); appStarted = false; }
      setStatus("verificando novos dados…", "busy");
    } else {
      setStage("baixando");
    }
    sync(true);

    var intervalo = Math.max(2, CFG.AUTO_SYNC_MINUTOS || 10) * 60000;
    setInterval(function(){ sync(true); }, intervalo);
    document.addEventListener("visibilitychange", function(){
      if (document.visibilityState === "visible") sync(true);
    });
    var pill = document.getElementById("syncStatus");
    if (pill) pill.addEventListener("click", function(){ sync(false); });
  }

  // O botão "Atualizar dados" do topo força a sincronização com a planilha.
  window.__syncSheetNow = function(){ return sync(false); };

  boot();
})();
