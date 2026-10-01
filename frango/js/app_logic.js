
(function(){
"use strict";

/* ============================================================
   NUTRIZA - Painel de Resultados Zootécnicos
   Friato Agroindustrial - Gerência Agropecuária
   Fonte: Abate_Agrosys.xlsx (aba "Dados", lotes Fechados)
   ============================================================ */

var DATA = window.RAW_DATA;
var ROWS = DATA.rows;
var LK = DATA.lookups;
var META = DATA.meta;

// ---- Column index map (must match extract.py order) ----
var COL = {
  AN:0, ME:1, TC:2, RG:3, TG:4, LN:5, TM:6,
  IDC:7, ID:8, MO:9, VB:10, GMD:11, PM:12,
  CA:13, CAC:14, IEP:15, IEPC:16, DKA:17, DKG:18,
  RC:19, AL:20, AR:21, PT:22, PR:23,
  RL:24, RB:25, DA:26, TR:27, PF:28,
  DI:29, GJ:30, GR:31, DCA:32, CS:33
};

var MESES_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
var MESES_PT_FULL = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

var PALETTE = ["#DC3223","#F5B93C","#2C6E7F","#4C7A3D","#8B5E3C","#3D5A80","#A73774","#6B6560"];
var PALETTE_SOFT = ["#F6C9C9","#FCE3B8","#C6DEE3","#CFE0C8","#E2D0BF","#C9D3E0"];

// ---- Metric registry ----
// agg: 'mean' (simple arithmetic mean across lotes, matches company convention)
//      'sum'  (volume totals)
var METRICS = {
  ca:    {label:"CA (Conversão Alimentar)",        short:"CA",     col:COL.CA,  dec:3, agg:"mean", good:"down", unit:""},
  cac:   {label:"CAc (CA Corrigida)",               short:"CAc",    col:COL.CAC, dec:3, agg:"mean", good:"down", unit:""},
  idade: {label:"Idade de abate (dias)",            short:"Idade",  col:COL.ID,  dec:1, agg:"mean", good:"neutral", unit:"d"},
  idadec:{label:"Idade corrigida (dias)",           short:"IdadeC", col:COL.IDC, dec:1, agg:"mean", good:"neutral", unit:"d"},
  iep:   {label:"IEP (Índice de Eficiência Produtiva)", short:"IEP",  col:COL.IEP, dec:1, agg:"mean", good:"up", unit:"pts"},
  iepc:  {label:"IEPc (IEP Corrigido)",             short:"IEPc",   col:COL.IEPC,dec:1, agg:"mean", good:"up", unit:"pts"},
  pm:    {label:"Peso Médio (kg)",                  short:"Peso Médio", col:COL.PM, dec:3, agg:"mean", good:"up", unit:"kg"},
  mo:    {label:"Mortalidade (%)",                  short:"Mortalidade", col:COL.MO, dec:2, agg:"mean", good:"down", unit:"%"},
  gmd:   {label:"GMD (Ganho Médio Diário, g)",       short:"GMD",    col:COL.GMD, dec:2, agg:"mean", good:"up", unit:"g"},
  dka:   {label:"Densidade de Alojamento (aves/m²)", short:"Aves/m²",col:COL.DKA, dec:2, agg:"mean", good:"neutral", unit:"aves/m²"},
  dkg:   {label:"Densidade Final (kg/m²)",           short:"Kg/m²",  col:COL.DKG, dec:2, agg:"mean", good:"neutral", unit:"kg/m²"},
  ar:    {label:"Volume Abatido (aves)",             short:"Volume", col:COL.AR,  dec:0, agg:"sum",  good:"up", unit:"aves"},
  rc:    {label:"Consumo de Ração (kg)",             short:"Ração",  col:COL.RC,  dec:0, agg:"sum",  good:"neutral", unit:"kg"},
  pt:    {label:"Kg de Aves Abatidas (Peso Total)",  short:"Peso Total", col:COL.PT, dec:0, agg:"sum", good:"up", unit:"kg"},
  rl:    {label:"Resultado Líquido (R$)",            short:"Result. Líquido", col:COL.RL, dec:0, agg:"sum", good:"up", unit:"R$"},
  rb:    {label:"Resultado Bruto (R$)",               short:"Result. Bruto", col:COL.RB, dec:0, agg:"sum", good:"up", unit:"R$"},
  da:    {label:"Desconto de Apanha (R$)",            short:"Apanha", col:COL.DA, dec:0, agg:"sum", good:"down", unit:"R$"},
  tr:    {label:"Pagamento de Transporte (R$)",       short:"Transporte", col:COL.TR, dec:0, agg:"sum", good:"neutral", unit:"R$"},
  pagcab:{label:"Pagamento por Cabeça (R$/ave)",      short:"R$/cabeça", agg:"ratio", num:COL.RL, den:COL.AR, dec:3, good:"up", unit:"R$"},
  pagkg: {label:"Pagamento por Kg (R$/kg)",            short:"R$/kg", agg:"ratio", num:COL.RL, den:COL.PT, dec:3, good:"up", unit:"R$"},
  dca:   {label:"Bônus/Desconto de CA (R$)",           short:"Bônus CA", col:COL.DCA, dec:0, agg:"sum", good:"up", unit:"R$"},
  cs:    {label:"Condenação SIF (R$)",                 short:"Cond. SIF", col:COL.CS, dec:0, agg:"sum", good:"down", unit:"R$"},
  pf:    {label:"Preço do Frango (R$/kg)",             short:"Preço Frango", col:COL.PF, dec:2, agg:"mean", good:"up", unit:"R$"},
  viab:  {label:"Viabilidade Real (%)",                short:"Viab. Real", col:COL.VB, dec:2, agg:"mean", good:"up", unit:"%"}
};
var METRIC_ORDER = ["ca","cac","idade","idadec","iep","iepc","pm","mo","gmd","dka","dkg","ar","rc","pt"];
var ECON_METRIC_ORDER = ["rl","rb","da","tr","pagcab","pagkg","dca","cs","ar","pt"];

// ---- Dimension registry (for pivot table + rankings) ----
var DIMENSIONS = {
  tecnico: {label:"Técnico",   col:COL.TC, type:"lookup", lk:"tc"},
  regiao:  {label:"Região",    col:COL.RG, type:"lookup", lk:"rg"},
  aviario: {label:"Tipo de Aviário", col:COL.TG, type:"lookup", lk:"tg"},
  linhagem:{label:"Linhagem",  col:COL.LN, type:"lookup", lk:"ln"},
  tomazini:{label:"Integrado Tomazini", col:COL.TM, type:"bool"},
  proprietario:{label:"Proprietário", col:COL.PR, type:"lookup", lk:"pr"},
  familia:{label:"Família Tomazini", col:COL.PR, type:"familia"},
  granja:{label:"Granja", col:COL.GR, type:"lookup", lk:"gr"},
  galpaoesp:{label:"Galpão", col:COL.GJ, type:"lookup", lk:"gj"},
  dia:{label:"Dia", col:COL.DI, type:"num"},
  ano:     {label:"Ano",       col:COL.AN, type:"num"},
  mes:     {label:"Mês",       col:COL.ME, type:"month"},
  anomes:  {label:"Ano-Mês",   col:null,   type:"anomes"},
  nenhum:  {label:"(nenhum)",  col:null,   type:"none"}
};

var FAMILIA_RULES = [
  {test:/giuliano/i, label:"Giuliano Tomazini"},
  {test:/tarc[ií]sio/i, label:"Tarcísio Tomazini"},
  {test:/francisco.*tomazini/i, label:"Francisco Tomazini"},
  {test:/^\s*j\s*\.?\s*l\s*\.?\s*a\b/i, label:"JLA Avicultura"},
  {test:/fausto/i, label:"Fausto Tomazini"}
];
function familiaFor(propIdx){
  if (propIdx == null || propIdx < 0) return null;
  var name = LK.pr[propIdx] || "";
  var isFamily = /tomazini/i.test(name) || /^\s*j\s*\.?\s*l\s*\.?\s*a\b/i.test(name);
  if (!isFamily) return null;
  for (var i=0;i<FAMILIA_RULES.length;i++){
    if (FAMILIA_RULES[i].test.test(name)) return FAMILIA_RULES[i].label;
  }
  return "Outros Tomazini";
}

function dimLabelFor(dimKey, rawValue){
  var d = DIMENSIONS[dimKey];
  if (d.type === "lookup") return rawValue < 0 ? "Não informado" : LK[d.lk][rawValue];
  if (d.type === "bool") return rawValue === 1 ? "Tomazini" : "Outros integrados";
  if (d.type === "month") return MESES_PT[rawValue-1];
  if (d.type === "familia") return rawValue === "__none__" ? "(fora da família Tomazini)" : rawValue;
  if (d.type === "num") return String(rawValue);
  return String(rawValue);
}
function dimKeyForRow(dimKey, row){
  var d = DIMENSIONS[dimKey];
  if (d.type === "anomes") return row[COL.AN] + "-" + (row[COL.ME]<10?"0":"") + row[COL.ME];
  if (d.type === "familia") return familiaFor(row[COL.PR]) || "__none__";
  return row[d.col];
}

/* ============================================================
   Filter state
   ============================================================ */
var filters = {
  anos: new Set(META.anos),
  tecnicos: new Set(LK.tc.map(function(_,i){return i;})),
  regioes: new Set(LK.rg.map(function(_,i){return i;}).concat([-1])),
  tipos: new Set(LK.tg.map(function(_,i){return i;})),
  linhagens: new Set(LK.ln.map(function(_,i){return i;}).concat([-1])),
  tomazini: "todos" // 'todos' | 'somente' | 'excluir'
};

var FILTERED = ROWS.slice();

function applyFilters(){
  var f = filters;
  FILTERED = ROWS.filter(function(r){
    if (!f.anos.has(r[COL.AN])) return false;
    if (!f.tecnicos.has(r[COL.TC])) return false;
    if (!f.regioes.has(r[COL.RG])) return false;
    if (!f.tipos.has(r[COL.TG])) return false;
    if (!f.linhagens.has(r[COL.LN])) return false;
    if (f.tomazini === "somente" && r[COL.TM] !== 1) return false;
    if (f.tomazini === "excluir" && r[COL.TM] !== 0) return false;
    return true;
  });
}
applyFilters();

/* ============================================================
   Aggregation utilities
   ============================================================ */
function aggregate(rows, metricKey, aggOverride){
  var m = METRICS[metricKey];
  var agg = aggOverride || m.agg;
  if (rows.length === 0) return null;
  if (agg === "ratio"){
    var sn = 0, sd = 0;
    for (var r=0;r<rows.length;r++){
      var nv = rows[r][m.num], dv = rows[r][m.den];
      if (nv!=null) sn += nv;
      if (dv!=null) sd += dv;
    }
    return sd ? sn/sd : null;
  }
  if (agg === "sum"){
    var s = 0;
    for (var i=0;i<rows.length;i++){ var v = rows[i][m.col]; if (v!=null) s += v; }
    return s;
  }
  if (agg === "wavg"){
    var sw = 0, sv = 0;
    for (var j=0;j<rows.length;j++){
      var vv = rows[j][m.col], w = rows[j][COL.AR];
      if (vv!=null && w!=null){ sv += vv*w; sw += w; }
    }
    return sw ? sv/sw : null;
  }
  // mean (default)
  var sum=0, n=0;
  for (var k=0;k<rows.length;k++){
    var val = rows[k][m.col];
    if (val!=null){ sum+=val; n++; }
  }
  return n ? sum/n : null;
}

function groupByDim(rows, dimKey){
  var map = new Map();
  for (var i=0;i<rows.length;i++){
    var r = rows[i];
    var k = dimKeyForRow(dimKey, r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return map;
}

function fmtNum(v, dec){
  if (v==null || isNaN(v)) return "&ndash;";
  return v.toLocaleString("pt-BR", {minimumFractionDigits:dec, maximumFractionDigits:dec});
}
function fmtInt(v){
  if (v==null || isNaN(v)) return "&ndash;";
  return Math.round(v).toLocaleString("pt-BR");
}
function fmtMetric(v, metricKey){
  var m = METRICS[metricKey];
  if (m.unit === "R$") return fmtNum(v, m.dec) === "&ndash;" ? "&ndash;" : "R$ "+fmtNum(v, m.dec);
  return fmtNum(v, m.dec) + (m.unit ? " "+m.unit : "");
}
function fmtBRL(v){
  if (v==null || isNaN(v)) return "R$ 0";
  return "R$ " + v.toLocaleString("pt-BR", {minimumFractionDigits:0, maximumFractionDigits:0});
}

/* Escape for safe HTML text injection */
function esc(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/* ============================================================
   Chart registry (destroy-before-recreate pattern)
   ============================================================ */
var CHARTS = {};
function destroyChart(id){
  if (CHARTS[id]){ CHARTS[id].destroy(); delete CHARTS[id]; }
}
function makeChart(id, config){
  destroyChart(id);
  var el = document.getElementById(id);
  if (!el) return null;
  var ctx = el.getContext("2d");
  CHARTS[id] = new Chart(ctx, config);
  return CHARTS[id];
}

Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.color = "#786F68";
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.padding = 14;

if (window.ChartDataLabels){
  Chart.register(window.ChartDataLabels);
  Chart.defaults.set("plugins.datalabels", {display:false});
}
function dlConfig(formatterFn, opts){
  return Object.assign({
    display:true, color:"#241B1A", anchor:"end", align:"top", offset:2,
    font:{weight:"700", size:10.5}, formatter: formatterFn
  }, opts||{});
}

window.__NZ = {
  DATA:DATA, ROWS:ROWS, LK:LK, META:META, COL:COL,
  MESES_PT:MESES_PT, MESES_PT_FULL:MESES_PT_FULL,
  PALETTE:PALETTE, PALETTE_SOFT:PALETTE_SOFT,
  METRICS:METRICS, METRIC_ORDER:METRIC_ORDER, ECON_METRIC_ORDER:ECON_METRIC_ORDER,
  DIMENSIONS:DIMENSIONS, dimLabelFor:dimLabelFor, dimKeyForRow:dimKeyForRow, familiaFor:familiaFor,
  FAMILIA_LABELS: FAMILIA_RULES.map(function(r){return r.label;}).concat(["Outros Tomazini"]),
  filters:filters, applyFilters:applyFilters, get FILTERED(){return FILTERED;},
  aggregate:aggregate, groupByDim:groupByDim,
  fmtNum:fmtNum, fmtInt:fmtInt, fmtMetric:fmtMetric, fmtBRL:fmtBRL, esc:esc,
  CHARTS:CHARTS, destroyChart:destroyChart, makeChart:makeChart, dlConfig:dlConfig
};

})();

(function(){
"use strict";
var NZ = window.__NZ;

function yearlySeries(rows, metricKey, aggOverride){
  var map = NZ.groupByDim(rows, "ano");
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  var values = years.map(function(y){
    var g = map.get(y) || [];
    return g.length ? NZ.aggregate(g, metricKey, aggOverride) : null;
  });
  var counts = years.map(function(y){ return (map.get(y)||[]).length; });
  return {labels: years.map(String), values: values, counts: counts, years: years};
}

/* trend by year, split into 2 or more groups defined by a predicate function per row -> groupLabel */
function yearlySeriesGrouped(rows, metricKey, groupFn, groupLabels){
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  var out = {};
  groupLabels.forEach(function(gl){ out[gl] = years.map(function(){ return null; }); });
  years.forEach(function(y, yi){
    var rowsY = rows.filter(function(r){ return r[NZ.COL.AN]===y; });
    groupLabels.forEach(function(gl){
      var sub = rowsY.filter(function(r){ return groupFn(r)===gl; });
      out[gl][yi] = sub.length ? NZ.aggregate(sub, metricKey) : null;
    });
  });
  return {labels: years.map(String), series: out};
}

/* Ranking of a dimension by a metric, sorted best->worst per metric 'good' direction */
function rankingData(rows, dimKey, metricKey, opts){
  opts = opts || {};
  var minN = opts.minN != null ? opts.minN : 5;
  var map = NZ.groupByDim(rows, dimKey);
  var m = NZ.METRICS[metricKey];
  var arr = [];
  map.forEach(function(g, key){
    if (g.length < minN) return;
    var v = NZ.aggregate(g, metricKey);
    if (v==null) return;
    arr.push({
      key:key,
      label: NZ.dimLabelFor(dimKey, key),
      value: v,
      n: g.length,
      ar: NZ.aggregate(g, "ar", "sum")
    });
  });
  arr.sort(function(a,b){
    if (m.good === "down") return a.value - b.value;
    if (m.good === "up") return b.value - a.value;
    return b.value - a.value;
  });
  return arr;
}

function colorForIndex(i){ return NZ.PALETTE[i % NZ.PALETTE.length]; }
function colorForIndexSoft(i){ return NZ.PALETTE_SOFT[i % NZ.PALETTE_SOFT.length]; }

function baseLineDataset(label, data, color, opts){
  opts = opts || {};
  return Object.assign({
    label: label, data: data, borderColor: color,
    backgroundColor: color, pointRadius: 3, pointHoverRadius: 5,
    borderWidth: 2.5, tension: 0.35, spanGaps: true, fill:false
  }, opts);
}
function baseBarDataset(label, data, color, opts){
  opts = opts || {};
  return Object.assign({
    label:label, data:data, backgroundColor:color, borderRadius:5, maxBarThickness:46
  }, opts);
}

var GRID_COLOR = "rgba(120,111,104,.12)";
function commonScales(extra){
  return Object.assign({
    x: {grid:{display:false}, ticks:{font:{size:11}}},
    y: {grid:{color:GRID_COLOR}, ticks:{font:{size:11}}}
  }, extra||{});
}
function commonPlugins(extra){
  return Object.assign({
    legend:{position:"bottom"},
    tooltip:{backgroundColor:"#241B1A", padding:10, cornerRadius:8, titleFont:{weight:"700"}}
  }, extra||{});
}

/* Render a ranked list of horizontal bars into a container div */
function renderRankBars(containerId, rankArr, metricKey){
  var m = NZ.METRICS[metricKey];
  var el = document.getElementById(containerId);
  if (!rankArr.length){ el.innerHTML = "<div class='section-note' style='padding:20px;'>Sem dados suficientes para este recorte.</div>"; return; }
  var vals = rankArr.map(function(r){return r.value;});
  var max = Math.max.apply(null, vals.map(Math.abs));
  el.innerHTML = rankArr.map(function(r, i){
    var pct = max ? Math.max(4, Math.abs(r.value)/max*100) : 4;
    var color = i < 3 ? "#4C7A3D" : (i >= rankArr.length-3 ? "#DC3223" : "#F5B93C");
    return '<div class="rank-bar-row">'+
      '<div class="rank-bar-label" title="'+NZ.esc(r.label)+'">'+(i+1)+'. '+NZ.esc(r.label)+'</div>'+
      '<div class="rank-bar-track"><div class="rank-bar-fill" style="width:'+pct.toFixed(1)+'%;background:'+color+';"></div></div>'+
      '<div class="rank-bar-val">'+NZ.fmtNum(r.value, m.dec)+'</div>'+
    '</div>';
  }).join("");
}
NZ.renderRankBars = renderRankBars;

/* Simple least-squares linear regression: xs, ys arrays (same length, no nulls) */
function linearRegression(xs, ys){
  var n = xs.length;
  if (n < 2) return {slope:0, intercept: ys.length?ys[0]:0, predict:function(x){return ys.length?ys[0]:0;}};
  var sx=0, sy=0, sxy=0, sxx=0;
  for (var i=0;i<n;i++){ sx+=xs[i]; sy+=ys[i]; sxy+=xs[i]*ys[i]; sxx+=xs[i]*xs[i]; }
  var denom = (n*sxx - sx*sx);
  var slope = denom !== 0 ? (n*sxy - sx*sy)/denom : 0;
  var intercept = (sy - slope*sx)/n;
  return {slope:slope, intercept:intercept, predict:function(x){ return intercept + slope*x; }};
}
NZ.linearRegression = linearRegression;

/* Make an already-rendered <table> sortable by clicking column headers */
function cellSortValue(cell){
  if (!cell) return "";
  var txt = cell.textContent.trim();
  if (txt === "\u2013" || txt === "") return -Infinity;
  var cleaned = txt.replace(/\./g,"").replace(",", ".").replace(/[^\d.\-]/g,"");
  var n = parseFloat(cleaned);
  return isNaN(n) || cleaned==="" || cleaned==="-" ? txt.toLowerCase() : n;
}
function sortTableByColumn(table, colIdx, th, allThs, dirOverride){
  var dir = dirOverride || (th.getAttribute("data-dir") === "asc" ? "desc" : "asc");
  allThs.forEach(function(t){ t.removeAttribute("data-dir"); t.classList.remove("sort-active"); });
  th.setAttribute("data-dir", dir);
  th.classList.add("sort-active");

  var tbody = table.tBodies[0];
  if (!tbody) return;
  var allRows = Array.from(tbody.querySelectorAll("tr"));
  var totalRow = null;
  var dataRows = allRows.filter(function(r){
    var firstCellText = r.children[0] ? r.children[0].textContent.trim().toLowerCase() : "";
    if (firstCellText === "total"){ totalRow = r; return false; }
    return true;
  });
  dataRows.sort(function(a, b){
    var av = cellSortValue(a.children[colIdx]);
    var bv = cellSortValue(b.children[colIdx]);
    var cmp = (typeof av === "number" && typeof bv === "number") ? av-bv : String(av).localeCompare(String(bv), "pt-BR");
    return dir === "asc" ? cmp : -cmp;
  });
  dataRows.forEach(function(r){ tbody.appendChild(r); });
  if (totalRow) tbody.appendChild(totalRow);
}
function makeSortable(tableId, opts){
  var table = document.getElementById(tableId);
  if (!table) return;
  // wrap header row in a <thead>/rows in <tbody> if not already structured (our tables use plain <tr> soup)
  if (!table.tBodies.length){
    var rows = Array.from(table.querySelectorAll("tr"));
    if (!rows.length) return;
    var thead = document.createElement("thead");
    thead.appendChild(rows[0]);
    var tbody = document.createElement("tbody");
    rows.slice(1).forEach(function(r){ tbody.appendChild(r); });
    table.innerHTML = "";
    table.appendChild(thead);
    table.appendChild(tbody);
  }
  var headRow = table.tHead ? table.tHead.querySelector("tr") : table.querySelector("tr");
  if (!headRow) return;
  var ths = Array.from(headRow.querySelectorAll("th"));
  ths.forEach(function(th, colIdx){
    th.classList.add("sortable");
    if (!th.querySelector(".sort-arrow")){
      var arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      arrow.textContent = "\u2195";
      th.appendChild(arrow);
    }
    th.onclick = function(){ sortTableByColumn(table, colIdx, th, ths); };
  });
  if (opts && opts.defaultCol != null){
    sortTableByColumn(table, opts.defaultCol, ths[opts.defaultCol], ths, opts.defaultDir || "asc");
  }
}
NZ.makeSortable = makeSortable;

NZ.yearlySeries = yearlySeries;
NZ.yearlySeriesGrouped = yearlySeriesGrouped;
NZ.rankingData = rankingData;
NZ.colorForIndex = colorForIndex;
NZ.colorForIndexSoft = colorForIndexSoft;
NZ.baseLineDataset = baseLineDataset;
NZ.baseBarDataset = baseBarDataset;
NZ.commonScales = commonScales;
NZ.commonPlugins = commonPlugins;
NZ.GRID_COLOR = GRID_COLOR;

})();

(function(){
"use strict";
var NZ = window.__NZ;
var COL = NZ.COL, LK = NZ.LK, META = NZ.META, filters = NZ.filters;
var METRICS = NZ.METRICS, fmtMetric = NZ.fmtMetric, fmtInt = NZ.fmtInt, esc = NZ.esc;

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
var TABS = [
  {id:"diario", label:"Painel Diário", icon:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'},
  {id:"overview",  label:"Visão Geral", icon:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>'},
  {id:"anual",     label:"Histórico Anual", icon:'<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>'},
  {id:"mensal",    label:"Mensal / Sazonal", icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'},
  {id:"tecnicos",  label:"Técnicos", icon:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'},
  {id:"regioes",   label:"Regiões", icon:'<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>'},
  {id:"tomazini",  label:"Integrados Tomazini", icon:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'},
  {id:"aviario",   label:"Tipo de Aviário", icon:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>'},
  {id:"linhagem",  label:"Linhagem", icon:'<line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>'},
  {id:"pivot",     label:"Tabela Dinâmica", icon:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>'},
  {id:"clima",     label:"Clima", icon:'<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>'},
  {id:"projecoes", label:"Projeções 2027-2030", icon:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'},
  {id:"simulador", label:"Simulador de Ração", icon:'<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>'},
  {id:"importar",  label:"Importar Arquivo", icon:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'},
  {id:"aval2026",  label:"Avaliação 2026", icon:'<path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>'},
  {id:"economico", label:"Histórico Econômico", icon:'<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'},
  {id:"diarioMensal", label:"Abate Diário (Mensal)", icon:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="8" cy="15" r="1.5"/><circle cx="12" cy="15" r="1.5"/><circle cx="16" cy="15" r="1.5"/>'}
];
var dirty = {}; // tabId -> true means needs re-render
TABS.forEach(function(t){ dirty[t.id] = true; });
var activeTab = "overview";

function buildTabNav(){
  var nav = document.getElementById("tabNav");
  nav.innerHTML = TABS.map(function(t){
    return '<button class="tab-btn'+(t.id===activeTab?' active':'')+'" data-tab="'+t.id+'">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+t.icon+'</svg>'+
      '<span>'+t.label+'</span></button>';
  }).join("");
  nav.addEventListener("click", function(e){
    var btn = e.target.closest(".tab-btn");
    if (!btn) return;
    switchTab(btn.getAttribute("data-tab"));
  });
}

function switchTab(tabId){
  activeTab = tabId;
  document.querySelectorAll(".tab-btn").forEach(function(b){
    b.classList.toggle("active", b.getAttribute("data-tab")===tabId);
  });
  document.querySelectorAll(".tabpanel").forEach(function(p){
    p.classList.toggle("active", p.getAttribute("data-tab")===tabId);
  });
  renderTabIfDirty(tabId);
}

var RENDERERS = {}; // filled in by each tab module: RENDERERS.overview = function(){...}
function renderTabIfDirty(tabId){
  if (dirty[tabId] && RENDERERS[tabId]){
    RENDERERS[tabId]();
    dirty[tabId] = false;
  }
}
function markAllDirty(){
  TABS.forEach(function(t){ dirty[t.id] = true; });
}
function rerenderActive(){
  renderKpiHeader();
  renderFilterSummary();
  renderTabIfDirty(activeTab);
}

/* ============================================================
   KPI HEADER (hero cards) - always reflects current filters
   ============================================================ */
var KPI_HEADER_KEYS = ["iep","ca","gmd","mo","pm","ar","rc"];
function renderKpiHeader(){
  var rows = NZ.FILTERED;
  var html = KPI_HEADER_KEYS.map(function(mk){
    var m = METRICS[mk];
    var v = NZ.aggregate(rows, mk);
    var valStr = mk==="ar" ? fmtInt(v) : (mk==="rc" ? (v==null?"&ndash;":fmtInt(v/1000)) : NZ.fmtNum(v, m.dec));
    var unitStr = mk==="ar" ? "aves" : (mk==="rc" ? "ton" : m.unit);
    return '<div class="kpi-card"><div class="kpi-label">'+esc(m.short)+'</div>'+
      '<div class="kpi-value">'+valStr+(unitStr?' <span class="unit">'+unitStr+'</span>':'')+'</div>'+
      '<div class="kpi-delta">'+rows.length.toLocaleString("pt-BR")+' lotes no recorte</div></div>';
  }).join("");
  document.getElementById("kpiRow").innerHTML = html;
}

function renderFilterSummary(){
  var el = document.getElementById("filterSummary");
  var n = NZ.FILTERED.length;
  var pctTotal = ((n/NZ.ROWS.length)*100).toFixed(0);
  var parts = [];
  if (filters.anos.size < META.anos.length) parts.push(filters.anos.size+" ano(s)");
  if (filters.tecnicos.size < LK.tc.length) parts.push(filters.tecnicos.size+" técnico(s)");
  if (filters.regioes.size < LK.rg.length+1) parts.push(filters.regioes.size+" região(ões)");
  if (filters.tipos.size < LK.tg.length) parts.push(filters.tipos.size+" tipo(s) de aviário");
  if (filters.linhagens.size < LK.ln.length+1) parts.push(filters.linhagens.size+" linhagem(ns)");
  if (filters.tomazini !== "todos") parts.push(filters.tomazini==="somente" ? "somente Tomazini" : "excluindo Tomazini");
  el.innerHTML = '<b>'+n.toLocaleString("pt-BR")+'</b> lotes selecionados ('+pctTotal+'% da base) '+
    (parts.length ? '&middot; filtros ativos: <b>'+parts.join(", ")+'</b>' : '&middot; nenhum filtro ativo (base completa)');
}

/* ============================================================
   FILTER BAR
   ============================================================ */
function resetFiltersToAll(){
  filters.anos = new Set(META.anos);
  filters.tecnicos = new Set(LK.tc.map(function(_,i){return i;}));
  filters.regioes = new Set(LK.rg.map(function(_,i){return i;}).concat([-1]));
  filters.tipos = new Set(LK.tg.map(function(_,i){return i;}));
  filters.linhagens = new Set(LK.ln.map(function(_,i){return i;}).concat([-1]));
  filters.tomazini = "todos";
}
NZ.resetFiltersToAll = resetFiltersToAll;

function buildFilterBar(){
  var bar = document.getElementById("filterBar");
  bar.innerHTML =
    '<span class="filterbar-title">'+
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></svg>'+
      'Filtros segmentados</span>'+
    '<div class="filter-group" id="fg-ano"></div>'+
    '<div class="filter-group" id="fg-tecnico"></div>'+
    '<div class="filter-group" id="fg-regiao"></div>'+
    '<div class="filter-group" id="fg-aviario"></div>'+
    '<div class="filter-group" id="fg-linhagem"></div>'+
    '<div class="filter-group" id="fg-tomazini"></div>'+
    '<div class="filter-clear-all" id="fg-clear">'+
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z"/></svg>'+
      'Limpar filtros</div>';

  buildMultiSelect("fg-ano", "Ano", META.anos.map(function(a){return {value:a, label:String(a)};}), filters.anos, false);
  buildMultiSelect("fg-tecnico", "Técnico", LK.tc.map(function(t,i){return {value:i, label:t};}), filters.tecnicos, true);
  var rgOptions = LK.rg.map(function(t,i){return {value:i, label:t};}).concat([{value:-1, label:"Não informado"}]);
  buildMultiSelect("fg-regiao", "Região", rgOptions, filters.regioes, true);
  buildMultiSelect("fg-aviario", "Aviário", LK.tg.map(function(t,i){return {value:i, label:t};}), filters.tipos, false);
  var lnOptions = LK.ln.map(function(t,i){return {value:i, label:t};}).concat([{value:-1, label:"Não informado"}]);
  buildMultiSelect("fg-linhagem", "Linhagem", lnOptions, filters.linhagens, true);
  buildTomaziniPills();

  document.getElementById("fg-clear").addEventListener("click", function(){
    resetFiltersToAll();
    buildFilterBar();
    onFilterChange();
  });
}

function buildTomaziniPills(){
  var el = document.getElementById("fg-tomazini");
  var opts = [["todos","Todos integrados"],["somente","Somente Tomazini"],["excluir","Excluir Tomazini"]];
  el.innerHTML = '<div class="pill-group">'+opts.map(function(o){
    return '<div class="pill'+(filters.tomazini===o[0]?' on':'')+'" data-val="'+o[0]+'">'+o[1]+'</div>';
  }).join("")+'</div>';
  el.querySelectorAll(".pill").forEach(function(p){
    p.addEventListener("click", function(){
      filters.tomazini = p.getAttribute("data-val");
      el.querySelectorAll(".pill").forEach(function(x){x.classList.remove("on");});
      p.classList.add("on");
      onFilterChange();
    });
  });
}

function buildMultiSelect(containerId, label, options, selectedSet, searchable){
  var el = document.getElementById(containerId);
  var allSelected = selectedSet.size === options.length;
  el.innerHTML =
    '<div class="filter-btn'+(allSelected?'':' active-filter')+'" data-toggle>'+
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>'+
      esc(label)+(allSelected?'':' <span class="count-badge">'+selectedSet.size+'</span>')+
    '</div>'+
    '<div class="filter-panel" data-panel>'+
      (searchable ? '<input class="filter-panel-search" placeholder="Buscar '+esc(label.toLowerCase())+'&hellip;">' : '')+
      '<div class="filter-panel-list"></div>'+
      '<div class="filter-panel-actions">'+
        '<button class="link-btn" data-all>Selecionar todos</button>'+
        '<button class="link-btn" data-none>Limpar</button>'+
      '</div>'+
    '</div>';

  var listEl = el.querySelector(".filter-panel-list");
  function renderList(filterText){
    var ft = (filterText||"").toLowerCase();
    listEl.innerHTML = options.filter(function(o){
      return !ft || o.label.toLowerCase().indexOf(ft)>-1;
    }).map(function(o){
      var checked = selectedSet.has(o.value) ? "checked" : "";
      return '<label class="filter-opt"><input type="checkbox" data-val="'+esc(String(o.value))+'" '+checked+'>'+esc(o.label)+'</label>';
    }).join("");
  }
  renderList("");

  var toggleBtn = el.querySelector("[data-toggle]");
  var panel = el.querySelector("[data-panel]");
  toggleBtn.addEventListener("click", function(ev){
    ev.stopPropagation();
    document.querySelectorAll(".filter-panel.open").forEach(function(p){ if(p!==panel) p.classList.remove("open"); });
    panel.classList.toggle("open");
  });
  if (searchable){
    el.querySelector(".filter-panel-search").addEventListener("input", function(e){ renderList(e.target.value); });
  }
  listEl.addEventListener("change", function(e){
    var cb = e.target;
    var raw = cb.getAttribute("data-val");
    var val = (raw === "-1" || /^-?\d+$/.test(raw)) ? parseInt(raw,10) : raw;
    if (cb.checked) selectedSet.add(val); else selectedSet.delete(val);
    updateFilterBtnState(el, label, options.length, selectedSet.size);
    onFilterChange();
  });
  el.querySelector("[data-all]").addEventListener("click", function(){
    options.forEach(function(o){ selectedSet.add(o.value); });
    renderList(el.querySelector(".filter-panel-search") ? el.querySelector(".filter-panel-search").value : "");
    updateFilterBtnState(el, label, options.length, selectedSet.size);
    onFilterChange();
  });
  el.querySelector("[data-none]").addEventListener("click", function(){
    selectedSet.clear();
    renderList(el.querySelector(".filter-panel-search") ? el.querySelector(".filter-panel-search").value : "");
    updateFilterBtnState(el, label, options.length, selectedSet.size);
    onFilterChange();
  });
}
function updateFilterBtnState(el, label, total, selCount){
  var btn = el.querySelector("[data-toggle]");
  var allSelected = selCount === total;
  btn.classList.toggle("active-filter", !allSelected);
  btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><polyline points="6 9 12 15 18 9"/></svg>'+
    esc(label)+(allSelected?'':' <span class="count-badge">'+selCount+'</span>');
}

document.addEventListener("click", function(e){
  if (!e.target.closest(".filter-group")){
    document.querySelectorAll(".filter-panel.open").forEach(function(p){ p.classList.remove("open"); });
  }
});

function onFilterChange(){
  NZ.applyFilters();
  markAllDirty();
  rerenderActive();
}

NZ.TABS = TABS;
NZ.RENDERERS = RENDERERS;
NZ.switchTab = switchTab;
NZ.markAllDirty = markAllDirty;
NZ.buildTabNav = buildTabNav;
NZ.buildFilterBar = buildFilterBar;
NZ.renderKpiHeader = renderKpiHeader;
NZ.renderFilterSummary = renderFilterSummary;
NZ.rerenderActive = rerenderActive;

})();

(function(){
"use strict";
var NZ = window.__NZ;

function render(){
  var rows = NZ.FILTERED;
  var ys = null;

  // CA / CAc chart
  var caS = NZ.yearlySeries(rows, "ca");
  var cacS = NZ.yearlySeries(rows, "cac");
  NZ.makeChart("ovCaChart", {
    type:"line",
    data:{labels:caS.labels, datasets:[
      NZ.baseLineDataset("CA", caS.values, NZ.colorForIndex(0)),
      NZ.baseLineDataset("CAc", cacS.values, NZ.colorForIndex(1))
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // IEP / IEPc chart
  var iepS = NZ.yearlySeries(rows, "iep");
  var iepcS = NZ.yearlySeries(rows, "iepc");
  NZ.makeChart("ovIepChart", {
    type:"line",
    data:{labels:iepS.labels, datasets:[
      NZ.baseLineDataset("IEP", iepS.values, NZ.colorForIndex(2)),
      NZ.baseLineDataset("IEPc", iepcS.values, NZ.colorForIndex(3))
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // GMD / Peso Medio (dual axis)
  var gmdS = NZ.yearlySeries(rows, "gmd");
  var pmS = NZ.yearlySeries(rows, "pm");
  NZ.makeChart("ovGmdChart", {
    type:"line",
    data:{labels:gmdS.labels, datasets:[
      NZ.baseLineDataset("GMD (g)", gmdS.values, NZ.colorForIndex(4), {yAxisID:"y"}),
      NZ.baseLineDataset("Peso Médio (kg)", pmS.values, NZ.colorForIndex(5), {yAxisID:"y1"})
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{grid:{display:false}},
        y:{position:"left", grid:{color:NZ.GRID_COLOR}, title:{display:true,text:"GMD (g)",font:{size:10}}},
        y1:{position:"right", grid:{display:false}, title:{display:true,text:"Peso Médio (kg)",font:{size:10}}}
      },
      plugins:NZ.commonPlugins()}
  });

  // Mortalidade
  var moS = NZ.yearlySeries(rows, "mo");
  NZ.makeChart("ovMortChart", {
    type:"bar",
    data:{labels:moS.labels, datasets:[NZ.baseBarDataset("Mortalidade (%)", moS.values, NZ.colorForIndex(0))]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins({legend:{display:false}})}
  });

  // Year summary table
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  var head = "<tr><th>Ano</th><th>Lotes</th><th>CA</th><th>CAc</th><th>IEP</th><th>IEPc</th><th>GMD (g)</th><th>Peso Médio (kg)</th><th>Mortalidade (%)</th><th>Volume Abatido</th><th>Ração (ton)</th></tr>";
  var body = years.map(function(y){
    var g = rows.filter(function(r){ return r[NZ.COL.AN]===y; });
    if (!g.length) return "";
    return "<tr><td><b>"+y+"</b></td><td class='num'>"+g.length.toLocaleString("pt-BR")+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iepc"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"rc","sum")/1000)+"</td></tr>";
  }).join("");
  document.getElementById("ovYearTable").innerHTML = head + body;
  NZ.makeSortable("ovYearTable");
}

NZ.RENDERERS.overview = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

function render(){
  var rows = NZ.FILTERED;
  var grid = document.getElementById("anualGrid");
  var order = NZ.METRIC_ORDER;

  grid.innerHTML = order.map(function(mk){
    var m = NZ.METRICS[mk];
    return '<div class="card"><div class="card-title">'+NZ.esc(m.label)+'</div>'+
      '<div class="card-sub">'+(m.good==="down"?"Quanto menor, melhor":m.good==="up"?"Quanto maior, melhor":"Indicador de referência")+'</div>'+
      '<div class="chart-wrap short"><canvas id="an_'+mk+'"></canvas></div></div>';
  }).join("");

  order.forEach(function(mk, i){
    var m = NZ.METRICS[mk];
    var s = NZ.yearlySeries(rows, mk);
    var isBar = (m.agg === "sum");
    NZ.makeChart("an_"+mk, {
      type: isBar ? "bar" : "line",
      data:{labels:s.labels, datasets:[
        isBar ? NZ.baseBarDataset(m.short, s.values, NZ.colorForIndex(i))
              : NZ.baseLineDataset(m.short, s.values, NZ.colorForIndex(i))
      ]},
      options:{responsive:true, maintainAspectRatio:false,
        scales:NZ.commonScales(),
        plugins:NZ.commonPlugins({legend:{display:false},
          tooltip:{callbacks:{label:function(ctx){ return NZ.fmtMetric(ctx.parsed.y, mk); }}}})
      }
    });
  });
}

NZ.RENDERERS.anual = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "ca";
var initialized = false;

function populateSelect(){
  var sel = document.getElementById("moMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; render(); });
}

function heatColor(value, min, max, good){
  if (value==null || min==null || max==null || min===max) return "#FFFFFF";
  var t = (value-min)/(max-min); // 0..1
  if (good === "down") t = 1-t; // invert so low(=t high after invert)=good=green
  // t=1 => good (green), t=0 => bad (red)
  var r1=[204,21,23], r2=[76,122,61]; // red -> green
  var c = r1.map(function(a,i){ return Math.round(a + (r2[i]-a)*t); });
  return "rgb("+c.join(",")+")";
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  var rows = NZ.FILTERED;
  var m = NZ.METRICS[selectedMetric];
  document.getElementById("moChartSub").textContent = "Indicador: "+m.label+" · uma linha por ano, eixo horizontal = mês do abate";

  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  var datasets = years.map(function(y, i){
    var data = [];
    for (var mm=1; mm<=12; mm++){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y && r[NZ.COL.ME]===mm; });
      data.push(g.length ? NZ.aggregate(g, selectedMetric) : null);
    }
    return NZ.baseLineDataset(String(y), data, NZ.colorForIndex(i));
  });
  NZ.makeChart("moLineChart", {
    type:"line",
    data:{labels:NZ.MESES_PT, datasets:datasets},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // Heatmap table: rows = years, cols = months
  var grid = []; // grid[yearIdx][monthIdx] = value
  var allVals = [];
  years.forEach(function(y){
    var rowArr = [];
    for (var mm=1; mm<=12; mm++){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y && r[NZ.COL.ME]===mm; });
      var v = g.length ? NZ.aggregate(g, selectedMetric) : null;
      rowArr.push(v);
      if (v!=null) allVals.push(v);
    }
    grid.push(rowArr);
  });
  var min = allVals.length ? Math.min.apply(null, allVals) : null;
  var max = allVals.length ? Math.max.apply(null, allVals) : null;

  var head = "<tr><th>Ano</th>"+NZ.MESES_PT.map(function(mn){return "<th style='text-align:center'>"+mn+"</th>";}).join("")+"</tr>";
  var body = years.map(function(y, yi){
    var cells = grid[yi].map(function(v){
      var bg = heatColor(v, min, max, m.good);
      var txt = v==null ? "&ndash;" : NZ.fmtNum(v, m.dec);
      return "<td style='text-align:center;background:"+bg+";color:#fff;font-weight:700;'>"+txt+"</td>";
    }).join("");
    return "<tr><td><b>"+y+"</b></td>"+cells+"</tr>";
  }).join("");
  document.getElementById("moHeatTable").innerHTML = head + body;
}

NZ.RENDERERS.mensal = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "ca";
var initialized = false;

function populateSelect(){
  var sel = document.getElementById("tecMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; render(); });
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  var rows = NZ.FILTERED;
  var rank = NZ.rankingData(rows, "tecnico", selectedMetric, {minN:5});
  document.getElementById("tecCount").textContent = rank.length+" técnicos com volume mínimo de 5 lotes no recorte atual (de "+NZ.LK.tc.length+" cadastrados)";
  NZ.renderRankBars("tecRankBars", rank, selectedMetric);

  // scatter CA x IEP, bubble = volume
  var map = NZ.groupByDim(rows, "tecnico");
  var pts = [];
  map.forEach(function(g, key){
    if (g.length < 5) return;
    var ca = NZ.aggregate(g, "ca"), iep = NZ.aggregate(g, "iep"), vol = NZ.aggregate(g, "ar", "sum");
    pts.push({x:ca, y:iep, vol:vol, label: NZ.dimLabelFor("tecnico", key), n:g.length});
  });
  var volMin = Math.min.apply(null, pts.map(function(p){return p.vol;}));
  var volMax = Math.max.apply(null, pts.map(function(p){return p.vol;}));
  pts.forEach(function(p){
    p.r = volMax>volMin ? 6 + (p.vol-volMin)/(volMax-volMin)*20 : 12;
  });
  NZ.makeChart("tecScatterChart", {
    type:"bubble",
    data:{datasets:[{label:"Técnicos", data:pts, backgroundColor:"rgba(220,50,35,.55)", borderColor:"#DC3223", borderWidth:1}]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{title:{display:true,text:"CA"}, grid:{color:NZ.GRID_COLOR}},
        y:{title:{display:true,text:"IEP"}, grid:{color:NZ.GRID_COLOR}}
      },
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(ctx){
        var p = ctx.raw; return p.label+": CA "+p.x.toFixed(3)+", IEP "+p.y.toFixed(1)+" ("+p.n+" lotes)";
      }}}}
    }
  });

  // full comparison table
  var head = "<tr><th>Técnico</th><th>Lotes</th><th>CA</th><th>CAc</th><th>IEP</th><th>IEPc</th><th>GMD</th><th>Peso Médio</th><th>Mort. %</th><th>Aves/m²</th><th>Volume Abatido</th></tr>";
  var allRank = [];
  map.forEach(function(g, key){
    allRank.push({key:key, label:NZ.dimLabelFor("tecnico", key), g:g});
  });
  allRank.sort(function(a,b){ return NZ.aggregate(b.g,"iep") - NZ.aggregate(a.g,"iep"); });
  var body = allRank.map(function(r){
    var g = r.g;
    return "<tr><td><b>"+NZ.esc(r.label)+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iepc"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dka"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("tecTable").innerHTML = head + body;
  NZ.makeSortable("tecTable", {defaultCol:4, defaultDir:"desc"});
}

NZ.RENDERERS.tecnicos = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "ca";
var initialized = false;

function populateSelect(){
  var sel = document.getElementById("regMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; render(); });
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  var rows = NZ.FILTERED;
  var rank = NZ.rankingData(rows, "regiao", selectedMetric, {minN:5});
  document.getElementById("regCount").textContent = rank.length+" regiões com volume mínimo de 5 lotes no recorte atual (de "+NZ.LK.rg.length+" cadastradas)";
  NZ.renderRankBars("regRankBars", rank, selectedMetric);

  var map = NZ.groupByDim(rows, "regiao");
  var pts = [];
  map.forEach(function(g, key){
    if (g.length < 5) return;
    var ca = NZ.aggregate(g, "ca"), iep = NZ.aggregate(g, "iep"), vol = NZ.aggregate(g, "ar", "sum");
    pts.push({x:ca, y:iep, vol:vol, label: NZ.dimLabelFor("regiao", key), n:g.length});
  });
  var volMin = Math.min.apply(null, pts.map(function(p){return p.vol;}));
  var volMax = Math.max.apply(null, pts.map(function(p){return p.vol;}));
  pts.forEach(function(p){
    p.r = volMax>volMin ? 6 + (p.vol-volMin)/(volMax-volMin)*20 : 12;
  });
  NZ.makeChart("regScatterChart", {
    type:"bubble",
    data:{datasets:[{label:"Regiões", data:pts, backgroundColor:"rgba(44,110,127,.55)", borderColor:"#2C6E7F", borderWidth:1}]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{title:{display:true,text:"CA"}, grid:{color:NZ.GRID_COLOR}},
        y:{title:{display:true,text:"IEP"}, grid:{color:NZ.GRID_COLOR}}
      },
      plugins:{legend:{display:false}, tooltip:{callbacks:{label:function(ctx){
        var p = ctx.raw; return p.label+": CA "+p.x.toFixed(3)+", IEP "+p.y.toFixed(1)+" ("+p.n+" lotes)";
      }}}}
    }
  });

  var head = "<tr><th>Região</th><th>Lotes</th><th>CA</th><th>CAc</th><th>IEP</th><th>IEPc</th><th>GMD</th><th>Peso Médio</th><th>Mort. %</th><th>Aves/m²</th><th>Volume Abatido</th></tr>";
  var allRank = [];
  map.forEach(function(g, key){
    allRank.push({key:key, label:NZ.dimLabelFor("regiao", key), g:g});
  });
  allRank.sort(function(a,b){ return NZ.aggregate(b.g,"iep") - NZ.aggregate(a.g,"iep"); });
  var body = allRank.map(function(r){
    var g = r.g;
    return "<tr><td><b>"+NZ.esc(r.label)+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iepc"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dka"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("regTable").innerHTML = head + body;
  NZ.makeSortable("regTable", {defaultCol:4, defaultDir:"desc"});
}

NZ.RENDERERS.regioes = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

function render(){
  var rows = NZ.FILTERED;
  var tom = rows.filter(function(r){ return r[NZ.COL.TM]===1; });
  var out = rows.filter(function(r){ return r[NZ.COL.TM]===0; });

  var pctLotes = rows.length ? (tom.length/rows.length*100) : 0;
  var pctVol = (NZ.aggregate(rows,"ar","sum")||0) ? (NZ.aggregate(tom,"ar","sum")||0)/NZ.aggregate(rows,"ar","sum")*100 : 0;
  var nNucleos = new Set(tom.map(function(r){return r[NZ.COL.PR];})).size;

  document.getElementById("tomStatCards").innerHTML =
    statCard("Lotes Tomazini", tom.length.toLocaleString("pt-BR"), pctLotes.toFixed(0)+"% do total no recorte", "red") +
    statCard("Volume abatido Tomazini", NZ.fmtInt(NZ.aggregate(tom,"ar","sum"))+" aves", pctVol.toFixed(0)+"% do volume total", "") +
    statCard("Proprietários Tomazini", nNucleos, "proprietários ativos no recorte", "red") +
    statCard("CA médio Tomazini vs. Outros", NZ.fmtNum(NZ.aggregate(tom,"ca"),3)+" / "+NZ.fmtNum(NZ.aggregate(out,"ca"),3), "Tomazini / demais integrados", "");

  // Compare grid: one mini bar chart per metric, Tomazini vs Outros
  var compareMetrics = ["ca","cac","iep","iepc","gmd","pm","mo","dka","dkg"];
  var compareGrid = document.getElementById("tomCompareGrid");
  compareGrid.innerHTML = compareMetrics.map(function(mk){
    var mm = NZ.METRICS[mk];
    return '<div class="card"><div class="card-title">'+NZ.esc(mm.label)+'</div>'+
      '<div class="card-sub">'+(mm.good==="down"?"Quanto menor, melhor":mm.good==="up"?"Quanto maior, melhor":"Indicador de referência")+'</div>'+
      '<div class="chart-wrap short"><canvas id="tomcmp_'+mk+'"></canvas></div></div>';
  }).join("");
  compareMetrics.forEach(function(mk){
    var mm = NZ.METRICS[mk];
    NZ.makeChart("tomcmp_"+mk, {
      type:"bar",
      data:{labels:["Tomazini","Outros"], datasets:[{
        data:[NZ.aggregate(tom, mk), NZ.aggregate(out, mk)],
        backgroundColor:["#DC3223","#3D5A80"], borderRadius:5, maxBarThickness:60
      }]},
      options:{responsive:true, maintainAspectRatio:false,
        layout:{padding:{top:20}},
        scales:NZ.commonScales({y:{grid:{color:NZ.GRID_COLOR}, ticks:{display:false}}}),
        plugins:NZ.commonPlugins({legend:{display:false},
          datalabels: NZ.dlConfig(function(v){ return NZ.fmtNum(v, mm.dec); }),
          tooltip:{callbacks:{label:function(ctx){ return NZ.fmtMetric(ctx.parsed.y, mk); }}}})}
    });
  });

  // Trend chart: CA by year, Tomazini vs Outros
  var trend = NZ.yearlySeriesGrouped(rows, "ca", function(r){ return r[NZ.COL.TM]===1 ? "Tomazini" : "Outros integrados"; }, ["Tomazini","Outros integrados"]);
  NZ.makeChart("tomTrendChart", {
    type:"line",
    data:{labels:trend.labels, datasets:[
      NZ.baseLineDataset("Tomazini", trend.series["Tomazini"], "#DC3223"),
      NZ.baseLineDataset("Outros integrados", trend.series["Outros integrados"], "#3D5A80")
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  var trendIep = NZ.yearlySeriesGrouped(rows, "iep", function(r){ return r[NZ.COL.TM]===1 ? "Tomazini" : "Outros integrados"; }, ["Tomazini","Outros integrados"]);
  NZ.makeChart("tomTrendChart2", {
    type:"line",
    data:{labels:trendIep.labels, datasets:[
      NZ.baseLineDataset("Tomazini", trendIep.series["Tomazini"], "#DC3223"),
      NZ.baseLineDataset("Outros integrados", trendIep.series["Outros integrados"], "#3D5A80")
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // Nucleo ranking table (only Tomazini group, by proprietario/nucleo)
  var rank = NZ.rankingData(tom, "proprietario", "ca", {minN:3});
  var head = "<tr><th>Proprietário Tomazini</th><th>Lotes</th><th>CA</th><th>IEP</th><th>GMD</th><th>Mort. %</th><th>Peso Médio</th><th>Volume Abatido</th></tr>";
  var body = rank.map(function(r){
    var g = tom.filter(function(row){ return row[NZ.COL.PR]===r.key; });
    return "<tr><td><b>"+NZ.esc(r.label)+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("tomNucleoTable").innerHTML = head + (body || "<tr><td colspan='7' class='section-note' style='padding:16px;'>Nenhum núcleo Tomazini com pelo menos 3 lotes neste recorte.</td></tr>");
  if (body) NZ.makeSortable("tomNucleoTable", {defaultCol:2, defaultDir:"asc"});
}

function statCard(label, value, note, colorClass){
  return '<div class="stat-card '+(colorClass||"")+'"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note)+'</div></div>';
}

NZ.RENDERERS.tomazini = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

function render(){
  var rows = NZ.FILTERED;
  var map = NZ.groupByDim(rows, "aviario");
  var tipos = NZ.LK.tg.map(function(_,i){return i;}).filter(function(i){ return map.has(i) && map.get(i).length>0; });
  tipos.sort(function(a,b){ return NZ.dimLabelFor("aviario",a).localeCompare(NZ.dimLabelFor("aviario",b)); });

  var barMetrics = ["ca","cac","iep","iepc","gmd","pm","mo","dka","dkg"];
  var barGrid = document.getElementById("avBarGrid");
  barGrid.innerHTML = barMetrics.map(function(mk){
    var mm = NZ.METRICS[mk];
    return '<div class="card"><div class="card-title">'+NZ.esc(mm.label)+'</div>'+
      '<div class="card-sub">'+(mm.good==="down"?"Quanto menor, melhor":mm.good==="up"?"Quanto maior, melhor":"Indicador de referência")+'</div>'+
      '<div class="chart-wrap short"><canvas id="av_'+mk+'"></canvas></div></div>';
  }).join("");
  barMetrics.forEach(function(mk){
    var mm = NZ.METRICS[mk];
    NZ.makeChart("av_"+mk, {
      type:"bar",
      data:{
        labels: tipos.map(function(ti){ return NZ.dimLabelFor("aviario", ti); }),
        datasets:[{data: tipos.map(function(ti){ return NZ.aggregate(map.get(ti), mk); }),
          backgroundColor: tipos.map(function(_,idx){ return NZ.colorForIndex(idx); }), borderRadius:5, maxBarThickness:50}]
      },
      options:{responsive:true, maintainAspectRatio:false,
        layout:{padding:{top:20}},
        scales:NZ.commonScales({y:{grid:{color:NZ.GRID_COLOR}, ticks:{display:false}}}),
        plugins:NZ.commonPlugins({legend:{display:false},
          datalabels: NZ.dlConfig(function(v){ return NZ.fmtNum(v, mm.dec); }),
          tooltip:{callbacks:{label:function(ctx){ return NZ.fmtMetric(ctx.parsed.y, mk); }}}})
      }
    });
  });

  // Radar: normalize each metric 0-100 where 100 = best among the groups shown
  var radarMetrics = ["ca","iep","gmd","mo","pm","dka"];
  var radarData = tipos.map(function(ti){
    var g = map.get(ti);
    return radarMetrics.map(function(mk){ return NZ.aggregate(g, mk); });
  });
  var normalized = radarMetrics.map(function(mk, mi){
    var vals = radarData.map(function(row){ return row[mi]; });
    var m = NZ.METRICS[mk];
    var best = m.good==="down" ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
    var worst = m.good==="down" ? Math.max.apply(null, vals) : Math.min.apply(null, vals);
    return vals.map(function(v){
      if (best===worst) return 100;
      var t = (v-worst)/(best-worst);
      return Math.round(t*100);
    });
  });
  NZ.makeChart("avRadarChart", {
    type:"radar",
    data:{
      labels: radarMetrics.map(function(mk){ return NZ.METRICS[mk].short; }),
      datasets: tipos.map(function(ti, idx){
        return {label: NZ.dimLabelFor("aviario", ti), data: normalized.map(function(arr){ return arr[idx]; }),
          borderColor: NZ.colorForIndex(idx), backgroundColor: NZ.colorForIndex(idx)+"33", pointBackgroundColor: NZ.colorForIndex(idx)};
      })
    },
    options:{responsive:true, maintainAspectRatio:false,
      scales:{r:{min:0, max:100, ticks:{display:false}, grid:{color:NZ.GRID_COLOR}}},
      plugins:{legend:{position:"bottom"}}
    }
  });

  // Trend by year
  var trend = NZ.yearlySeriesGrouped(rows, "ca", function(r){ return NZ.dimLabelFor("aviario", r[NZ.COL.TG]); },
    tipos.map(function(ti){ return NZ.dimLabelFor("aviario", ti); }));
  NZ.makeChart("avTrendChart", {
    type:"line",
    data:{labels:trend.labels, datasets: tipos.map(function(ti, idx){
      var lbl = NZ.dimLabelFor("aviario", ti);
      return NZ.baseLineDataset(lbl, trend.series[lbl], NZ.colorForIndex(idx));
    })},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  var head = "<tr><th>Tipo de Aviário</th><th>Lotes</th><th>CA</th><th>CAc</th><th>IEP</th><th>IEPc</th><th>GMD</th><th>Peso Médio</th><th>Mort. %</th><th>Aves/m²</th><th>Kg/m²</th><th>Volume Abatido</th></tr>";
  var body = tipos.map(function(ti){
    var g = map.get(ti);
    return "<tr><td><b>"+NZ.esc(NZ.dimLabelFor("aviario",ti))+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iepc"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dka"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dkg"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("avTable").innerHTML = head + body;
  NZ.makeSortable("avTable");
}

NZ.RENDERERS.aviario = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "ca";
var initialized = false;
var TOP_N = 7;

function populateSelect(){
  var sel = document.getElementById("lnMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; render(); });
}

function statCard(label, value, note){
  return '<div class="stat-card"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note)+'</div></div>';
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  var rows = NZ.FILTERED;
  var map = NZ.groupByDim(rows, "linhagem");

  // ---- Stat cards ----
  var allGroups = [];
  map.forEach(function(g, key){ allGroups.push({key:key, label:NZ.dimLabelFor("linhagem", key), g:g}); });
  var byVolume = allGroups.slice().sort(function(a,b){ return NZ.aggregate(b.g,"ar","sum") - NZ.aggregate(a.g,"ar","sum"); });
  var eligible = allGroups.filter(function(o){ return o.g.length >= 15; });
  var byCa = eligible.slice().sort(function(a,b){ return NZ.aggregate(a.g,"ca") - NZ.aggregate(b.g,"ca"); });
  document.getElementById("lnStatCards").innerHTML =
    statCard("Linhagens distintas", allGroups.length, "no recorte atual de filtros") +
    statCard("Mais utilizada", byVolume[0] ? byVolume[0].label : "&ndash;", byVolume[0] ? NZ.fmtInt(byVolume[0].g.length)+" lotes" : "") +
    statCard("Melhor CA médio", byCa[0] ? byCa[0].label : "&ndash;", byCa[0] ? "CA "+NZ.fmtNum(NZ.aggregate(byCa[0].g,"ca"),3) : "mín. 15 lotes") +
    statCard("Maior volume abatido", byVolume[0] ? NZ.fmtInt(NZ.aggregate(byVolume[0].g,"ar","sum"))+" aves" : "&ndash;", byVolume[0] ? byVolume[0].label : "");

  // ---- Ranking bars (existing) ----
  var rank = NZ.rankingData(rows, "linhagem", selectedMetric, {minN:15});
  NZ.renderRankBars("lnRankBars", rank, selectedMetric);

  // ---- Top-N linhagens by volume (for charts below) ----
  var top = byVolume.slice(0, TOP_N);

  // ---- Small multiples grid with data labels ----
  var barMetrics = ["ca","iep","gmd","mo","pm"];
  var grid = document.getElementById("lnBarGrid");
  grid.innerHTML = barMetrics.map(function(mk){
    var mm = NZ.METRICS[mk];
    return '<div class="card"><div class="card-title">'+NZ.esc(mm.label)+'</div>'+
      '<div class="card-sub">'+(mm.good==="down"?"Quanto menor, melhor":mm.good==="up"?"Quanto maior, melhor":"Indicador de referência")+' &middot; top '+TOP_N+' por volume</div>'+
      '<div class="chart-wrap short"><canvas id="ln_'+mk+'"></canvas></div></div>';
  }).join("");
  barMetrics.forEach(function(mk){
    var mm = NZ.METRICS[mk];
    var ordered = top.slice().sort(function(a,b){
      var va = NZ.aggregate(a.g, mk), vb = NZ.aggregate(b.g, mk);
      return mm.good==="down" ? va-vb : vb-va;
    });
    NZ.makeChart("ln_"+mk, {
      type:"bar",
      data:{
        labels: ordered.map(function(o){ return o.label.length>14 ? o.label.slice(0,13)+"…" : o.label; }),
        datasets:[{data: ordered.map(function(o){ return NZ.aggregate(o.g, mk); }),
          backgroundColor: ordered.map(function(_,idx){ return NZ.colorForIndex(idx); }), borderRadius:5, maxBarThickness:34}]
      },
      options:{indexAxis:"y", responsive:true, maintainAspectRatio:false,
        layout:{padding:{right:34}},
        scales:{x:{grid:{color:NZ.GRID_COLOR}, ticks:{display:false}}, y:{grid:{display:false}, ticks:{font:{size:10.5}}}},
        plugins:{legend:{display:false},
          datalabels: NZ.dlConfig(function(v){ return NZ.fmtNum(v, mm.dec); }, {anchor:"end", align:"right", offset:4}),
          tooltip:{backgroundColor:"#241B1A", padding:10, cornerRadius:8, callbacks:{label:function(ctx){ return NZ.fmtMetric(ctx.parsed.x, mk); }}}}
      }
    });
  });

  // ---- Trend by year: CA and IEP, top linhagens ----
  var topLabels = top.map(function(o){ return o.label; });
  var trendCa = NZ.yearlySeriesGrouped(rows, "ca", function(r){ return NZ.dimLabelFor("linhagem", r[NZ.COL.LN]); }, topLabels);
  NZ.makeChart("lnTrendCaChart", {
    type:"line",
    data:{labels:trendCa.labels, datasets: topLabels.map(function(lbl, idx){
      return NZ.baseLineDataset(lbl, trendCa.series[lbl], NZ.colorForIndex(idx));
    })},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });
  var trendIep = NZ.yearlySeriesGrouped(rows, "iep", function(r){ return NZ.dimLabelFor("linhagem", r[NZ.COL.LN]); }, topLabels);
  NZ.makeChart("lnTrendIepChart", {
    type:"line",
    data:{labels:trendIep.labels, datasets: topLabels.map(function(lbl, idx){
      return NZ.baseLineDataset(lbl, trendIep.series[lbl], NZ.colorForIndex(idx));
    })},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // ---- Linhagem x Tipo de Aviario (CA) ----
  var tipos = NZ.LK.tg.map(function(_,i){return i;}).filter(function(i){
    return rows.some(function(r){ return r[NZ.COL.TG]===i; });
  });
  NZ.makeChart("lnAviarioChart", {
    type:"bar",
    data:{
      labels: topLabels,
      datasets: tipos.map(function(ti, idx){
        return {label: NZ.dimLabelFor("aviario", ti), backgroundColor: NZ.colorForIndex(idx), borderRadius:5,
          data: top.map(function(o){
            var sub = o.g.filter(function(r){ return r[NZ.COL.TG]===ti; });
            return sub.length ? NZ.aggregate(sub, "ca") : null;
          })};
      })
    },
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(),
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){ return ctx.dataset.label+": "+NZ.fmtMetric(ctx.parsed.y,"ca"); }}}})}
  });

  // ---- Full table ----
  var allRank = allGroups.slice().sort(function(a,b){ return b.g.length - a.g.length; });
  var head = "<tr><th>Linhagem</th><th>Lotes</th><th>CA</th><th>CAc</th><th>IEP</th><th>GMD</th><th>Peso Médio</th><th>Mort. %</th><th>Volume Abatido</th></tr>";
  var body = allRank.map(function(r){
    var g = r.g;
    return "<tr><td><b>"+NZ.esc(r.label)+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("lnTable").innerHTML = head + body;
  NZ.makeSortable("lnTable", {defaultCol:1, defaultDir:"desc"});
}

NZ.RENDERERS.linhagem = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var initialized = false;
var state = {row:"tecnico", col:"nenhum", metric:"ca", agg:"auto"};
var lastCsv = null;

var ROW_DIM_KEYS = ["tecnico","regiao","aviario","linhagem","tomazini","familia","ano","mes","dia","anomes","proprietario","granja","galpaoesp"];
var COL_DIM_KEYS = ["nenhum","tecnico","regiao","aviario","linhagem","tomazini","familia","ano","mes"];

function populateControls(){
  var rowSel = document.getElementById("pvRowSelect");
  rowSel.innerHTML = ROW_DIM_KEYS.map(function(k){ return '<option value="'+k+'">'+NZ.esc(NZ.DIMENSIONS[k].label)+'</option>'; }).join("");
  rowSel.value = state.row;

  var colSel = document.getElementById("pvColSelect");
  colSel.innerHTML = COL_DIM_KEYS.map(function(k){ return '<option value="'+k+'">'+NZ.esc(NZ.DIMENSIONS[k].label)+'</option>'; }).join("");
  colSel.value = state.col;

  var metSel = document.getElementById("pvMetricSelect");
  metSel.innerHTML =
    '<optgroup label="Zootécnicos">'+NZ.METRIC_ORDER.map(function(k){ return '<option value="'+k+'">'+NZ.esc(NZ.METRICS[k].label)+'</option>'; }).join("")+'</optgroup>'+
    '<optgroup label="Econômicos">'+NZ.ECON_METRIC_ORDER.filter(function(k){return k!=="ar"&&k!=="pt";}).map(function(k){ return '<option value="'+k+'">'+NZ.esc(NZ.METRICS[k].label)+'</option>'; }).join("")+'</optgroup>';
  metSel.value = state.metric;

  document.getElementById("pvAggSelect").value = state.agg;

  rowSel.addEventListener("change", function(){ state.row = rowSel.value; render(); });
  colSel.addEventListener("change", function(){ state.col = colSel.value; render(); });
  metSel.addEventListener("change", function(){ state.metric = metSel.value; render(); });
  document.getElementById("pvAggSelect").addEventListener("change", function(e){ state.agg = e.target.value; render(); });
  document.getElementById("pvExportBtn").addEventListener("click", exportCsv);
}

function naturalSortDim(dimKey){
  var d = NZ.DIMENSIONS[dimKey];
  return d.type === "num" || d.type === "month" || d.type === "anomes" || d.type === "bool";
}

function sortKeys(keys, dimKey, rowsMap, metricKey){
  if (naturalSortDim(dimKey)){
    return keys.slice().sort(function(a,b){
      if (dimKey === "anomes") return a < b ? -1 : (a > b ? 1 : 0);
      return a - b;
    });
  }
  var m = NZ.METRICS[metricKey];
  return keys.slice().sort(function(a,b){
    var va = NZ.aggregate(rowsMap.get(a), metricKey);
    var vb = NZ.aggregate(rowsMap.get(b), metricKey);
    if (va==null) return 1; if (vb==null) return -1;
    return m.good === "down" ? va-vb : vb-va;
  });
}

function aggWithMode(rows, metricKey, mode){
  if (mode === "auto") return NZ.aggregate(rows, metricKey);
  return NZ.aggregate(rows, metricKey, mode);
}

function render(){
  if (!initialized){ populateControls(); initialized = true; }
  var rows = NZ.FILTERED;
  var rowDim = state.row, colDim = state.col, metric = state.metric, aggMode = state.agg;
  var m = NZ.METRICS[metric];

  var rowMapAll = NZ.groupByDim(rows, rowDim);
  var rowKeys = sortKeys(Array.from(rowMapAll.keys()), rowDim, rowMapAll, metric);

  var tableEl = document.getElementById("pivotTable");
  var csvRows = [];

  if (colDim === "nenhum"){
    var head = "<tr><th>"+NZ.esc(NZ.DIMENSIONS[rowDim].label)+"</th><th>Lotes</th><th>"+NZ.esc(m.label)+"</th></tr>";
    csvRows.push([NZ.DIMENSIONS[rowDim].label, "Lotes", m.label]);
    var body = rowKeys.map(function(k){
      var g = rowMapAll.get(k);
      var v = aggWithMode(g, metric, aggMode);
      var label = NZ.dimLabelFor(rowDim, k);
      csvRows.push([label, g.length, v!=null ? v.toFixed(m.dec) : ""]);
      return "<tr><td><b>"+NZ.esc(label)+"</b></td><td class='num'>"+g.length.toLocaleString("pt-BR")+"</td><td class='num'>"+NZ.fmtMetric(v, metric)+"</td></tr>";
    }).join("");
    var totalV = aggWithMode(rows, metric, aggMode);
    csvRows.push(["TOTAL", rows.length, totalV!=null ? totalV.toFixed(m.dec) : ""]);
    var totalRow = "<tr style='font-weight:800;background:#FBF2E2;'><td>Total</td><td class='num'>"+rows.length.toLocaleString("pt-BR")+"</td><td class='num'>"+NZ.fmtMetric(totalV, metric)+"</td></tr>";
    tableEl.innerHTML = head + body + totalRow;
    NZ.makeSortable("pivotTable");
  } else {
    var colMapAll = NZ.groupByDim(rows, colDim);
    var colKeys = sortKeys(Array.from(colMapAll.keys()), colDim, colMapAll, metric);
    if (colKeys.length > 30) colKeys = colKeys.slice(0, 30); // guard against runaway column count

    var head2 = "<tr><th>"+NZ.esc(NZ.DIMENSIONS[rowDim].label)+"</th>"+
      colKeys.map(function(ck){ return "<th style='text-align:right'>"+NZ.esc(NZ.dimLabelFor(colDim, ck))+"</th>"; }).join("")+
      "<th style='text-align:right'>Total</th></tr>";
    csvRows.push([NZ.DIMENSIONS[rowDim].label].concat(colKeys.map(function(ck){return NZ.dimLabelFor(colDim,ck);})).concat(["Total"]));

    var body2 = rowKeys.map(function(rk){
      var rowRows = rowMapAll.get(rk);
      var cells = colKeys.map(function(ck){
        var sub = rowRows.filter(function(r){ return NZ.dimKeyForRow(colDim, r) === ck; });
        var v = sub.length ? aggWithMode(sub, metric, aggMode) : null;
        return v;
      });
      var rowTotal = aggWithMode(rowRows, metric, aggMode);
      var label = NZ.dimLabelFor(rowDim, rk);
      csvRows.push([label].concat(cells.map(function(v){return v!=null?v.toFixed(m.dec):"";})).concat([rowTotal!=null?rowTotal.toFixed(m.dec):""]));
      return "<tr><td><b>"+NZ.esc(label)+"</b></td>"+
        cells.map(function(v){ return "<td class='num'>"+(v!=null?NZ.fmtNum(v,m.dec):"&ndash;")+"</td>"; }).join("")+
        "<td class='num' style='font-weight:700;'>"+NZ.fmtNum(rowTotal,m.dec)+"</td></tr>";
    }).join("");

    var totalCells = colKeys.map(function(ck){
      var sub = rows.filter(function(r){ return NZ.dimKeyForRow(colDim, r) === ck; });
      return sub.length ? aggWithMode(sub, metric, aggMode) : null;
    });
    var grandTotal = aggWithMode(rows, metric, aggMode);
    csvRows.push(["Total"].concat(totalCells.map(function(v){return v!=null?v.toFixed(m.dec):"";})).concat([grandTotal!=null?grandTotal.toFixed(m.dec):""]));
    var totalRow2 = "<tr style='font-weight:800;background:#FBF2E2;'><td>Total</td>"+
      totalCells.map(function(v){ return "<td class='num'>"+(v!=null?NZ.fmtNum(v,m.dec):"&ndash;")+"</td>"; }).join("")+
      "<td class='num'>"+NZ.fmtNum(grandTotal,m.dec)+"</td></tr>";

    tableEl.innerHTML = head2 + body2 + totalRow2;
    NZ.makeSortable("pivotTable");
  }
  lastCsv = csvRows;
}

function exportCsv(){
  if (!lastCsv) return;
  var csv = lastCsv.map(function(row){
    return row.map(function(cell){
      var s = String(cell==null?"":cell);
      if (s.indexOf(",")>-1 || s.indexOf('"')>-1){ s = '"'+s.replace(/"/g,'""')+'"'; }
      return s;
    }).join(",");
  }).join("\n");
  var blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url; a.download = "nutriza_pivot_"+state.row+"_"+state.metric+".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

NZ.RENDERERS.pivot = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

function byMonth(rows, metricKey){
  var out = [];
  for (var mm=1; mm<=12; mm++){
    var g = rows.filter(function(r){ return r[NZ.COL.ME]===mm; });
    out.push(g.length ? NZ.aggregate(g, metricKey) : null);
  }
  return out;
}

function render(){
  var rows = NZ.FILTERED;

  var ca = byMonth(rows, "ca");
  var mo = byMonth(rows, "mo");
  NZ.makeChart("climMonthChart", {
    type:"line",
    data:{labels:NZ.MESES_PT, datasets:[
      Object.assign(NZ.baseLineDataset("CA", ca, NZ.colorForIndex(0), {yAxisID:"y"})),
      Object.assign(NZ.baseLineDataset("Mortalidade (%)", mo, NZ.colorForIndex(1), {yAxisID:"y1"}))
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{grid:{display:false}},
        y:{position:"left", grid:{color:NZ.GRID_COLOR}, title:{display:true,text:"CA",font:{size:10}}},
        y1:{position:"right", grid:{display:false}, title:{display:true,text:"Mortalidade (%)",font:{size:10}}}
      },
      plugins:NZ.commonPlugins()}
  });

  var gmd = byMonth(rows, "gmd");
  var pm = byMonth(rows, "pm");
  NZ.makeChart("climMonthChart2", {
    type:"line",
    data:{labels:NZ.MESES_PT, datasets:[
      NZ.baseLineDataset("GMD (g)", gmd, NZ.colorForIndex(4), {yAxisID:"y"}),
      NZ.baseLineDataset("Peso Médio (kg)", pm, NZ.colorForIndex(5), {yAxisID:"y1"})
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{grid:{display:false}},
        y:{position:"left", grid:{color:NZ.GRID_COLOR}, title:{display:true,text:"GMD (g)",font:{size:10}}},
        y1:{position:"right", grid:{display:false}, title:{display:true,text:"Peso Médio (kg)",font:{size:10}}}
      },
      plugins:NZ.commonPlugins()}
  });

  // Convencional vs climatizados (Dark/Blue/Semi Dark) by month
  var convIdx = NZ.LK.tg.indexOf("Convencional");
  var conv = rows.filter(function(r){ return r[NZ.COL.TG]===convIdx; });
  var clim = rows.filter(function(r){ return r[NZ.COL.TG]!==convIdx; });
  var caConv = byMonth(conv, "ca");
  var caClim = byMonth(clim, "ca");
  NZ.makeChart("climAviarioChart", {
    type:"line",
    data:{labels:NZ.MESES_PT, datasets:[
      NZ.baseLineDataset("Convencional", caConv, "#8B5E3C"),
      NZ.baseLineDataset("Climatizados (Dark/Blue/Semi Dark)", caClim, "#2C6E7F")
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins()}
  });

  // Table
  var head = "<tr><th>Mês</th><th>Lotes</th><th>CA</th><th>Mortalidade %</th><th>GMD</th><th>Peso Médio</th><th>CA Convencional</th><th>CA Climatizado</th></tr>";
  var body = "";
  for (var mm=1; mm<=12; mm++){
    var g = rows.filter(function(r){ return r[NZ.COL.ME]===mm; });
    var gc = conv.filter(function(r){ return r[NZ.COL.ME]===mm; });
    var gk = clim.filter(function(r){ return r[NZ.COL.ME]===mm; });
    body += "<tr><td><b>"+NZ.MESES_PT_FULL[mm-1]+"</b></td><td class='num'>"+g.length+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
      "<td class='num'>"+(gc.length?NZ.fmtNum(NZ.aggregate(gc,"ca"),3):"&ndash;")+"</td>"+
      "<td class='num'>"+(gk.length?NZ.fmtNum(NZ.aggregate(gk,"ca"),3):"&ndash;")+"</td></tr>";
  }
  document.getElementById("climTable").innerHTML = head + body;
  NZ.makeSortable("climTable");
}

NZ.RENDERERS.clima = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "ca";
var initialized = false;
var FULL_YEARS = [2020,2021,2022,2023,2024,2025];
var FUTURE_YEARS = [2027,2028,2029,2030];
var ALL_LABELS = [2020,2021,2022,2023,2024,2025,2026,2027,2028,2029,2030];

function populateSelect(){
  var sel = document.getElementById("projMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; render(); });
}

function projectMetric(rows, metricKey){
  var byYear = NZ.groupByDim(rows, "ano");
  var xs = [], ys = [];
  FULL_YEARS.forEach(function(y){
    var g = byYear.get(y);
    if (g && g.length){ xs.push(y); ys.push(NZ.aggregate(g, metricKey)); }
  });
  var reg = NZ.linearRegression(xs, ys);
  var actual2026 = byYear.get(2026) && byYear.get(2026).length ? NZ.aggregate(byYear.get(2026), metricKey) : null;
  var actualByYear = {};
  FULL_YEARS.concat([2026]).forEach(function(y){
    var g = byYear.get(y);
    actualByYear[y] = g && g.length ? NZ.aggregate(g, metricKey) : null;
  });
  return {reg:reg, actual2026:actual2026, actualByYear:actualByYear, fitYears:xs};
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  var rows = NZ.FILTERED;
  var m = NZ.METRICS[selectedMetric];
  var proj = projectMetric(rows, selectedMetric);
  var reg = proj.reg;

  document.getElementById("projChartSub").textContent =
    "Tendência: " + (reg.slope<0?"queda":"alta") + " média de " + NZ.fmtNum(Math.abs(reg.slope), m.dec+1) + " " + (m.unit||"pts") + "/ano (regressão sobre 2020\u20132025)";

  var realData = ALL_LABELS.map(function(y){
    if (y <= 2026) return proj.actualByYear[y] != null ? proj.actualByYear[y] : null;
    return null;
  });
  var projData = ALL_LABELS.map(function(y){
    if (y < 2025) return null;
    if (y === 2025) return proj.actualByYear[2025];
    return reg.predict(y);
  });

  NZ.makeChart("projChart", {
    type:"line",
    data:{labels:ALL_LABELS.map(String), datasets:[
      Object.assign(NZ.baseLineDataset("Real", realData, NZ.colorForIndex(0)), {
        pointBackgroundColor: ALL_LABELS.map(function(y){ return y===2026 ? "#F5B93C" : NZ.colorForIndex(0); }),
        pointRadius: ALL_LABELS.map(function(y){ return y===2026 ? 6 : 3; })
      }),
      Object.assign(NZ.baseLineDataset("Projeção (tendência linear)", projData, NZ.colorForIndex(1)), {borderDash:[6,4], pointRadius:3})
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(),
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){
        return ctx.dataset.label+": "+NZ.fmtMetric(ctx.parsed.y, selectedMetric);
      }}}})}
  });

  // Table with all metrics projected
  var head = "<tr><th>Indicador</th><th>2025 (real)</th><th>2026 (parcial, real)</th><th>2027 (proj.)</th><th>2028 (proj.)</th><th>2029 (proj.)</th><th>2030 (proj.)</th><th>Tendência/ano</th></tr>";
  var body = NZ.METRIC_ORDER.filter(function(mk){ return mk!=="ar" && mk!=="rc" && mk!=="pt"; }).map(function(mk){
    var mm = NZ.METRICS[mk];
    var p = projectMetric(rows, mk);
    var r2025 = p.actualByYear[2025];
    var r2026 = p.actualByYear[2026];
    var cells = FUTURE_YEARS.map(function(y){ return NZ.fmtNum(p.reg.predict(y), mm.dec); }).join("</td><td class='num'>");
    var trendTxt = (p.reg.slope>=0?"+":"") + NZ.fmtNum(p.reg.slope, mm.dec+2) + "/ano";
    return "<tr><td><b>"+NZ.esc(mm.label)+"</b></td>"+
      "<td class='num'>"+NZ.fmtNum(r2025, mm.dec)+"</td>"+
      "<td class='num'>"+(r2026!=null?NZ.fmtNum(r2026, mm.dec):"&ndash;")+"</td>"+
      "<td class='num'>"+cells+"</td>"+
      "<td class='num'>"+trendTxt+"</td></tr>";
  }).join("");
  document.getElementById("projTable").innerHTML = head + body;
  NZ.makeSortable("projTable");
}

NZ.RENDERERS.projecoes = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var initialized = false;

var els = {};
function grabEls(){
  ["simPtRange","simPtNum","simPtVal","simCaAtualRange","simCaAtualVal","simCaMetaRange","simCaMetaVal",
   "simPrecoRange","simPrecoNum","simPrecoVal","simResultReais","simResultTon","simResultMes","simResultPct","simResultRacaoNova"
  ].forEach(function(id){ els[id] = document.getElementById(id); });
}

function computeDefaults(){
  var rows = NZ.FILTERED;
  var byYear = NZ.groupByDim(rows, "ano");
  var years = Array.from(byYear.keys()).sort(function(a,b){return b-a;});
  var lastFullYear = years.find(function(y){ return y !== 2026; }) || years[0];
  var g = byYear.get(lastFullYear) || rows;
  var ptTon = Math.round((NZ.aggregate(g, "pt", "sum") || 300000000)/1000);
  var caAtual = NZ.aggregate(g, "ca") || 1.55;
  return {ptTon: ptTon, caAtual: Math.round(caAtual*1000)/1000, lastFullYear: lastFullYear};
}

function recalc(){
  var ptTon = parseFloat(els.simPtRange.value);
  var caAtual = parseFloat(els.simCaAtualRange.value);
  var caMeta = parseFloat(els.simCaMetaRange.value);
  var preco = parseFloat(els.simPrecoRange.value);

  els.simPtVal.textContent = Math.round(ptTon).toLocaleString("pt-BR")+" t";
  els.simPtNum.value = Math.round(ptTon);
  els.simCaAtualVal.textContent = caAtual.toFixed(3);
  els.simCaMetaVal.textContent = caMeta.toFixed(3);
  els.simPrecoVal.textContent = "R$ "+Math.round(preco).toLocaleString("pt-BR");
  els.simPrecoNum.value = Math.round(preco);

  var racaoAtualTon = ptTon * caAtual;
  var racaoMetaTon = ptTon * caMeta;
  var economiaTon = racaoAtualTon - racaoMetaTon;
  var economiaReais = economiaTon * preco;
  var pct = racaoAtualTon ? (economiaTon/racaoAtualTon*100) : 0;

  els.simResultReais.textContent = NZ.fmtBRL(economiaReais);
  els.simResultTon.textContent = Math.round(economiaTon).toLocaleString("pt-BR")+" t";
  els.simResultMes.textContent = NZ.fmtBRL(economiaReais/12);
  els.simResultPct.textContent = pct.toFixed(1)+"%";
  els.simResultRacaoNova.textContent = Math.round(racaoMetaTon).toLocaleString("pt-BR")+" t";

  NZ.makeChart("simChart", {
    type:"bar",
    data:{labels:["Ração consumida"], datasets:[
      {label:"Cenário atual (CA "+caAtual.toFixed(3)+")", data:[Math.round(racaoAtualTon)], backgroundColor:"#DC3223", borderRadius:6, maxBarThickness:70},
      {label:"Cenário simulado (CA "+caMeta.toFixed(3)+")", data:[Math.round(racaoMetaTon)], backgroundColor:"#4C7A3D", borderRadius:6, maxBarThickness:70}
    ]},
    options:{indexAxis:"y", responsive:true, maintainAspectRatio:false,
      scales:{x:{grid:{color:NZ.GRID_COLOR}, title:{display:true,text:"toneladas de ração/ano"}}, y:{grid:{display:false}}},
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){ return ctx.dataset.label+": "+Math.round(ctx.parsed.x).toLocaleString("pt-BR")+" t"; }}}})
    }
  });
}

function setupOnce(){
  grabEls();
  els.simPtRange.addEventListener("input", function(){ els.simPtNum.value = els.simPtRange.value; recalc(); });
  els.simPtNum.addEventListener("input", function(){
    var v = Math.max(parseFloat(els.simPtRange.min), Math.min(parseFloat(els.simPtRange.max), parseFloat(els.simPtNum.value)||0));
    els.simPtRange.value = v; recalc();
  });
  els.simCaAtualRange.addEventListener("input", recalc);
  els.simCaMetaRange.addEventListener("input", recalc);
  els.simPrecoRange.addEventListener("input", function(){ els.simPrecoNum.value = els.simPrecoRange.value; recalc(); });
  els.simPrecoNum.addEventListener("input", function(){
    var v = Math.max(parseFloat(els.simPrecoRange.min), Math.min(parseFloat(els.simPrecoRange.max), parseFloat(els.simPrecoNum.value)||0));
    els.simPrecoRange.value = v; recalc();
  });
}

function render(){
  if (!initialized){ setupOnce(); initialized = true; els.simPrecoRange.value = 1800; els.simPrecoNum.value = 1800; }
  var d = computeDefaults();
  els.simPtRange.value = d.ptTon;
  els.simPtNum.value = d.ptTon;
  els.simCaAtualRange.value = d.caAtual;
  var metaDefault = Math.max(parseFloat(els.simCaMetaRange.min), Math.round((d.caAtual-0.02)*1000)/1000);
  els.simCaMetaRange.value = metaDefault;
  recalc();
}

NZ.RENDERERS.simulador = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

/* ============================================================
   Lazy script loader (avoids loading xlsx/mammoth/pdf.js upfront)
   ============================================================ */
var LOADED_SCRIPTS = {};
function loadScriptOnce(url){
  if (LOADED_SCRIPTS[url]) return LOADED_SCRIPTS[url];
  LOADED_SCRIPTS[url] = new Promise(function(resolve, reject){
    var s = document.createElement("script");
    s.src = url;
    s.onload = function(){ resolve(); };
    s.onerror = function(){ reject(new Error("Falha ao carregar biblioteca: "+url)); };
    document.head.appendChild(s);
  });
  return LOADED_SCRIPTS[url];
}
var CDN = {
  xlsx: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js",
  mammoth: "https://cdn.jsdelivr.net/npm/mammoth@1.12.0/mammoth.browser.min.js",
  pdf: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
  pdfWorker: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js"
};

/* ============================================================
   Field alias mapping (mirrors extract.py logic, done client-side)
   ============================================================ */
function normHeader(s){
  return String(s==null?"":s).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[."']/g,"")
    .replace(/\s+/g," ").trim();
}
var FIELD_ALIASES = {
  tecnico: ["tecnico"],
  regiao: ["regiao"],
  tipogalpao: ["tipo galpao","aviario","tipo de aviario","tipo aviario"],
  linhagem: ["linhagem"],
  proprietario: ["proprietario","granja"],
  situacao: ["situacao"],
  idadec: ["idade c","idadec","idade corrigida"],
  idade: ["idade","idade abate","idade de abate"],
  mort: ["mort","mortalidade"],
  viab: ["viab real","viabilidade","viab"],
  gmd: ["gmd"],
  pesomedio: ["peso medio"],
  ca: ["ca","conversao alimentar"],
  cac: ["cac","ca corrigida","ca corrigido"],
  iep: ["iep"],
  iepc: ["iepc","iep corrigido"],
  racao: ["racao entregue","consumo de racao","racao"],
  densaloj: ["dens aloj","densidade alojamento","aves/m2","aves por m2","aves m2"],
  denskg: ["dens kg","densidade kg","kg/m2","kg por m2","kg m2"],
  avesalojadas: ["aves alojadas"],
  avesrecebidas: ["aves recebidas","volume abatido"],
  pesototal: ["peso total","kg de aves abatidas","kg abatido"],
  dataabate: ["data abate"],
  ano: ["ano"],
  mes: ["mes"],
  resultadoliquido: ["resultado liquido lote","resultado liquido","pagamento integrado","valor pago integrado"],
  resultadobruto: ["resultado bruto"],
  descapanha: ["desc apanha","desconto apanha","apanha"],
  pagtransporte: ["pagamento transporte","transporte"],
  precofrango: ["preco frango","preco do frango"],
  granja: ["granja"],
  galpaoesp: ["galpao","galpao especifico","barracao"]
};
function detectFieldColumns(headerRow){
  var found = {};
  (headerRow||[]).forEach(function(h, idx){
    var nh = normHeader(h);
    if (!nh) return;
    Object.keys(FIELD_ALIASES).forEach(function(field){
      if (found[field]!=null) return;
      if (FIELD_ALIASES[field].indexOf(nh) > -1) found[field] = idx;
    });
  });
  return found;
}

function parseNum(v){
  if (v==null || v==="") return null;
  if (typeof v === "number") return isFinite(v) ? v : null;
  var s = String(v).trim();
  if (!s || s==="-" || s==="\u2013") return null;
  var hasComma = s.indexOf(",")>-1, hasDot = s.indexOf(".")>-1;
  if (hasComma && hasDot){
    if (s.lastIndexOf(",") > s.lastIndexOf(".")){ s = s.replace(/\./g,"").replace(",","."); }
    else { s = s.replace(/,/g,""); }
  } else if (hasComma){ s = s.replace(",","."); }
  s = s.replace(/[^\d.\-]/g,"");
  var n = parseFloat(s);
  return isNaN(n) ? null : n;
}
function parseDateFlexible(v){
  if (v==null || v==="") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number"){
    var epoch = Date.UTC(1899,11,30);
    return new Date(epoch + v*86400000);
  }
  var s = String(v).trim();
  var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m){ var dd=+m[1], mm=+m[2], yy=+m[3]; if (yy<100) yy+=2000; return new Date(Date.UTC(yy, mm-1, dd)); }
  var m2 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m2){ return new Date(Date.UTC(+m2[1], +m2[2]-1, +m2[3])); }
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
function normalizeRegiaoStr(s){
  var su = s.toUpperCase();
  if (su === "URUTAI") return "URUTAÍ";
  if (su.indexOf("RODOVIA GO 020") > -1) return "RODOVIA GO 020, KM 152 (ZONA RURAL)";
  return s;
}
function getOrAddLookup(lookups, lkKey, value){
  var arr = lookups[lkKey];
  var lower = value.toLowerCase();
  for (var i=0;i<arr.length;i++){ if (arr[i].toLowerCase()===lower) return i; }
  arr.push(value);
  return arr.length-1;
}

/* Convert an array-of-arrays table into row records in the dashboard's internal format.
   `lookups` is a MUTABLE WORKING COPY (not the live NZ.LK) so previews never touch live state. */
function buildRowsFromAoa(aoa, sourceLabel, lookups){
  var report = {sourceLabel:sourceLabel, totalRows:0, validRows:0, skipped:0, matchedFields:[], sampleRows:[], warnings:[]};
  if (!aoa || aoa.length<2){
    report.warnings.push("Não foi possível identificar linhas de dados neste arquivo.");
    return {mappedRows:[], report:report};
  }
  var bestHeaderIdx = 0, bestMatchCount = -1, bestFound = {};
  for (var hi=0; hi<Math.min(5, aoa.length); hi++){
    var found = detectFieldColumns(aoa[hi]);
    var cnt = Object.keys(found).length;
    if (cnt > bestMatchCount){ bestMatchCount = cnt; bestHeaderIdx = hi; bestFound = found; }
  }
  report.matchedFields = Object.keys(bestFound);
  if (bestMatchCount < 3){
    report.warnings.push("Poucas colunas reconhecidas ("+bestMatchCount+"). Verifique se o arquivo tem cabeçalhos como Técnico, Região, CA, IEP, Peso Médio etc.");
  }

  var dataRows = aoa.slice(bestHeaderIdx+1);
  report.totalRows = dataRows.length;
  var mappedRows = [];

  dataRows.forEach(function(row){
    if (!row || row.every(function(c){ return c==null || String(c).trim()===""; })){ report.skipped++; return; }
    var get = function(field){ return bestFound[field]!=null ? row[bestFound[field]] : null; };

    var situ = get("situacao");
    if (situ && /aberto|open/i.test(String(situ))){ report.skipped++; return; }

    var ca = parseNum(get("ca"));
    var iep = parseNum(get("iep"));
    if (ca==null && iep==null){ report.skipped++; return; }

    var dataAbate = parseDateFlexible(get("dataabate"));
    var anoVal = parseNum(get("ano"));
    var mesVal = parseNum(get("mes"));
    var an, me;
    if (anoVal){ an = Math.round(anoVal); me = mesVal ? Math.round(mesVal) : (dataAbate ? dataAbate.getUTCMonth()+1 : 1); }
    else if (dataAbate){ an = dataAbate.getUTCFullYear(); me = dataAbate.getUTCMonth()+1; }
    else { report.skipped++; return; }
    if (an < 2015 || an > 2035){ report.skipped++; return; }

    var tecnicoName = (get("tecnico")==null ? "" : String(get("tecnico")).trim()) || "Não informado (importado)";
    var regiaoRaw = (get("regiao")==null ? "" : String(get("regiao")).trim());
    var regiaoName = regiaoRaw ? normalizeRegiaoStr(regiaoRaw) : "Não informado";
    var tipoRaw = (get("tipogalpao")==null ? "" : String(get("tipogalpao")).trim());
    var tipoName = tipoRaw || "Não informado (importado)";
    var linhagemRaw = get("linhagem");
    var linhagemName = linhagemRaw ? String(linhagemRaw).trim() : null;
    var propName = (get("proprietario")==null ? "" : String(get("proprietario")).trim());

    var tc = getOrAddLookup(lookups, "tc", tecnicoName);
    var rg = regiaoName === "Não informado" ? -1 : getOrAddLookup(lookups, "rg", regiaoName);
    var tg = getOrAddLookup(lookups, "tg", tipoName);
    var ln = linhagemName ? getOrAddLookup(lookups, "ln", linhagemName) : -1;
    var pr = propName ? getOrAddLookup(lookups, "pr", propName) : -1;
    var tm = /tomazini/i.test(propName) ? 1 : 0;

    var idc = parseNum(get("idadec"));
    var idd = parseNum(get("idade"));
    var mo = parseNum(get("mort"));
    var vb = parseNum(get("viab"));
    var gmd = parseNum(get("gmd"));
    var pm = parseNum(get("pesomedio"));
    var cac = parseNum(get("cac"));
    var rc = parseNum(get("racao"));
    var dka = parseNum(get("densaloj"));
    var dkg = parseNum(get("denskg"));
    var al = parseNum(get("avesalojadas"));
    var ar = parseNum(get("avesrecebidas"));
    var pt = parseNum(get("pesototal"));
    var rl = parseNum(get("resultadoliquido"));
    var rb = parseNum(get("resultadobruto"));
    var da = parseNum(get("descapanha"));
    var tr = parseNum(get("pagtransporte"));
    var pf = parseNum(get("precofrango"));
    var dia = dataAbate ? dataAbate.getUTCDate() : null;
    var granjaName = (get("granja")==null ? "" : String(get("granja")).trim());
    var galpaoName = (get("galpaoesp")==null ? "" : String(get("galpaoesp")).trim());
    var gr = granjaName ? getOrAddLookup(lookups, "gr", granjaName) : -1;
    var gj = galpaoName ? getOrAddLookup(lookups, "gj", galpaoName) : -1;

    var iepFinal = iep;
    if (iepFinal==null && vb!=null && pm!=null && idd && ca){ iepFinal = (vb*pm*100)/(idd*ca); }
    var iepc = parseNum(get("iepc"));
    if (iepc==null && vb!=null && pm!=null && (idc||idd) && (cac||ca)){
      var useIdade = idc!=null ? idc : idd;
      var useCa = cac!=null ? cac : ca;
      iepc = (vb * pm * 100) / (useIdade * useCa);
    }

    mappedRows.push([an, me, tc, rg, tg, ln, tm, idc, idd, mo, vb, gmd, pm, ca, cac, iepFinal, iepc, dka, dkg, rc, al, ar, pt, pr, rl, rb, da, tr, pf, dia, gj, gr]);
  });

  report.validRows = mappedRows.length;
  report.sampleRows = mappedRows.slice(0,5);
  return {mappedRows: mappedRows, report: report};
}

/* ============================================================
   Per-format file -> array-of-arrays parsers
   ============================================================ */
function splitDelimitedLine(line, delim){
  var out = [], cur = "", inQ = false;
  for (var i=0;i<line.length;i++){
    var c = line[i];
    if (c === '"'){ inQ = !inQ; continue; }
    if (c === delim && !inQ){ out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out.map(function(s){ return s.trim(); });
}
function parseDelimitedText(text){
  var lines = text.split(/\r?\n/).filter(function(l){ return l.trim().length>0; });
  if (!lines.length) return {aoa:[]};
  var firstLine = lines[0];
  var counts = {",": (firstLine.match(/,/g)||[]).length, ";": (firstLine.match(/;/g)||[]).length, "\t": (firstLine.match(/\t/g)||[]).length};
  var delim = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; })[0];
  if (counts[delim]===0) delim = ",";
  var aoa = lines.map(function(line){ return splitDelimitedLine(line, delim); });
  return {aoa: aoa};
}

function parseExcelFile(file){
  return loadScriptOnce(CDN.xlsx).then(function(){
    return file.arrayBuffer();
  }).then(function(buf){
    var wb = XLSX.read(buf, {type:"array", cellDates:true});
    var sheetName = wb.SheetNames.find(function(n){ return /dados/i.test(n); }) || wb.SheetNames[0];
    var ws = wb.Sheets[sheetName];
    var aoa = XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null});
    return {aoa: aoa, extra: "planilha \u201c"+sheetName+"\u201d de "+wb.SheetNames.length+" aba(s)"};
  });
}
function parseTextFile(file){
  return file.text().then(function(text){
    return parseDelimitedText(text);
  });
}
function parseDocxFile(file){
  return loadScriptOnce(CDN.mammoth).then(function(){
    return file.arrayBuffer();
  }).then(function(buf){
    return mammoth.convertToHtml({arrayBuffer: buf}).then(function(result){
      var doc = new DOMParser().parseFromString(result.value, "text/html");
      var table = doc.querySelector("table");
      if (table){
        var aoa = Array.from(table.querySelectorAll("tr")).map(function(tr){
          return Array.from(tr.querySelectorAll("td,th")).map(function(td){ return td.textContent.trim(); });
        });
        return {aoa: aoa, extra: "tabela encontrada no documento Word"};
      }
      var text = doc.body.textContent || "";
      var res = parseDelimitedText(text);
      res.extra = "nenhuma tabela HTML encontrada \u2014 tentativa por texto simples";
      return res;
    });
  });
}
function parsePdfFile(file){
  return loadScriptOnce(CDN.pdf).then(function(){
    if (window.pdfjsLib && !pdfjsLib.GlobalWorkerOptions.workerSrc){
      pdfjsLib.GlobalWorkerOptions.workerSrc = CDN.pdfWorker;
    }
    return file.arrayBuffer();
  }).then(function(buf){
    return pdfjsLib.getDocument({data: buf}).promise.then(function(pdf){
      var pagePromises = [];
      for (var i=1;i<=pdf.numPages;i++){
        pagePromises.push((function(pageNum){
          return pdf.getPage(pageNum).then(function(page){
            return page.getTextContent().then(function(tc){
              var byY = {};
              tc.items.forEach(function(it){
                if (!it.str || !it.str.trim()) return;
                var y = Math.round(it.transform[5]/3)*3;
                if (!byY[y]) byY[y] = [];
                byY[y].push({x: it.transform[4], text: it.str});
              });
              var ys = Object.keys(byY).map(Number).sort(function(a,b){ return b-a; });
              return ys.map(function(y){ return byY[y].sort(function(a,b){ return a.x-b.x; }); });
            });
          });
        })(i));
      }
      return Promise.all(pagePromises).then(function(pagesLines){
        var allLines = [].concat.apply([], pagesLines).filter(function(l){ return l.length; });

        // ---- Cluster X start-positions across the WHOLE document into consistent column slots ----
        var allX = [];
        allLines.forEach(function(items){ items.forEach(function(it){ allX.push(it.x); }); });
        allX.sort(function(a,b){ return a-b; });
        var clusters = [];
        allX.forEach(function(x){
          var last = clusters[clusters.length-1];
          if (last && (x - last.max) < 18){ last.max = x; last.sum += x; last.n++; }
          else { clusters.push({min:x, max:x, sum:x, n:1}); }
        });
        var centers = clusters.map(function(c){ return c.sum/c.n; });

        function colIndexFor(x){
          var best = 0, bestDist = Infinity;
          for (var i=0;i<centers.length;i++){
            var d = Math.abs(x-centers[i]);
            if (d < bestDist){ bestDist = d; best = i; }
          }
          return best;
        }

        // ---- Build a consistent array-of-arrays using the shared column slots ----
        // Every row keeps the SAME number of slots (one per detected column center) so the
        // header row and data rows stay positionally aligned even when a cell is blank.
        var aoa = allLines.map(function(items){
          var rowArr = new Array(centers.length).fill("");
          items.forEach(function(it){
            var ci = colIndexFor(it.x);
            rowArr[ci] = rowArr[ci] ? (rowArr[ci]+" "+it.text) : it.text;
          });
          return rowArr.map(function(s){ return s.trim(); });
        });
        // drop columns that are empty across every single row (pure artifacts of clustering)
        var usedCols = centers.map(function(_, ci){ return aoa.some(function(row){ return row[ci] !== ""; }); });
        aoa = aoa.map(function(row){ return row.filter(function(_, ci){ return usedCols[ci]; }); });

        return {aoa: aoa, extra: pdf.numPages+" p\u00e1gina(s) lidas \u2014 colunas reconstru\u00eddas por agrupamento de posi\u00e7\u00e3o X"};
      });
    });
  });
}

function detectParserFor(file){
  var name = file.name.toLowerCase();
  if (/\.(xlsx|xls)$/.test(name)) return {fn:parseExcelFile, label:"Excel"};
  if (/\.docx$/.test(name)) return {fn:parseDocxFile, label:"Word"};
  if (/\.pdf$/.test(name)) return {fn:parsePdfFile, label:"PDF"};
  if (/\.(txt|csv|tsv)$/.test(name)) return {fn:parseTextFile, label:"Texto/CSV"};
  return null;
}

function cloneLookups(){
  return {
    tc: NZ.LK.tc.slice(), rg: NZ.LK.rg.slice(), tg: NZ.LK.tg.slice(),
    ln: NZ.LK.ln.slice(), pr: NZ.LK.pr.slice(), gr: NZ.LK.gr.slice(), gj: NZ.LK.gj.slice()
  };
}

NZ.dataImport = {
  detectParserFor: detectParserFor,
  buildRowsFromAoa: buildRowsFromAoa,
  cloneLookups: cloneLookups
};
})();

(function(){
"use strict";
var NZ = window.__NZ;
var initialized = false;
var PRISTINE = null;
var currentWorking = null;
var dataModified = false;

function snapshotPristineIfNeeded(){
  if (PRISTINE) return;
  PRISTINE = {
    rows: NZ.ROWS.map(function(r){ return r.slice(); }),
    lk: {tc:NZ.LK.tc.slice(), rg:NZ.LK.rg.slice(), tg:NZ.LK.tg.slice(), ln:NZ.LK.ln.slice(), pr:NZ.LK.pr.slice(), gr:NZ.LK.gr.slice(), gj:NZ.LK.gj.slice()},
    meta: JSON.parse(JSON.stringify(NZ.META))
  };
}

function fmtBytes(n){
  if (n<1024) return n+" B";
  if (n<1024*1024) return (n/1024).toFixed(0)+" KB";
  return (n/1024/1024).toFixed(1)+" MB";
}

/* ============================================================
   Session banner + topbar meta
   ============================================================ */
function renderSessionBanner(){
  var el = document.getElementById("importSessionBanner");
  if (!el) return;
  if (!dataModified){ el.innerHTML = ""; return; }
  el.innerHTML = '<div class="session-banner"><span>\u270E <b>Dados atualizados nesta sess\u00e3o.</b> '+
    NZ.ROWS.length.toLocaleString("pt-BR")+' lotes carregados (diferente do arquivo original).</span>'+
    '<button class="btn ghost" id="importRestoreBtn">Restaurar dados originais</button></div>';
  document.getElementById("importRestoreBtn").addEventListener("click", restoreOriginal);
}

function ymToLabel(ym){
  var parts = ym.split("-"); var mIdx = parseInt(parts[1],10)-1;
  return (NZ.MESES_PT[mIdx]||"").toLowerCase()+"/"+parts[0];
}
function updateTopbar(){
  var el = document.getElementById("topbarUpdated");
  if (!el) return;
  var meta = NZ.META;
  var rangeTxt = "";
  if (meta.data_abate_min_ym && meta.data_abate_max_ym){
    rangeTxt = ymToLabel(meta.data_abate_min_ym)+" a "+ymToLabel(meta.data_abate_max_ym);
  } else if (meta.data_abate_min && meta.data_abate_max){
    rangeTxt = meta.data_abate_min.split("-").reverse().join("/")+" a "+meta.data_abate_max.split("-").reverse().join("/");
  }
  el.textContent = "Base Agrosys \u00b7 "+meta.total_lotes.toLocaleString("pt-BR")+" lotes"+(rangeTxt?" \u00b7 "+rangeTxt:"")+(dataModified?" \u00b7 sess\u00e3o atualizada":"");

  var btn = document.getElementById("topbarRefreshBtn");
  if (btn){
    btn.innerHTML = dataModified
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Dados atualizados</span>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg><span>Atualizar dados</span>';
    btn.classList.toggle("is-updated", dataModified);
  }
}

function recomputeMeta(){
  var anosSet = {};
  var minAn=null, maxAn=null, minMe=null, maxMe=null;
  NZ.ROWS.forEach(function(r){
    var an = r[NZ.COL.AN], me = r[NZ.COL.ME];
    anosSet[an] = true;
    if (minAn==null || an<minAn || (an===minAn && me<minMe)){ minAn=an; minMe=me; }
    if (maxAn==null || an>maxAn || (an===maxAn && me>maxMe)){ maxAn=an; maxMe=me; }
  });
  var anos = Object.keys(anosSet).map(Number).sort(function(a,b){return a-b;});
  NZ.META.anos = anos;
  NZ.META.ano_min = anos[0];
  NZ.META.ano_max = anos[anos.length-1];
  NZ.META.total_lotes = NZ.ROWS.length;
  NZ.META.data_abate_min_ym = minAn!=null ? (minAn+"-"+(minMe<10?"0":"")+minMe) : null;
  NZ.META.data_abate_max_ym = maxAn!=null ? (maxAn+"-"+(maxMe<10?"0":"")+maxMe) : null;
}

function finishDataChange(){
  recomputeMeta();
  NZ.resetFiltersToAll();
  NZ.applyFilters();
  NZ.buildFilterBar();
  NZ.markAllDirty();
  NZ.rerenderActive();
  updateTopbar();
  renderSessionBanner();
}

/* Aplica uma nova versão da base vinda da planilha (sincronização automática). */
NZ.applySheetUpdate = function(rawData){
  if (!rawData || !rawData.rows || !rawData.rows.length) return;
  NZ.ROWS.length = 0; Array.prototype.push.apply(NZ.ROWS, rawData.rows);
  ["tc","rg","tg","ln","pr","gr","gj"].forEach(function(k){
    NZ.LK[k].length = 0; Array.prototype.push.apply(NZ.LK[k], rawData.lookups[k] || []);
  });
  Object.keys(rawData.meta).forEach(function(k){ NZ.META[k] = rawData.meta[k]; });
  delete NZ.META.data_abate_min_ym; delete NZ.META.data_abate_max_ym;
  PRISTINE = null; currentWorking = null; dataModified = false;
  var pv = document.getElementById("importPreviewArea"); if (pv) pv.innerHTML = "";
  var st = document.getElementById("importStatusArea"); if (st) st.innerHTML = "";
  finishDataChange();
  var tag = document.getElementById("topbarUpdated");
  if (tag && NZ.META.data_abate_min && NZ.META.data_abate_max){
    tag.textContent = "Base Agrosys \u00b7 " + NZ.META.total_lotes.toLocaleString("pt-BR") + " lotes \u00b7 " +
      NZ.META.data_abate_min.split("-").reverse().join("/") + " a " + NZ.META.data_abate_max.split("-").reverse().join("/");
  }
};

function restoreOriginal(){
  if (!PRISTINE) return;
  NZ.ROWS.length = 0; Array.prototype.push.apply(NZ.ROWS, PRISTINE.rows.map(function(r){ return r.slice(); }));
  ["tc","rg","tg","ln","pr","gr","gj"].forEach(function(k){
    NZ.LK[k].length = 0; Array.prototype.push.apply(NZ.LK[k], PRISTINE.lk[k].slice());
  });
  Object.keys(PRISTINE.meta).forEach(function(k){ NZ.META[k] = PRISTINE.meta[k]; });
  dataModified = false;
  document.getElementById("importPreviewArea").innerHTML = "";
  document.getElementById("importStatusArea").innerHTML = "";
  finishDataChange();
}

/* ============================================================
   Drop zone + file handling
   ============================================================ */
function setupDropZone(){
  var zone = document.getElementById("importDropZone");
  var input = document.getElementById("importFileInput");
  zone.addEventListener("click", function(){ input.click(); });
  input.addEventListener("change", function(){
    if (input.files && input.files[0]) handleFile(input.files[0]);
    input.value = "";
  });
  ["dragenter","dragover"].forEach(function(evt){
    zone.addEventListener(evt, function(e){ e.preventDefault(); e.stopPropagation(); zone.classList.add("dragover"); });
  });
  ["dragleave","drop"].forEach(function(evt){
    zone.addEventListener(evt, function(e){ e.preventDefault(); e.stopPropagation(); zone.classList.remove("dragover"); });
  });
  zone.addEventListener("drop", function(e){
    var files = e.dataTransfer ? e.dataTransfer.files : null;
    if (files && files[0]) handleFile(files[0]);
  });
}

function showStatus(html){ var el = document.getElementById("importStatusArea"); if (el) el.innerHTML = html; }
function statusSpinner(text, sub){
  return '<div class="import-status-card"><div class="import-status-row"><div class="import-spinner"></div>'+
    '<div><div class="import-status-text">'+NZ.esc(text)+'</div><div class="import-status-sub">'+NZ.esc(sub||"")+'</div></div></div></div>';
}
function statusError(text){
  return '<div class="import-status-card"><div class="import-status-row">'+
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC3223" stroke-width="2.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>'+
    '<div><div class="import-status-text" style="color:var(--red-dark);">'+NZ.esc(text)+'</div></div></div></div>';
}

function handleFile(file){
  document.getElementById("importPreviewArea").innerHTML = "";
  var parser = NZ.dataImport.detectParserFor(file);
  if (!parser){
    showStatus(statusError("Formato n\u00e3o suportado. Envie um arquivo .xlsx, .xls, .docx, .pdf, .csv ou .txt."));
    return;
  }
  showStatus(statusSpinner("Analisando "+file.name+"\u2026", "Formato detectado: "+parser.label+" \u00b7 "+fmtBytes(file.size)));

  parser.fn(file).then(function(parsed){
    var workingLookups = NZ.dataImport.cloneLookups();
    var result = NZ.dataImport.buildRowsFromAoa(parsed.aoa, file.name, workingLookups);
    currentWorking = {mappedRows: result.mappedRows, workingLookups: workingLookups, report: result.report,
      fileName: file.name, parserLabel: parser.label, extra: parsed.extra};
    showStatus("");
    renderPreview();
  }).catch(function(err){
    console.error(err);
    showStatus(statusError("N\u00e3o foi poss\u00edvel ler o arquivo \u201c"+file.name+"\u201d: "+err.message));
  });
}

/* ============================================================
   Preview + commit
   ============================================================ */
var FIELD_LABELS = {
  tecnico:"T\u00e9cnico", regiao:"Regi\u00e3o", tipogalpao:"Tipo de Avi\u00e1rio", linhagem:"Linhagem", proprietario:"Propriet\u00e1rio",
  situacao:"Situa\u00e7\u00e3o", idadec:"Idade Corrigida", idade:"Idade", mort:"Mortalidade", viab:"Viabilidade", gmd:"GMD",
  pesomedio:"Peso M\u00e9dio", ca:"CA", cac:"CAc", iep:"IEP", iepc:"IEPc", racao:"Ra\u00e7\u00e3o Entregue",
  densaloj:"Densidade Alojamento", denskg:"Densidade Kg/m\u00b2", avesalojadas:"Aves Alojadas", avesrecebidas:"Aves Recebidas",
  pesototal:"Peso Total", dataabate:"Data Abate", ano:"Ano", mes:"M\u00eas",
  resultadoliquido:"Resultado L\u00edquido", resultadobruto:"Resultado Bruto",
  descapanha:"Desconto de Apanha", pagtransporte:"Pagamento de Transporte", precofrango:"Pre\u00e7o do Frango",
  granja:"Granja", galpaoesp:"Galp\u00e3o"
};
function fieldLabel(f){ return FIELD_LABELS[f] || f; }
function labelFromWorking(arr, idx){ return idx==null || idx<0 ? "N\u00e3o informado" : (arr[idx]||"?"); }

function renderPreview(){
  var cw = currentWorking;
  if (!cw) return;
  var r = cw.report;
  var el = document.getElementById("importPreviewArea");

  var tagsHtml = r.matchedFields.length ?
    r.matchedFields.map(function(f){ return '<span class="import-tag">'+NZ.esc(fieldLabel(f))+'</span>'; }).join("") :
    '<span class="import-tag bad">Nenhuma coluna reconhecida</span>';

  var warnHtml = r.warnings.length ? '<ul class="import-warning-list">'+r.warnings.map(function(w){ return "<li>"+NZ.esc(w)+"</li>"; }).join("")+'</ul>' : "";

  var sampleHtml = "";
  if (cw.mappedRows.length){
    var sampleRows = cw.mappedRows.slice(0,5);
    sampleHtml = '<div class="table-scroll" style="margin-top:12px;"><table class="dtable"><tbody>'+
      "<tr><th>Ano</th><th>M\u00eas</th><th>T\u00e9cnico</th><th>Regi\u00e3o</th><th>Avi\u00e1rio</th><th>Linhagem</th><th>CA</th><th>IEP</th><th>Peso M\u00e9dio</th><th>Mort. %</th></tr>"+
      sampleRows.map(function(row){
        return "<tr>"+
          "<td>"+row[0]+"</td><td>"+row[1]+"</td>"+
          "<td>"+NZ.esc(labelFromWorking(cw.workingLookups.tc, row[2]))+"</td>"+
          "<td>"+NZ.esc(row[3]<0?"N\u00e3o informado":labelFromWorking(cw.workingLookups.rg, row[3]))+"</td>"+
          "<td>"+NZ.esc(labelFromWorking(cw.workingLookups.tg, row[4]))+"</td>"+
          "<td>"+NZ.esc(row[5]<0?"N\u00e3o informado":labelFromWorking(cw.workingLookups.ln, row[5]))+"</td>"+
          "<td class='num'>"+(row[13]!=null?row[13].toFixed(3):"&ndash;")+"</td>"+
          "<td class='num'>"+(row[15]!=null?row[15].toFixed(1):"&ndash;")+"</td>"+
          "<td class='num'>"+(row[12]!=null?row[12].toFixed(3):"&ndash;")+"</td>"+
          "<td class='num'>"+(row[9]!=null?row[9].toFixed(2):"&ndash;")+"</td>"+
        "</tr>";
      }).join("") + "</tbody></table></div>";
  }

  var canCommit = cw.mappedRows.length > 0;

  el.innerHTML =
    '<div class="import-status-card">'+
      '<div class="import-status-text">'+NZ.esc(cw.fileName)+'</div>'+
      '<div class="import-status-sub">'+NZ.esc(cw.parserLabel)+(cw.extra?" \u00b7 "+NZ.esc(cw.extra):"")+'</div>'+
      '<div class="import-stats-grid">'+
        '<div class="import-stat"><div class="import-stat-val">'+r.totalRows.toLocaleString("pt-BR")+'</div><div class="import-stat-lbl">Linhas encontradas</div></div>'+
        '<div class="import-stat"><div class="import-stat-val" style="color:var(--green);">'+r.validRows.toLocaleString("pt-BR")+'</div><div class="import-stat-lbl">Lotes v\u00e1lidos</div></div>'+
        '<div class="import-stat"><div class="import-stat-val" style="color:var(--slate);">'+r.skipped.toLocaleString("pt-BR")+'</div><div class="import-stat-lbl">Linhas ignoradas</div></div>'+
        '<div class="import-stat"><div class="import-stat-val">'+r.matchedFields.length+'</div><div class="import-stat-lbl">Colunas reconhecidas</div></div>'+
      '</div>'+
      '<div class="import-tag-row">'+tagsHtml+'</div>'+
      warnHtml +
      (sampleHtml ? '<div class="section-note" style="margin-top:12px;">Pr\u00e9via das 5 primeiras linhas v\u00e1lidas:</div>'+sampleHtml : "") +
      '<div class="import-actions">'+
        (canCommit ? '<button class="btn" id="importReplaceBtn">Substituir base atual ('+r.validRows.toLocaleString("pt-BR")+' lotes)</button>' : "") +
        (canCommit ? '<button class="btn ghost" id="importAppendBtn">Adicionar aos dados atuais</button>' : "") +
        '<button class="btn ghost" id="importCancelBtn">Cancelar</button>'+
      '</div>'+
    '</div>';

  if (canCommit){
    document.getElementById("importReplaceBtn").addEventListener("click", function(){ commitImport("replace"); });
    document.getElementById("importAppendBtn").addEventListener("click", function(){ commitImport("append"); });
  }
  document.getElementById("importCancelBtn").addEventListener("click", function(){
    currentWorking = null;
    el.innerHTML = "";
  });
}

function commitImport(mode){
  snapshotPristineIfNeeded();
  var cw = currentWorking;
  if (!cw || !cw.mappedRows.length) return;

  ["tc","rg","tg","ln","pr","gr","gj"].forEach(function(k){
    NZ.LK[k].length = 0;
    Array.prototype.push.apply(NZ.LK[k], cw.workingLookups[k]);
  });

  if (mode === "replace"){ NZ.ROWS.length = 0; }
  Array.prototype.push.apply(NZ.ROWS, cw.mappedRows);

  dataModified = true;
  var addedCount = cw.mappedRows.length;
  currentWorking = null;

  document.getElementById("importPreviewArea").innerHTML =
    '<div class="import-status-card"><div class="import-status-row">'+
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4C7A3D" stroke-width="2.4"><polyline points="20 6 9 17 4 12"/></svg>'+
    '<div><div class="import-status-text">Painel atualizado com sucesso.</div>'+
    '<div class="import-status-sub">'+(mode==="replace" ? "Base substitu\u00edda: " : "Adicionados: ")+addedCount.toLocaleString("pt-BR")+
    ' lotes \u00b7 total agora: '+NZ.ROWS.length.toLocaleString("pt-BR")+' lotes. Navegue pelas outras abas para ver os novos dados.</div></div>'+
    '</div></div>';
  finishDataChange();
}

/* ============================================================
   Tab entry point
   ============================================================ */
function render(){
  if (!initialized){ setupDropZone(); initialized = true; }
  snapshotPristineIfNeeded();
  renderSessionBanner();
}
NZ.RENDERERS.importar = render;

})();

(function(){
"use strict";
var NZ = window.__NZ;
var sharedMetric = "ca";
var monthMetric = "iep";
var selectedMonth = null;
var initialized = false;

function rows2026(){
  return NZ.FILTERED.filter(function(r){ return r[NZ.COL.AN]===2026; });
}

function populateSelects(){
  var sel = document.getElementById("avalMetricSelect");
  sel.innerHTML = NZ.METRIC_ORDER.map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = sharedMetric;
  sel.addEventListener("change", function(){ sharedMetric = sel.value; renderBreakdown(); });

  var monthMetricSel = document.getElementById("avalMonthMetricSelect");
  monthMetricSel.innerHTML = ["ca","cac","iep","iepc","gmd","mo","pm"].map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  monthMetricSel.value = monthMetric;
  monthMetricSel.addEventListener("change", function(){ monthMetric = monthMetricSel.value; renderMonthlyRank(); });

  var monthSel = document.getElementById("avalMonthSelect");
  var monthsPresent = Array.from(new Set(rows2026().map(function(r){ return r[NZ.COL.ME]; }))).sort(function(a,b){return a-b;});
  monthSel.innerHTML = monthsPresent.map(function(m){ return '<option value="'+m+'">'+NZ.MESES_PT_FULL[m-1]+'</option>'; }).join("");
  selectedMonth = monthsPresent.length ? monthsPresent[monthsPresent.length-1] : null;
  if (selectedMonth) monthSel.value = selectedMonth;
  monthSel.addEventListener("change", function(){ selectedMonth = parseInt(monthSel.value,10); renderMonthlyRank(); });
}

function statCard(label, value, note, cls){
  return '<div class="stat-card '+(cls||"")+'"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note||"")+'</div></div>';
}

function renderKpis(){
  var rows = rows2026();
  var months = Array.from(new Set(rows.map(function(r){ return r[NZ.COL.ME]; }))).sort(function(a,b){return a-b;});
  document.getElementById("avalPeriodNote").textContent = rows.length ?
    (NZ.MESES_PT[months[0]-1]+"\u2013"+NZ.MESES_PT[months[months.length-1]-1]+"/2026 \u00b7 "+rows.length.toLocaleString("pt-BR")+" lotes no recorte") :
    "Nenhum lote de 2026 no recorte de filtros atual";

  var keys = ["ca","cac","idade","iep","mo","dkg","dka","rc","pt"];
  document.getElementById("avalKpiRow").innerHTML = keys.map(function(mk){
    var m = NZ.METRICS[mk];
    var v = NZ.aggregate(rows, mk);
    var valStr = (mk==="rc"||mk==="pt") ? (v==null?"&ndash;":NZ.fmtInt(v/1000)) : NZ.fmtNum(v, m.dec);
    var unitStr = (mk==="rc"||mk==="pt") ? "ton" : m.unit;
    return '<div class="kpi-card" style="background:rgba(220,50,35,.06);border-color:var(--border);">'+
      '<div class="kpi-label" style="color:var(--slate);">'+NZ.esc(m.short)+'</div>'+
      '<div class="kpi-value" style="color:var(--ink);">'+valStr+(unitStr?' <span class="unit" style="color:var(--red);">'+unitStr+'</span>':'')+'</div></div>';
  }).join("");
}

function renderHighlights(){
  var rows = rows2026();
  var minN = 3;
  function bestOf(dimKey, filterFn){
    var r = filterFn ? rows.filter(filterFn) : rows;
    var rank = NZ.rankingData(r, dimKey, "iep", {minN:minN});
    return rank.length ? rank[0] : null;
  }
  var bestTec = bestOf("tecnico");
  var bestReg = bestOf("regiao");
  var bestLin = NZ.rankingData(rows, "linhagem", "iep", {minN:5})[0];
  var famRows = rows.filter(function(r){ return NZ.familiaFor(r[NZ.COL.PR]) != null; });
  var bestFam = NZ.rankingData(famRows, "familia", "iep", {minN:2})[0];

  document.getElementById("avalHighlightCards").innerHTML =
    statCard("Melhor técnico (IEP)", bestTec?bestTec.label:"\u2013", bestTec?("IEP "+NZ.fmtNum(bestTec.value,1)+" \u00b7 "+bestTec.n+" lotes"):"dados insuficientes", "red") +
    statCard("Melhor região (IEP)", bestReg?bestReg.label:"\u2013", bestReg?("IEP "+NZ.fmtNum(bestReg.value,1)+" \u00b7 "+bestReg.n+" lotes"):"dados insuficientes") +
    statCard("Melhor linhagem (IEP)", bestLin?bestLin.label:"\u2013", bestLin?("IEP "+NZ.fmtNum(bestLin.value,1)+" \u00b7 "+bestLin.n+" lotes"):"dados insuficientes", "red") +
    statCard("Melhor família Tomazini (IEP)", bestFam?bestFam.label:"\u2013", bestFam?("IEP "+NZ.fmtNum(bestFam.value,1)+" \u00b7 "+bestFam.n+" lotes"):"dados insuficientes");
}

function renderBreakdown(){
  var rows = rows2026();
  NZ.renderRankBars("avalRankTecnico", NZ.rankingData(rows, "tecnico", sharedMetric, {minN:3}), sharedMetric);
  NZ.renderRankBars("avalRankRegiao", NZ.rankingData(rows, "regiao", sharedMetric, {minN:3}), sharedMetric);
  NZ.renderRankBars("avalRankLinhagem", NZ.rankingData(rows, "linhagem", sharedMetric, {minN:5}), sharedMetric);
  var famRows = rows.filter(function(r){ return NZ.familiaFor(r[NZ.COL.PR]) != null; });
  NZ.renderRankBars("avalRankFamilia", NZ.rankingData(famRows, "familia", sharedMetric, {minN:2}), sharedMetric);
}

function renderSistemas(){
  var rows = rows2026();
  var map = NZ.groupByDim(rows, "aviario");
  var tipos = NZ.LK.tg.map(function(_,i){return i;}).filter(function(i){ return map.has(i) && map.get(i).length>0; });
  var metrics = ["ca","iep","mo"];
  var grid = document.getElementById("avalSistemaGrid");
  grid.innerHTML = metrics.map(function(mk){
    var mm = NZ.METRICS[mk];
    return '<div class="card"><div class="card-title">'+NZ.esc(mm.label)+'</div>'+
      '<div class="card-sub">'+(mm.good==="down"?"Quanto menor, melhor":"Quanto maior, melhor")+'</div>'+
      '<div class="chart-wrap short"><canvas id="avalsys_'+mk+'"></canvas></div></div>';
  }).join("");
  metrics.forEach(function(mk, idx){
    var mm = NZ.METRICS[mk];
    var ordered = tipos.slice().sort(function(a,b){
      var va = NZ.aggregate(map.get(a), mk), vb = NZ.aggregate(map.get(b), mk);
      return mm.good==="down" ? va-vb : vb-va;
    });
    NZ.makeChart("avalsys_"+mk, {
      type:"bar",
      data:{labels: ordered.map(function(ti){ return NZ.dimLabelFor("aviario", ti); }),
        datasets:[{data: ordered.map(function(ti){ return NZ.aggregate(map.get(ti), mk); }),
          backgroundColor: ordered.map(function(_,i){ return NZ.colorForIndex(i); }), borderRadius:5, maxBarThickness:50}]},
      options:{responsive:true, maintainAspectRatio:false,
        layout:{padding:{top:20}},
        scales:NZ.commonScales({y:{grid:{color:NZ.GRID_COLOR}, ticks:{display:false}}}),
        plugins:{legend:{display:false},
          datalabels: NZ.dlConfig(function(v){ return NZ.fmtNum(v, mm.dec); }),
          tooltip:{backgroundColor:"#241B1A", padding:10, cornerRadius:8, callbacks:{label:function(ctx){ return NZ.fmtMetric(ctx.parsed.y, mk); }}}}
      }
    });
  });
}

function renderMiniRankList(containerId, top5, bottom5, metricKey){
  var m = NZ.METRICS[metricKey];
  function row(r, good){
    return '<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px;border-bottom:1px solid var(--border);">'+
      '<span style="color:var(--ink);">'+NZ.esc(r.label)+'</span>'+
      '<span style="font-weight:700;color:'+(good?"#4C7A3D":"#DC3223")+';">'+NZ.fmtNum(r.value, m.dec)+'</span></div>';
  }
  var html = '<div class="section-note" style="margin-bottom:4px;font-weight:700;color:#4C7A3D;">TOP 5 MELHORES</div>'+
    (top5.length ? top5.map(function(r){ return row(r,true); }).join("") : "<div class='section-note'>sem dados suficientes</div>")+
    '<div class="section-note" style="margin:10px 0 4px;font-weight:700;color:#DC3223;">TOP 5 PIORES</div>'+
    (bottom5.length ? bottom5.map(function(r){ return row(r,false); }).join("") : "<div class='section-note'>sem dados suficientes</div>");
  document.getElementById(containerId).innerHTML = html;
}

function renderMonthlyRank(){
  if (selectedMonth == null) return;
  var rows = rows2026().filter(function(r){ return r[NZ.COL.ME]===selectedMonth; });
  var grid = document.getElementById("avalMonthlyRankGrid");
  grid.innerHTML =
    '<div class="card"><div class="card-title">Técnicos</div><div id="avalMonthTec"></div></div>'+
    '<div class="card"><div class="card-title">Regiões</div><div id="avalMonthReg"></div></div>'+
    '<div class="card"><div class="card-title">Integrados (proprietário)</div><div id="avalMonthProp"></div></div>';

  ["tecnico","regiao","proprietario"].forEach(function(dimKey){
    var minN = dimKey==="proprietario" ? 2 : 2;
    var rank = NZ.rankingData(rows, dimKey, monthMetric, {minN:minN});
    var top5 = rank.slice(0,5);
    var bottom5 = rank.slice(-5).reverse().filter(function(r){ return top5.indexOf(r)===-1; });
    var containerId = dimKey==="tecnico"?"avalMonthTec":(dimKey==="regiao"?"avalMonthReg":"avalMonthProp");
    renderMiniRankList(containerId, top5, bottom5, monthMetric);
  });
}

function render(){
  if (!initialized){ populateSelects(); initialized = true; }
  renderKpis();
  renderHighlights();
  renderBreakdown();
  renderSistemas();
  renderMonthlyRank();
}

NZ.RENDERERS.aval2026 = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMetric = "pagkg";
var initialized = false;

function statCard(label, value, note){
  return '<div class="stat-card"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note||"")+'</div></div>';
}

function populateSelect(){
  var sel = document.getElementById("econMetricSelect");
  sel.innerHTML = ["rl","rb","da","tr","pagcab","pagkg"].map(function(mk){
    return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>';
  }).join("");
  sel.value = selectedMetric;
  sel.addEventListener("change", function(){ selectedMetric = sel.value; renderMonthChart(); });
}

function renderKpis(){
  var rows = NZ.FILTERED;
  document.getElementById("econKpiCards").innerHTML =
    statCard("Resultado líquido total", NZ.fmtBRL(NZ.aggregate(rows,"rl")), "recorte atual de filtros") +
    statCard("Pagamento por cabeça", "R$ "+NZ.fmtNum(NZ.aggregate(rows,"pagcab"),3), "soma resultado líquido / soma aves") +
    statCard("Pagamento por kg", "R$ "+NZ.fmtNum(NZ.aggregate(rows,"pagkg"),3), "soma resultado líquido / soma kg produzido") +
    statCard("Apanha + Transporte", NZ.fmtBRL((NZ.aggregate(rows,"da")||0)+(NZ.aggregate(rows,"tr")||0)), "total de descontos/pagamentos de logística");
}

function renderMonthChart(){
  var rows = NZ.FILTERED;
  var m = NZ.METRICS[selectedMetric];
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  var datasets = years.map(function(y, i){
    var data = [];
    for (var mm=1; mm<=12; mm++){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y && r[NZ.COL.ME]===mm; });
      data.push(g.length ? NZ.aggregate(g, selectedMetric) : null);
    }
    return NZ.baseLineDataset(String(y), data, NZ.colorForIndex(i));
  });
  NZ.makeChart("econMonthChart", {
    type:"line",
    data:{labels:NZ.MESES_PT, datasets:datasets},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(),
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){ return ctx.dataset.label+": "+NZ.fmtMetric(ctx.parsed.y, selectedMetric); }}}})}
  });
}

function renderYearChart(){
  var rows = NZ.FILTERED;
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});
  function seriesFor(mk){
    return years.map(function(y){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y; });
      return g.length ? NZ.aggregate(g, mk, "sum") : null;
    });
  }
  NZ.makeChart("econYearChart", {
    type:"bar",
    data:{labels: years.map(String), datasets:[
      NZ.baseBarDataset("Resultado Líquido (R$)", seriesFor("rl"), NZ.colorForIndex(0)),
      NZ.baseBarDataset("Apanha (R$)", seriesFor("da"), NZ.colorForIndex(1)),
      NZ.baseBarDataset("Transporte (R$)", seriesFor("tr"), NZ.colorForIndex(2))
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(),
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){ return ctx.dataset.label+": "+NZ.fmtBRL(ctx.parsed.y); }}}})}
  });
}

function renderIntegradoTable(){
  var rows = NZ.FILTERED;
  var map = NZ.groupByDim(rows, "proprietario");
  var arr = [];
  map.forEach(function(g, key){
    if (g.length < 3) return;
    arr.push({label: NZ.dimLabelFor("proprietario", key), g:g, total: NZ.aggregate(g,"rl","sum")});
  });
  arr.sort(function(a,b){ return b.total - a.total; });
  arr = arr.slice(0, 20);
  var head = "<tr><th>Integrado</th><th>Lotes</th><th>Resultado Líquido</th><th>R$/cabeça</th><th>R$/kg</th><th>Apanha</th><th>Transporte</th></tr>";
  var body = arr.map(function(r){
    return "<tr><td><b>"+NZ.esc(r.label)+"</b></td><td class='num'>"+r.g.length+"</td>"+
      "<td class='num'>"+NZ.fmtBRL(r.total)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(r.g,"pagcab"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(r.g,"pagkg"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(r.g,"da","sum"))+"</td>"+
      "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(r.g,"tr","sum"))+"</td></tr>";
  }).join("");
  document.getElementById("econIntegradoTable").innerHTML = head + (body || "<tr><td colspan='7' class='section-note' style='padding:16px;'>Sem integrados com pelo menos 3 lotes neste recorte.</td></tr>");
  if (body) NZ.makeSortable("econIntegradoTable", {defaultCol:2, defaultDir:"desc"});
}

function renderRegiaoChart(){
  var rows = NZ.FILTERED;
  var map = NZ.groupByDim(rows, "regiao");
  var arr = [];
  map.forEach(function(g, key){
    if (g.length < 3 || key < 0) return;
    arr.push({label: NZ.dimLabelFor("regiao", key), g:g});
  });
  arr.sort(function(a,b){ return NZ.aggregate(b.g,"da","sum") - NZ.aggregate(a.g,"da","sum"); });
  arr = arr.slice(0, 15);
  NZ.makeChart("econRegiaoChart", {
    type:"bar",
    data:{labels: arr.map(function(r){ return r.label; }), datasets:[
      {label:"Apanha (R$)", data: arr.map(function(r){ return NZ.aggregate(r.g,"da","sum"); }), backgroundColor:NZ.colorForIndex(1), borderRadius:5},
      {label:"Transporte (R$)", data: arr.map(function(r){ return NZ.aggregate(r.g,"tr","sum"); }), backgroundColor:NZ.colorForIndex(2), borderRadius:5}
    ]},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(),
      plugins:NZ.commonPlugins({tooltip:{callbacks:{label:function(ctx){ return ctx.dataset.label+": "+NZ.fmtBRL(ctx.parsed.y); }}}})}
  });
}

function render(){
  if (!initialized){ populateSelect(); initialized = true; }
  renderKpis();
  renderMonthChart();
  renderYearChart();
  renderIntegradoTable();
  renderRegiaoChart();
}

NZ.RENDERERS.economico = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var selectedMonth = 6;
var selectedMetric = "ca";
var initialized = false;
var DIAS_SEMANA = ["domingo","segunda-feira","ter\u00e7a-feira","quarta-feira","quinta-feira","sexta-feira","s\u00e1bado"];
var ledgerAno = null, ledgerMes = 6;

function statCard(label, value, note){
  return '<div class="stat-card"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note||"")+'</div></div>';
}

function populateControls(){
  var mesSel = document.getElementById("dmMesSelect");
  mesSel.innerHTML = NZ.MESES_PT_FULL.map(function(mn,i){ return '<option value="'+(i+1)+'">'+mn+'</option>'; }).join("");
  mesSel.value = selectedMonth;
  mesSel.addEventListener("change", function(){ selectedMonth = parseInt(mesSel.value,10); render(); });

  var metSel = document.getElementById("dmMetricSelect");
  metSel.innerHTML = NZ.METRIC_ORDER.map(function(mk){ return '<option value="'+mk+'">'+NZ.esc(NZ.METRICS[mk].label)+'</option>'; }).join("");
  metSel.value = selectedMetric;
  metSel.addEventListener("change", function(){ selectedMetric = metSel.value; render(); });

  var anos = NZ.META.anos.slice().sort(function(a,b){ return b-a; });
  var anoSel = document.getElementById("dmLedgerAnoSelect");
  anoSel.innerHTML = anos.map(function(a){ return '<option value="'+a+'">'+a+'</option>'; }).join("");
  ledgerAno = anos[0];
  anoSel.value = ledgerAno;
  anoSel.addEventListener("change", function(){ ledgerAno = parseInt(anoSel.value,10); renderLedger(); });

  var mesSel2 = document.getElementById("dmLedgerMesSelect");
  mesSel2.innerHTML = NZ.MESES_PT_FULL.map(function(mn,i){ return '<option value="'+(i+1)+'">'+mn+'</option>'; }).join("");
  ledgerMes = 6;
  mesSel2.addEventListener("change", function(){ ledgerMes = parseInt(mesSel2.value,10); renderLedger(); });
}

function rowCells(g){
  var pfVal = NZ.aggregate(g, "pf");
  return "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"ar","sum"))+"</td>"+
    "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"pt","sum"))+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"idadec"),1)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"idade"),1)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"viab"),2)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"cac"),3)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dka"),2)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dkg"),2)+"</td>"+
    "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pagcab"),2)+"</td>"+
    "<td class='num'>R$ "+NZ.fmtNum(pfVal,2)+"</td>"+
    "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(g,"dca"))+"</td>"+
    "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(g,"cs"))+"</td>";
}

function renderLedger(){
  var mesSel2 = document.getElementById("dmLedgerMesSelect");
  var mesesDisponiveis = Array.from(new Set(NZ.FILTERED.filter(function(r){ return r[NZ.COL.AN]===ledgerAno; }).map(function(r){ return r[NZ.COL.ME]; }))).sort(function(a,b){return a-b;});
  if (mesesDisponiveis.indexOf(ledgerMes)===-1) ledgerMes = mesesDisponiveis.length ? mesesDisponiveis[mesesDisponiveis.length-1] : ledgerMes;
  mesSel2.value = ledgerMes;

  var rows = NZ.FILTERED.filter(function(r){ return r[NZ.COL.AN]===ledgerAno && r[NZ.COL.ME]===ledgerMes; });
  var byDia = NZ.groupByDim(rows, "dia");
  var dias = Array.from(byDia.keys()).sort(function(a,b){ return a-b; });

  // ---- stat cards for the ledger period ----
  document.getElementById("dmLedgerStatCards").innerHTML =
    statCard("Aves Recebidas", NZ.fmtInt(NZ.aggregate(rows,"ar","sum")), NZ.MESES_PT_FULL[ledgerMes-1]+"/"+ledgerAno) +
    statCard("Peso Médio", NZ.fmtNum(NZ.aggregate(rows,"pm"),3)+" kg", dias.length+" dia(s) com abate") +
    statCard("CA / IEP médios", NZ.fmtNum(NZ.aggregate(rows,"ca"),3)+" / "+NZ.fmtNum(NZ.aggregate(rows,"iep"),1), "") +
    statCard("Mortalidade média", NZ.fmtNum(NZ.aggregate(rows,"mo"),2)+"%", "");

  document.getElementById("dmLedgerChartSub").textContent = NZ.MESES_PT_FULL[ledgerMes-1]+"/"+ledgerAno+" \u00b7 uma linha por indicador, um ponto por dia";

  // ---- chart: CA and IEP by day (dual axis) ----
  var caData = [], iepData = [], labels = [];
  dias.forEach(function(d){
    var g = byDia.get(d);
    labels.push(String(d));
    caData.push(NZ.aggregate(g,"ca"));
    iepData.push(NZ.aggregate(g,"iep"));
  });
  NZ.makeChart("dmLedgerChart", {
    type:"line",
    data:{labels:labels, datasets:[
      NZ.baseLineDataset("CA", caData, NZ.colorForIndex(0), {yAxisID:"y"}),
      NZ.baseLineDataset("IEP", iepData, NZ.colorForIndex(2), {yAxisID:"y1"})
    ]},
    options:{responsive:true, maintainAspectRatio:false,
      scales:{
        x:{grid:{display:false}, title:{display:true,text:"Dia do mês",font:{size:10}}},
        y:{position:"left", grid:{color:NZ.GRID_COLOR}, title:{display:true,text:"CA",font:{size:10}}},
        y1:{position:"right", grid:{display:false}, title:{display:true,text:"IEP",font:{size:10}}}
      },
      plugins:NZ.commonPlugins()}
  });

  // ---- day-by-day ledger table ----
  var head = "<tr><th>Data</th><th>Aves Recebidas</th><th>Peso Total</th><th>Idade C</th><th>Idade</th><th>Mort. %</th>"+
    "<th>Viab. Real %</th><th>GMD</th><th>Peso Médio</th><th>CA</th><th>CAc</th><th>IEP</th><th>Dens. Aloj.</th><th>Dens. KG</th>"+
    "<th>R$/Unidade</th><th>Preço Frango</th><th>Desc. CA</th><th>Cond. SIF</th></tr>";

  var body = dias.map(function(d){
    var g = byDia.get(d);
    var dow = new Date(Date.UTC(ledgerAno, ledgerMes-1, d)).getUTCDay();
    var dateLabel = DIAS_SEMANA[dow]+", "+d+" de "+NZ.MESES_PT_FULL[ledgerMes-1].toLowerCase()+" de "+ledgerAno;
    return "<tr><td><b>"+dateLabel+"</b></td>"+rowCells(g)+"</tr>";
  }).join("");

  var totalRow = dias.length ? "<tr style='font-weight:800;background:#FBF2E2;'><td>Total Geral</td>"+rowCells(rows)+"</tr>" : "";

  document.getElementById("dmLedgerTable").innerHTML = head + body + totalRow +
    (dias.length ? "" : "<tr><td colspan='18' class='section-note' style='padding:16px;'>Nenhum lote neste mês/ano com os filtros atuais.</td></tr>");
  if (dias.length) NZ.makeSortable("dmLedgerTable");
}

function heatColor(value, min, max, good){
  if (value==null || min==null || max==null || min===max) return "#FFFFFF";
  var t = (value-min)/(max-min);
  if (good === "down") t = 1-t;
  var r1=[220,50,35], r2=[76,122,61];
  var c = r1.map(function(a,i){ return Math.round(a + (r2[i]-a)*t); });
  return "rgb("+c.join(",")+")";
}

function rowsForMonth(){
  return NZ.FILTERED.filter(function(r){ return r[NZ.COL.ME]===selectedMonth; });
}

function render(){
  if (!initialized){ populateControls(); initialized = true; }
  var rows = rowsForMonth();
  var m = NZ.METRICS[selectedMetric];
  var years = NZ.META.anos.slice().sort(function(a,b){return a-b;});

  // ---- stat cards ----
  var byDay = {};
  for (var dd=1; dd<=31; dd++){
    var g = rows.filter(function(r){ return r[NZ.COL.DI]===dd; });
    if (g.length) byDay[dd] = {n:g.length, v:NZ.aggregate(g, selectedMetric)};
  }
  var dayEntries = Object.keys(byDay).map(function(k){ return {dia:+k, v:byDay[k].v, n:byDay[k].n}; });
  var best = null, worst = null;
  dayEntries.forEach(function(e){
    if (best==null || (m.good==="down" ? e.v<best.v : e.v>best.v)) best = e;
    if (worst==null || (m.good==="down" ? e.v>worst.v : e.v<worst.v)) worst = e;
  });
  document.getElementById("dmStatCards").innerHTML =
    statCard("Lotes em "+NZ.MESES_PT_FULL[selectedMonth-1], rows.length.toLocaleString("pt-BR"), years.length+" anos na base") +
    statCard("Média do mês", NZ.fmtMetric(NZ.aggregate(rows, selectedMetric), selectedMetric), "todos os anos combinados") +
    statCard("Melhor dia", best?("Dia "+best.dia):"\u2013", best?(NZ.fmtMetric(best.v,selectedMetric)+" \u00b7 "+best.n+" lotes"):"") +
    statCard("Pior dia", worst?("Dia "+worst.dia):"\u2013", worst?(NZ.fmtMetric(worst.v,selectedMetric)+" \u00b7 "+worst.n+" lotes"):"");

  document.getElementById("dmChartSub").textContent = NZ.MESES_PT_FULL[selectedMonth-1]+" \u00b7 "+NZ.METRICS[selectedMetric].label;

  // ---- line chart: day 1-31 on x, one line per year ----
  var datasets = years.map(function(y, i){
    var data = [];
    for (var d=1; d<=31; d++){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y && r[NZ.COL.DI]===d; });
      data.push(g.length ? NZ.aggregate(g, selectedMetric) : null);
    }
    return NZ.baseLineDataset(String(y), data, NZ.colorForIndex(i));
  });
  NZ.makeChart("dmLineChart", {
    type:"line",
    data:{labels: Array.from({length:31}, function(_,i){ return String(i+1); }), datasets:datasets},
    options:{responsive:true, maintainAspectRatio:false, scales:NZ.commonScales(), plugins:NZ.commonPlugins(), spanGaps:true}
  });

  // ---- heatmap Ano x Dia ----
  var grid = [];
  var allVals = [];
  years.forEach(function(y){
    var rowArr = [];
    for (var d=1; d<=31; d++){
      var g = rows.filter(function(r){ return r[NZ.COL.AN]===y && r[NZ.COL.DI]===d; });
      var v = g.length ? NZ.aggregate(g, selectedMetric) : null;
      rowArr.push(v);
      if (v!=null) allVals.push(v);
    }
    grid.push(rowArr);
  });
  var min = allVals.length ? Math.min.apply(null, allVals) : null;
  var max = allVals.length ? Math.max.apply(null, allVals) : null;
  var head = "<tr><th>Ano</th>"+Array.from({length:31},function(_,i){ return "<th style='text-align:center'>"+(i+1)+"</th>"; }).join("")+"</tr>";
  var body = years.map(function(y, yi){
    var cells = grid[yi].map(function(v){
      var bg = heatColor(v, min, max, m.good);
      var txt = v==null ? "" : NZ.fmtNum(v, m.dec);
      return "<td style='text-align:center;background:"+bg+";color:#fff;font-weight:700;font-size:10.5px;padding:6px 4px;'>"+txt+"</td>";
    }).join("");
    return "<tr><td><b>"+y+"</b></td>"+cells+"</tr>";
  }).join("");
  document.getElementById("dmHeatTable").innerHTML = head + body;

  // ---- day summary table (all years combined) ----
  var head2 = "<tr><th>Dia</th><th>Lotes</th><th>"+NZ.esc(m.label)+"</th></tr>";
  var body2 = dayEntries.sort(function(a,b){return a.dia-b.dia;}).map(function(e){
    return "<tr><td><b>Dia "+e.dia+"</b></td><td class='num'>"+e.n+"</td><td class='num'>"+NZ.fmtNum(e.v,m.dec)+"</td></tr>";
  }).join("");
  document.getElementById("dmDayTable").innerHTML = head2 + body2;
  if (dayEntries.length) NZ.makeSortable("dmDayTable");

  renderLedger();
}

NZ.RENDERERS.diarioMensal = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;
var state = {ano:null, mes:null, dia:null, aviario:"todos", integrado:"todos", galpao:"todos"};
var initialized = false;

function baseRows(){ return NZ.FILTERED; }

function anosDisponiveis(){
  return Array.from(new Set(baseRows().map(function(r){ return r[NZ.COL.AN]; }))).sort(function(a,b){ return b-a; });
}
function mesesDisponiveis(ano){
  return Array.from(new Set(baseRows().filter(function(r){ return r[NZ.COL.AN]===ano; }).map(function(r){ return r[NZ.COL.ME]; }))).sort(function(a,b){ return a-b; });
}
function diasDisponiveis(ano, mes){
  return Array.from(new Set(baseRows().filter(function(r){ return r[NZ.COL.AN]===ano && r[NZ.COL.ME]===mes; }).map(function(r){ return r[NZ.COL.DI]; }))).sort(function(a,b){ return a-b; });
}

function populateDateSelects(keepCurrent){
  var anos = anosDisponiveis();
  if (!anos.length) return;
  if (!keepCurrent || anos.indexOf(state.ano)===-1) state.ano = anos[0];
  var anoSel = document.getElementById("diAnoSelect");
  anoSel.innerHTML = anos.map(function(a){ return '<option value="'+a+'">'+a+'</option>'; }).join("");
  anoSel.value = state.ano;

  var meses = mesesDisponiveis(state.ano);
  if (!keepCurrent || meses.indexOf(state.mes)===-1) state.mes = meses[meses.length-1];
  var mesSel = document.getElementById("diMesSelect");
  mesSel.innerHTML = meses.map(function(mm){ return '<option value="'+mm+'">'+NZ.MESES_PT_FULL[mm-1]+'</option>'; }).join("");
  mesSel.value = state.mes;

  var dias = diasDisponiveis(state.ano, state.mes);
  if (!keepCurrent || dias.indexOf(state.dia)===-1) state.dia = dias[dias.length-1];
  var diaSel = document.getElementById("diDiaSelect");
  diaSel.innerHTML = dias.map(function(dd){ return '<option value="'+dd+'">'+dd+'</option>'; }).join("");
  diaSel.value = state.dia;
}

function populateFilterSelects(){
  var avSel = document.getElementById("diAviarioSelect");
  avSel.innerHTML = '<option value="todos">Todos</option>'+NZ.LK.tg.map(function(t,i){ return '<option value="'+i+'">'+NZ.esc(t)+'</option>'; }).join("");
  avSel.value = state.aviario;

  var intSel = document.getElementById("diIntegradoSelect");
  var propOptions = NZ.LK.pr.map(function(t,i){ return {i:i, label:t}; }).sort(function(a,b){ return a.label.localeCompare(b.label,"pt-BR"); });
  intSel.innerHTML = '<option value="todos">Todos</option>'+propOptions.map(function(o){ return '<option value="'+o.i+'">'+NZ.esc(o.label)+'</option>'; }).join("");
  intSel.value = state.integrado;

  var gjSel = document.getElementById("diGalpaoSelect");
  gjSel.innerHTML = '<option value="todos">Todos</option>';
  gjSel.value = "todos";
}

function refreshGalpaoOptions(dayRowsUnfiltered){
  var gjSel = document.getElementById("diGalpaoSelect");
  var present = Array.from(new Set(dayRowsUnfiltered.map(function(r){ return r[NZ.COL.GJ]; }))).filter(function(i){ return i>=0; });
  present.sort(function(a,b){ return NZ.LK.gj[a].localeCompare(NZ.LK.gj[b],"pt-BR"); });
  var current = gjSel.value;
  gjSel.innerHTML = '<option value="todos">Todos ('+present.length+')</option>'+present.map(function(i){ return '<option value="'+i+'">'+NZ.esc(NZ.LK.gj[i])+'</option>'; }).join("");
  gjSel.value = present.indexOf(parseInt(current,10))>-1 ? current : "todos";
}

function setupOnce(){
  populateDateSelects(false);
  populateFilterSelects();

  document.getElementById("diAnoSelect").addEventListener("change", function(e){ state.ano = parseInt(e.target.value,10); populateDateSelects(true); render(); });
  document.getElementById("diMesSelect").addEventListener("change", function(e){ state.mes = parseInt(e.target.value,10); populateDateSelects(true); render(); });
  document.getElementById("diDiaSelect").addEventListener("change", function(e){ state.dia = parseInt(e.target.value,10); render(); });
  document.getElementById("diAviarioSelect").addEventListener("change", function(e){ state.aviario = e.target.value; render(); });
  document.getElementById("diIntegradoSelect").addEventListener("change", function(e){ state.integrado = e.target.value; render(); });
  document.getElementById("diGalpaoSelect").addEventListener("change", function(e){ state.galpao = e.target.value; render(); });
}

function statCard(label, value, note){
  return '<div class="stat-card"><div class="stat-label">'+NZ.esc(label)+'</div>'+
    '<div class="stat-value">'+value+'</div><div class="stat-note">'+NZ.esc(note||"")+'</div></div>';
}

function dayRowsAll(){
  return baseRows().filter(function(r){ return r[NZ.COL.AN]===state.ano && r[NZ.COL.ME]===state.mes && r[NZ.COL.DI]===state.dia; });
}
function applyLocalFilters(rows){
  if (state.aviario !== "todos"){ var tg = parseInt(state.aviario,10); rows = rows.filter(function(r){ return r[NZ.COL.TG]===tg; }); }
  if (state.integrado !== "todos"){ var pr = parseInt(state.integrado,10); rows = rows.filter(function(r){ return r[NZ.COL.PR]===pr; }); }
  if (state.galpao !== "todos"){ var gj = parseInt(state.galpao,10); rows = rows.filter(function(r){ return r[NZ.COL.GJ]===gj; }); }
  return rows;
}

function render(){
  if (!initialized){ setupOnce(); initialized = true; }
  var allDayRows = dayRowsAll();
  refreshGalpaoOptions(allDayRows);
  var rows = applyLocalFilters(allDayRows);

  var dateLabel = (state.dia!=null ? state.dia+" de " : "") + (state.mes!=null ? NZ.MESES_PT_FULL[state.mes-1]+" de " : "") + (state.ano||"");
  document.getElementById("diTableNote").textContent = rows.length ? (dateLabel+" \u00b7 "+rows.length+" lote(s)") : "Nenhum lote nesta data com os filtros atuais";

  document.getElementById("diStatCards").innerHTML =
    statCard("Lotes abatidos", rows.length, dateLabel) +
    statCard("CA médio", NZ.fmtNum(NZ.aggregate(rows,"ca"),3), rows.length?"":"sem dados") +
    statCard("IEP médio", NZ.fmtNum(NZ.aggregate(rows,"iep"),1), "") +
    statCard("Volume abatido", NZ.fmtInt(NZ.aggregate(rows,"ar","sum"))+" aves", NZ.fmtInt((NZ.aggregate(rows,"pt","sum")||0)/1000)+" ton");

  // bar chart: CA by granja
  var byGranjaAll = NZ.groupByDim(rows, "granja");
  var granjaArr = Array.from(byGranjaAll.keys()).map(function(k){
    return {label: NZ.dimLabelFor("granja", k), ca: NZ.aggregate(byGranjaAll.get(k), "ca")};
  }).sort(function(a,b){ return a.ca-b.ca; });
  NZ.makeChart("diBarChart", {
    type:"bar",
    data:{
      labels: granjaArr.map(function(o){ return o.label; }),
      datasets:[{data: granjaArr.map(function(o){ return o.ca; }),
        backgroundColor: granjaArr.map(function(_,i){ return NZ.colorForIndex(i%8); }), borderRadius:5, maxBarThickness:34}]
    },
    options:{responsive:true, maintainAspectRatio:false,
      layout:{padding:{top:20}},
      scales:NZ.commonScales({x:{grid:{display:false}, ticks:{font:{size:10}}}, y:{grid:{color:NZ.GRID_COLOR}}}),
      plugins:{legend:{display:false},
        datalabels: NZ.dlConfig(function(v){ return v!=null?v.toFixed(3):""; }, {font:{weight:"700",size:9.5}}),
        tooltip:{backgroundColor:"#241B1A", padding:10, cornerRadius:8, callbacks:{label:function(ctx){ return "CA: "+ctx.parsed.y.toFixed(3); }}}}
    }
  });

  // distribution by tipo aviario (count of lotes that day)
  var map = NZ.groupByDim(rows, "aviario");
  var tipos = NZ.LK.tg.map(function(_,i){return i;}).filter(function(i){ return map.has(i); });
  NZ.makeChart("diAviarioChart", {
    type:"bar",
    data:{labels: tipos.map(function(i){ return NZ.dimLabelFor("aviario",i); }),
      datasets:[{data: tipos.map(function(i){ return map.get(i).length; }),
        backgroundColor: tipos.map(function(_,i){ return NZ.colorForIndex(i); }), borderRadius:5, maxBarThickness:60}]},
    options:{responsive:true, maintainAspectRatio:false,
      layout:{padding:{top:20}},
      scales:NZ.commonScales({y:{grid:{color:NZ.GRID_COLOR}, ticks:{stepSize:1}}}),
      plugins:{legend:{display:false}, datalabels: NZ.dlConfig(function(v){ return v+" lote"+(v>1?"s":""); })}
    }
  });

  // detailed table: grouped Tipo de Aviário -> Granja, with subtotals (matches Agrosys pivot model)
  var byTipo = NZ.groupByDim(rows, "aviario");
  var tiposPresentes = NZ.LK.tg.map(function(_,i){return i;}).filter(function(i){ return byTipo.has(i); })
    .sort(function(a,b){ return NZ.dimLabelFor("aviario",a).localeCompare(NZ.dimLabelFor("aviario",b)); });

  var head = "<tr><th>Granja</th><th>Idade</th><th>Mort. %</th><th>GMD</th><th>Peso Médio</th><th>CA</th><th>IEP</th>"+
    "<th>Dens. KG</th><th>R$/Unidade</th><th>Desc. CA</th><th>Ração</th></tr>";
  var bodyParts = [];
  var anyRows = false;

  tiposPresentes.forEach(function(ti){
    var tipoRows = byTipo.get(ti);
    anyRows = true;
    var byGranja = NZ.groupByDim(tipoRows, "granja");
    var granjaKeys = Array.from(byGranja.keys()).sort(function(a,b){
      return NZ.dimLabelFor("granja",a).localeCompare(NZ.dimLabelFor("granja",b),"pt-BR");
    });
    bodyParts.push("<tr style='background:#FBF2E2;'><td colspan='11' style='font-weight:800;color:var(--red-dark);'>"+NZ.esc(NZ.dimLabelFor("aviario",ti))+"</td></tr>");
    granjaKeys.forEach(function(gk){
      var g = byGranja.get(gk);
      bodyParts.push("<tr><td>"+NZ.esc(NZ.dimLabelFor("granja",gk))+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"idade"),1)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"mo"),2)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"gmd"),2)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pm"),3)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"ca"),3)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"iep"),1)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"dkg"),2)+"</td>"+
        "<td class='num'>"+NZ.fmtNum(NZ.aggregate(g,"pagcab"),2)+"</td>"+
        "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(g,"dca"))+"</td>"+
        "<td class='num'>"+NZ.fmtInt(NZ.aggregate(g,"rc","sum"))+"</td></tr>");
    });
    bodyParts.push("<tr style='font-weight:800;background:#F3EFE8;'><td>"+NZ.esc(NZ.dimLabelFor("aviario",ti))+" Total</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"idade"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"dkg"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(tipoRows,"pagcab"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(tipoRows,"dca"))+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(tipoRows,"rc","sum"))+"</td></tr>");
  });
  if (anyRows){
    bodyParts.push("<tr style='font-weight:800;background:#F5DFAE;'><td>Total Geral</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"idade"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"mo"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"gmd"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"pm"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"ca"),3)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"iep"),1)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"dkg"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtNum(NZ.aggregate(rows,"pagcab"),2)+"</td>"+
      "<td class='num'>"+NZ.fmtBRL(NZ.aggregate(rows,"dca"))+"</td>"+
      "<td class='num'>"+NZ.fmtInt(NZ.aggregate(rows,"rc","sum"))+"</td></tr>");
  }
  document.getElementById("diTable").innerHTML = head + (bodyParts.join("") || "<tr><td colspan='11' class='section-note' style='padding:16px;'>Nenhum lote encontrado para esta combinação de filtros.</td></tr>");
}

NZ.RENDERERS.diario = render;
})();

