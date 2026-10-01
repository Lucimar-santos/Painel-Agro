/* ============================================================
   Leitura do CSV da planilha (Google Sheets) e transformação para a
   estrutura window.RAW_DATA usada por app_logic.js.
   Executa dentro do Web Worker (data_worker.js).

   COL = {AN:0,ME:1,TC:2,RG:3,TG:4,LN:5,TM:6,IDC:7,ID:8,MO:9,VB:10,GMD:11,PM:12,
          CA:13,CAC:14,IEP:15,IEPC:16,DKA:17,DKG:18,RC:19,AL:20,AR:21,PT:22,PR:23,
          RL:24,RB:25,DA:26,TR:27,PF:28,DI:29,GJ:30,GR:31,DCA:32,CS:33}
   ============================================================ */

/* ---------- CSV ---------- */
function parseCSV(text){
  var rows = [], row = [], field = "", q = false;
  for (var i = 0; i < text.length; i++){
    var c = text[i];
    if (q){
      if (c === '"'){ if (text[i+1] === '"'){ field += '"'; i++; } else q = false; }
      else field += c;
    } else if (c === '"'){ q = true; }
    else if (c === ","){ row.push(field); field = ""; }
    else if (c === "\n"){ row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r"){ /* ignora */ }
    else field += c;
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  return rows;
}

/* ---------- Cabeçalhos ---------- */
var COL_HEADERS = {
  granja: "Granja", proprietario: "Proprietário", tipoGalpao: "Tipo Galpão", tecnico: "Tecnico",
  regiao: "Região", dataAbate: "Data Abate", galpao: "Galpão", situacao: "Situação",
  avesAlojadas: "Aves Alojadas", avesRecebidas: "Aves Recebidas", idadeC: "Idade C", idade: "Idade",
  mort: "Mort", viabReal: "Viab. Real", pesoTotal: "Peso Total", gmd: "GMD.", pesoMedio: "Peso Médio",
  ca: "CA.", cac: "CAC.", iep: "IEP", racaoEntregue: "Ração entregue", precoFrango: "Preço Frango",
  densKg: "Dens. KG", descCA: "Desc. C.A", descApanha: "Desc. Apanha", condSif: "Cond. SIF",
  resultadoLiquido: "Resultado Liquido Lote", linhagem: "Linhagem", densAloj: "Dens. Aloj.",
  pagTransporte: "Pagamento Transporte", resultadoBruto: "Resultado Bruto"
};

function normHeader(s){
  return String(s == null ? "" : s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[."'\u00ba]/g, "")
    .replace(/\s+/g, " ").trim();
}

function buildHeaderIndex(headerRow){
  var map = {};
  (headerRow || []).forEach(function(h, idx){
    var nh = normHeader(h);
    if (nh && map[nh] == null) map[nh] = idx;
  });
  var idx = {};
  Object.keys(COL_HEADERS).forEach(function(key){
    var nh = normHeader(COL_HEADERS[key]);
    idx[key] = map[nh] != null ? map[nh] : null;
  });
  return idx;
}

/* ---------- Números no formato brasileiro (aceita "R$ 1.234,56", "38,63", "34.000") ---------- */
function num(v){
  if (v == null || v === "") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  var s = String(v).trim();
  if (!s) return null;
  var neg = /^\(.*\)$/.test(s) || /-/.test(s);
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;
  if (s.indexOf(",") >= 0){
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)){
    s = s.replace(/\./g, "");            // 34.000 -> 34000
  }
  var n = parseFloat(s);
  if (isNaN(n)) return null;
  return neg ? -n : n;
}

/* ---------- Datas ----------
   O Google Sheets exporta datas como "M/D/AAAA" (mês primeiro). Também aceita
   "D/M/AAAA" e "AAAA-MM-DD". O formato é detectado olhando a coluna inteira. */
function detectDateOrder(values){
  var maxA = 0, maxB = 0;
  for (var i = 0; i < values.length; i++){
    var m = String(values[i] || "").match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
    if (!m) continue;
    if (+m[1] > maxA) maxA = +m[1];
    if (+m[2] > maxB) maxB = +m[2];
  }
  if (maxA > 12) return "DMY";
  if (maxB > 12) return "MDY";
  return "MDY"; // padrão do Google Sheets
}

function parseDateFlexible(v, order){
  if (v == null || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number"){
    var epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000);
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  var m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m2){
    var a = +m2[1], b = +m2[2], yy = +m2[3];
    if (yy < 100) yy += 2000;
    var dd, mm;
    if (order === "DMY"){ dd = a; mm = b; } else { mm = a; dd = b; }
    if (mm > 12 && dd <= 12){ var t = mm; mm = dd; dd = t; }
    return new Date(Date.UTC(yy, mm - 1, dd));
  }
  return null;
}

/* ---------- Normalizações de texto ---------- */
function cleanStr(s){
  return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
}
function normTipoGalpao(s){
  var t = cleanStr(s);
  if (!t) return "";
  if (/^co\s*\(/i.test(t)) return "Convencional";
  if (/^pn\s*\(/i.test(t)) return "Dark House";
  return t;
}
function normRegiao(s){
  var t = cleanStr(s);
  if (!t) return "";
  var tu = t.toUpperCase();
  if (tu === "URUTAI") return "URUTAÍ";
  if (tu.indexOf("RODOVIA GO 020") > -1) return "RODOVIA GO 020, KM 152 (ZONA RURAL)";
  return t;
}
function isTomazini(propName){
  var name = propName || "";
  return /tomazini/i.test(name) || /^\s*j\s*\.?\s*l\s*\.?\s*a\b/i.test(name);
}
function buildLookup(valuesObj){
  return Object.keys(valuesObj).sort(function(a, b){ return a.localeCompare(b, "pt-BR"); });
}
function pad2(n){ return n < 10 ? "0" + n : "" + n; }

/* ---------- Transformação principal ---------- */
function buildRawData(aoa){
  if (!aoa || aoa.length < 2) throw new Error("Planilha vazia ou sem linhas de dados.");
  var hidx = buildHeaderIndex(aoa[0]);
  var required = ["situacao", "ca", "iep", "dataAbate", "tecnico", "tipoGalpao", "proprietario"];
  var missing = required.filter(function(k){ return hidx[k] == null; });
  if (missing.length){
    throw new Error("Colunas não encontradas na aba \"" + "Dados" + "\": " + missing.map(function(k){ return COL_HEADERS[k]; }).join(", ") +
      ". Confira se a primeira linha da planilha contém os cabeçalhos do Agrosys.");
  }

  var dataRows = aoa.slice(1);
  var dateOrder = detectDateOrder(dataRows.map(function(r){ return r[hidx.dataAbate]; }));

  var tcSet = {}, rgSet = {}, tgSet = {}, lnSet = {}, prSet = {}, gjSet = {}, grSet = {};
  var records = [];
  var minDate = null, maxDate = null, provisionalCount = 0;

  dataRows.forEach(function(row){
    if (!row || row.every(function(c){ return c == null || String(c).trim() === ""; })) return;
    function get(key){ var i = hidx[key]; return i == null ? null : row[i]; }

    var situacao = String(get("situacao") || "").trim();
    var ca = num(get("ca"));
    var iep = num(get("iep"));
    var isFechado = /fechado/i.test(situacao);
    var isAbertoCompleto = /aberto/i.test(situacao) && ca != null && iep != null;
    if (!isFechado && !isAbertoCompleto) return;

    var dataAbate = parseDateFlexible(get("dataAbate"), dateOrder);
    if (!dataAbate) return;

    var an = dataAbate.getUTCFullYear();
    var me = dataAbate.getUTCMonth() + 1;
    var di = dataAbate.getUTCDate();

    var tecnico = cleanStr(get("tecnico"));
    var regiaoRaw = cleanStr(get("regiao"));
    var regiao = regiaoRaw ? normRegiao(regiaoRaw) : "";
    var tipo = normTipoGalpao(get("tipoGalpao"));
    var linhagem = cleanStr(get("linhagem"));
    var prop = cleanStr(get("proprietario"));
    var granja = cleanStr(get("granja"));
    var galpao = cleanStr(get("galpao"));

    if (!tecnico || !tipo || !prop || !granja || !galpao) return;

    tcSet[tecnico] = true;
    if (regiao) rgSet[regiao] = true;
    tgSet[tipo] = true;
    if (linhagem) lnSet[linhagem] = true;
    prSet[prop] = true;
    grSet[granja] = true;
    gjSet[galpao] = true;

    if (!minDate || dataAbate < minDate) minDate = dataAbate;
    if (!maxDate || dataAbate > maxDate) maxDate = dataAbate;
    if (isAbertoCompleto) provisionalCount++;

    records.push({
      an: an, me: me, di: di, tecnico: tecnico, regiao: regiao || null, tipo: tipo,
      linhagem: linhagem || null, prop: prop, granja: granja, galpao: galpao,
      idc: num(get("idadeC")), id: num(get("idade")), mo: num(get("mort")), vb: num(get("viabReal")),
      gmd: num(get("gmd")), pm: num(get("pesoMedio")), ca: ca, cac: num(get("cac")), iep: iep,
      dka: num(get("densAloj")), dkg: num(get("densKg")), rc: num(get("racaoEntregue")),
      al: num(get("avesAlojadas")), ar: num(get("avesRecebidas")), pt: num(get("pesoTotal")),
      rl: num(get("resultadoLiquido")), rb: num(get("resultadoBruto")), da: num(get("descApanha")),
      tr: num(get("pagTransporte")), pf: num(get("precoFrango")), dca: num(get("descCA")), cs: num(get("condSif"))
    });
  });

  if (!records.length) throw new Error("Nenhum lote válido encontrado na planilha.");

  var LK = {
    tc: buildLookup(tcSet), rg: buildLookup(rgSet), tg: buildLookup(tgSet),
    ln: buildLookup(lnSet), pr: buildLookup(prSet), gr: buildLookup(grSet), gj: buildLookup(gjSet)
  };
  function idxOf(arr, val){ return val == null ? -1 : arr.indexOf(val); }

  var ROWS = records.map(function(r){
    var tcI = idxOf(LK.tc, r.tecnico);
    var rgI = r.regiao ? idxOf(LK.rg, r.regiao) : -1;
    var tgI = idxOf(LK.tg, r.tipo);
    var lnI = r.linhagem ? idxOf(LK.ln, r.linhagem) : -1;
    var prI = idxOf(LK.pr, r.prop);
    var grI = idxOf(LK.gr, r.granja);
    var gjI = idxOf(LK.gj, r.galpao);
    var tm = isTomazini(r.prop) ? 1 : 0;

    var idadeC = r.idc != null ? r.idc : r.id;
    var caC = r.cac != null ? r.cac : r.ca;
    var iepc = (r.vb != null && r.pm != null && idadeC && caC) ? (r.vb * r.pm * 100) / (idadeC * caC) : null;

    var iepFinal = r.iep;
    if (iepFinal == null && r.vb != null && r.pm != null && r.id && r.ca){
      iepFinal = (r.vb * r.pm * 100) / (r.id * r.ca);
    }

    return [r.an, r.me, tcI, rgI, tgI, lnI, tm, r.idc, r.id, r.mo, r.vb, r.gmd, r.pm, r.ca, r.cac,
            iepFinal, iepc, r.dka, r.dkg, r.rc, r.al, r.ar, r.pt, prI, r.rl, r.rb, r.da, r.tr, r.pf,
            r.di, gjI, grI, r.dca, r.cs];
  });

  var anosSet = {};
  ROWS.forEach(function(r){ anosSet[r[0]] = true; });
  var anos = Object.keys(anosSet).map(Number).sort(function(a, b){ return a - b; });

  var meta = {
    generated: new Date().toISOString().slice(0, 10),
    total_lotes: ROWS.length,
    anos: anos,
    ano_min: anos[0],
    ano_max: anos[anos.length - 1],
    data_abate_min: minDate ? (minDate.getUTCFullYear() + "-" + pad2(minDate.getUTCMonth()+1) + "-" + pad2(minDate.getUTCDate())) : null,
    data_abate_max: maxDate ? (maxDate.getUTCFullYear() + "-" + pad2(maxDate.getUTCMonth()+1) + "-" + pad2(maxDate.getUTCDate())) : null,
    provisional_count: provisionalCount
  };

  return { meta: meta, lookups: LK, rows: ROWS };
}

/* ---------- "Impressão digital" dos dados, para saber se a planilha mudou ---------- */
function dataSignature(raw){
  if (!raw || !raw.rows) return "";
  var soma = 0, rows = raw.rows;
  for (var i = 0; i < rows.length; i++){
    var r = rows[i];
    soma += (r[13] || 0) * 1000 + (r[15] || 0) + (r[20] || 0) + (r[24] || 0);
  }
  return rows.length + "|" + raw.meta.data_abate_max + "|" + Math.round(soma);
}