(function(){
"use strict";
var NZ = window.__NZ;

function boot(){
  NZ.buildTabNav();
  NZ.buildFilterBar();
  NZ.renderKpiHeader();
  NZ.renderFilterSummary();
  NZ.markAllDirty();
  NZ.switchTab("diario");

  var meta = NZ.META;
  var updatedTag = document.getElementById("topbarUpdated");
  if (updatedTag){
    var provTxt = meta.provisional_count ? (" \u00b7 inclui "+meta.provisional_count+" provis\u00f3rio(s)") : "";
    updatedTag.textContent = "Base Agrosys \u00b7 " + meta.total_lotes.toLocaleString("pt-BR") + " lotes \u00b7 " + meta.data_abate_min.split("-").reverse().join("/") + " a " + meta.data_abate_max.split("-").reverse().join("/") + provTxt;
    if (meta.provisional_count){
      updatedTag.title = meta.provisional_count+" lote(s) ainda marcados como \u201cAberto\u201d no Agrosys (fechamento administrativo pendente), mas j\u00e1 com CA, IEP e demais resultados completos \u2014 inclu\u00eddos aqui como se fechados.";
    }
  }

  if (meta.provisional_count){
    var provNote = " <b>Inclui "+meta.provisional_count+" lote(s)</b> ainda marcados como \u201cAberto\u201d no Agrosys (fechamento administrativo pendente) mas j\u00e1 com resultados completos \u2014 tratados aqui como fechados.";
    ["dmBannerText","diBannerText"].forEach(function(id){
      var el = document.getElementById(id);
      if (el) el.innerHTML += provNote;
    });
  }

  var loading = document.getElementById("loadingScreen");
  if (loading){
    setTimeout(function(){
      loading.style.transition = "opacity .3s";
      loading.style.opacity = "0";
      setTimeout(function(){ loading.remove(); }, 320);
    }, 150);
  }

  var refreshBtn = document.getElementById("topbarRefreshBtn");
  if (refreshBtn){
    refreshBtn.addEventListener("click", function(){
      if (typeof window.__syncSheetNow === "function") window.__syncSheetNow();
      else location.reload();
    });
  }
}

if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
})();

