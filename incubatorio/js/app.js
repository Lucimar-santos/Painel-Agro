/* ============ Painel Incubatório — App JS ============
   Recebe a base já processada (vinda do Google Sheets) em start(RAW).
   ==================================================== */
window.PainelIncubatorio = { start: function(RAW){


const DICT = RAW.dict;
const R = RAW.rows;
const N = R.f.length;

// typed arrays for speed
const F  = Int32Array.from(R.f);
const L  = Int32Array.from(R.l);
const TO = Int32Array.from(R.to);
const LG = Int32Array.from(R.lg);
const SM = Int32Array.from(R.sm);
const DN = Int32Array.from(R.dn);
const AM = Float64Array.from(R.am);
const DS = Float64Array.from(R.ds);
const TI = Float64Array.from(R.ti);
const CT = Float64Array.from(R.ct);
const TN = Float64Array.from(R.tn);
const EL = Float64Array.from(R.el);
const NM = Float64Array.from(R.nm);
const TV = Float64Array.from(R.tv);
const IEV = Float64Array.from(R.iev);
const IEE = Float64Array.from(R.iee);
const SE = Float64Array.from(R.se);
const DF = Float64Array.from(R.df);
const AN = Int32Array.from(R.an);
const ME = Int32Array.from(R.me);

const SEMANAS = DICT.semana; // sorted date strings 'YYYY-MM-DD' (Monday of each week bucket)
const DATAS = DICT.dataNasc; // sorted daily date strings 'YYYY-MM-DD' (Data Nascimento, real daily granularity)
const FAZENDAS = DICT.fazenda;
const LOTES = DICT.lote;
const TIPOS = DICT.tipoOvo;
const LINHGS = DICT.linhg;

const ANOS = Array.from(new Set(Array.from(AN))).sort((a,b)=>a-b);
const MESES = [1,2,3,4,5,6,7,8,9,10,11,12];
const MES_NOMES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

// numeric-aware sort for display (Lote codes are numeric strings)
const LOTES_SORTED = LOTES.slice().sort((a,b)=> a.localeCompare(b, 'pt-BR', {numeric:true}));
const FAZENDAS_SORTED = FAZENDAS.slice().sort((a,b)=> a.localeCompare(b, 'pt-BR', {numeric:true}));

document.getElementById('footN').textContent = N.toLocaleString('pt-BR');

/* ---------- 2. Color palette ---------- */
const COL = {
  blue:'#4472C4', blueDark:'#2F5597', lightblue:'#5B9BD5',
  orange:'#ED7D31', orangeDark:'#C55A11',
  gray:'#A5A5A5', grayDark:'#7F7F7F',
  gold:'#FFC000', goldDark:'#C99700',
  green:'#70AD47', greenDark:'#548235',
  red:'#C00000', purple:'#8E44AD'
};
const LINHG_COLORS = {};
(function(){
  const palette = [COL.blue, COL.orange, COL.gold, COL.gray, COL.green, COL.purple, COL.lightblue, COL.red];
  LINHGS.forEach((lg,i)=> LINHG_COLORS[lg] = palette[i % palette.length]);
})();

Chart.register(ChartDataLabels);
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;
Chart.defaults.font.family = "'Segoe UI','Calibri',Arial,sans-serif";
Chart.defaults.color = '#4B5160';
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.boxWidth = 8;
Chart.defaults.plugins.legend.labels.font = {size:11};
Chart.defaults.plugins.datalabels.display = false; // opt-in per chart

/* ---------- 3. Filter state ---------- */
// Default period = the last full week (Monday-Sunday) that has data, but filtering
// itself works at daily granularity using "Data Nascimento" (DATAS/DN), so picking
// a single day in the range picker really shows just that one day.
function addDays(dateStr, days){
  const d = new Date(dateStr+'T00:00:00');
  d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10);
}
const LAST_SEMANA_MON = SEMANAS[SEMANAS.length-1];
const LAST_SEMANA_SUN = addDays(LAST_SEMANA_MON, 6);
const FULL_SEMANA_DE = DATAS[0];
const FULL_SEMANA_ATE = DATAS[DATAS.length-1];
const ULTIMO_DIA = DATAS[DATAS.length-1]; // dia mais recente com dados

const state = {
  anos: new Set(ANOS),
  meses: new Set(MESES),
  linhg: new Set(LINHGS),
  tipo: new Set(TIPOS),
  faz: new Set(FAZENDAS),
  lote: new Set(LOTES),
  semanaDe: ULTIMO_DIA,
  semanaAte: ULTIMO_DIA,
};

/* ---------- 4. Build sidebar filter chips ---------- */
function buildChips(containerId, values, selectedSet, labelFn, onChange){
  const el = document.getElementById(containerId);
  el.innerHTML = '';
  values.forEach(v=>{
    const chip = document.createElement('div');
    chip.className = 'chip' + (selectedSet.has(v) ? ' active' : '');
    chip.textContent = labelFn ? labelFn(v) : v;
    chip.dataset.val = v;
    chip.addEventListener('click', ()=>{
      if (selectedSet.has(v)) selectedSet.delete(v); else selectedSet.add(v);
      chip.classList.toggle('active');
      onChange();
    });
    el.appendChild(chip);
  });
}

buildChips('chipAno', ANOS, state.anos, null, refresh);
buildChips('chipMes', MESES, state.meses, m=>MES_NOMES[m-1], refresh);
buildChips('chipLinhg', LINHGS, state.linhg, null, refresh);
buildChips('chipTipo', TIPOS, state.tipo, null, refresh);

/* ---------- Dropdown filters (Fazenda, Lote) ---------- */
function makeDropdownFilter(cfg){
  // cfg: {btnId, listId, searchId, dropId, values, stateSet, allLabel, noneLabel}
  const btn = document.getElementById(cfg.btnId);
  function updateLabel(){
    const n = cfg.stateSet.size, total = cfg.values.length;
    if (n === total) btn.textContent = cfg.allLabel;
    else if (n === 0) btn.textContent = cfg.noneLabel;
    else if (n <= 2) btn.textContent = Array.from(cfg.stateSet).join(', ');
    else btn.textContent = n + ' selecionados';
  }
  function buildList(){
    const el = document.getElementById(cfg.listId);
    el.innerHTML = '';
    cfg.values.forEach(v=>{
      const item = document.createElement('label');
      item.className = 'dropdown-item';
      item.dataset.val = v;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = cfg.stateSet.has(v);
      cb.addEventListener('change', ()=>{
        if (cb.checked) cfg.stateSet.add(v); else cfg.stateSet.delete(v);
        updateLabel();
        refresh();
      });
      const txt = document.createElement('span');
      txt.textContent = v;
      item.appendChild(cb);
      item.appendChild(txt);
      el.appendChild(item);
    });
  }
  buildList();
  updateLabel();
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    document.getElementById(cfg.dropId).classList.toggle('open');
  });
  document.addEventListener('click', (e)=>{
    const dd = document.getElementById(cfg.dropId);
    if (dd.classList.contains('open') && !dd.contains(e.target)) dd.classList.remove('open');
  });
  document.getElementById(cfg.searchId).addEventListener('input', (e)=>{
    const q = e.target.value.trim().toLowerCase();
    document.querySelectorAll('#'+cfg.listId+' .dropdown-item').forEach(c=>{
      c.style.display = c.dataset.val.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  return { updateLabel, buildList };
}

const fazFilter = makeDropdownFilter({
  btnId:'fazDropdownBtn', listId:'chipFaz', searchId:'fazSearch', dropId:'fazDropdown',
  values:FAZENDAS_SORTED, stateSet:state.faz, allLabel:'Todas as fazendas', noneLabel:'Nenhuma fazenda selecionada'
});
const loteFilter = makeDropdownFilter({
  btnId:'loteDropdownBtn', listId:'chipLote', searchId:'loteSearch', dropId:'loteDropdown',
  values:LOTES_SORTED, stateSet:state.lote, allLabel:'Todos os lotes', noneLabel:'Nenhum lote selecionado'
});

/* ---------- todos / limpar handlers ---------- */
document.querySelectorAll('.mini-btn').forEach(btn=>{
  btn.addEventListener('click', (e)=>{
    e.stopPropagation();
    const act = btn.dataset.act;

    if (act === 'clear-semana'){
      state.semanaDe = FULL_SEMANA_DE;
      state.semanaAte = FULL_SEMANA_ATE;
      document.getElementById('semanaDe').value = state.semanaDe;
      document.getElementById('semanaAte').value = state.semanaAte;
      refresh();
      return;
    }

    if (act === 'all-faz' || act === 'clear-faz'){
      if (act === 'all-faz') FAZENDAS_SORTED.forEach(v=>state.faz.add(v));
      else state.faz.clear();
      document.querySelectorAll('#chipFaz .dropdown-item input').forEach(cb=>{
        cb.checked = state.faz.has(cb.closest('.dropdown-item').dataset.val);
      });
      fazFilter.updateLabel();
      refresh();
      return;
    }

    if (act === 'all-lote' || act === 'clear-lote'){
      if (act === 'all-lote') LOTES_SORTED.forEach(v=>state.lote.add(v));
      else state.lote.clear();
      document.querySelectorAll('#chipLote .dropdown-item input').forEach(cb=>{
        cb.checked = state.lote.has(cb.closest('.dropdown-item').dataset.val);
      });
      loteFilter.updateLabel();
      refresh();
      return;
    }

    const map = {
      'all-ano':['chipAno', state.anos, ANOS], 'clear-ano':['chipAno', state.anos, ANOS],
      'all-mes':['chipMes', state.meses, MESES], 'clear-mes':['chipMes', state.meses, MESES],
      'all-linhg':['chipLinhg', state.linhg, LINHGS], 'clear-linhg':['chipLinhg', state.linhg, LINHGS],
      'all-tipo':['chipTipo', state.tipo, TIPOS], 'clear-tipo':['chipTipo', state.tipo, TIPOS],
    };
    const [contId, set, all] = map[act];
    if (act.startsWith('all-')) all.forEach(v=>set.add(v));
    else set.clear();
    document.querySelectorAll('#'+contId+' .chip').forEach(c=>{
      c.classList.toggle('active', set.has(isNaN(c.dataset.val) ? c.dataset.val : +c.dataset.val));
    });
    refresh();
  });
});

document.getElementById('semanaDe').value = state.semanaDe;
document.getElementById('semanaAte').value = state.semanaAte;
document.getElementById('semanaDe').min = FULL_SEMANA_DE;
document.getElementById('semanaDe').max = FULL_SEMANA_ATE;
document.getElementById('semanaAte').min = FULL_SEMANA_DE;
document.getElementById('semanaAte').max = FULL_SEMANA_ATE;
document.getElementById('semanaDe').addEventListener('change', e=>{ state.semanaDe = e.target.value; refresh(); });
document.getElementById('semanaAte').addEventListener('change', e=>{ state.semanaAte = e.target.value; refresh(); });

document.getElementById('resetBtn').addEventListener('click', ()=>{
  state.anos = new Set(ANOS);
  state.meses = new Set(MESES);
  state.linhg = new Set(LINHGS);
  state.tipo = new Set(TIPOS);
  state.faz.clear(); FAZENDAS.forEach(v=>state.faz.add(v));
  state.lote.clear(); LOTES.forEach(v=>state.lote.add(v));
  state.semanaDe = ULTIMO_DIA;
  state.semanaAte = ULTIMO_DIA;
  document.getElementById('fazSearch').value='';
  document.getElementById('loteSearch').value='';
  document.querySelectorAll('#chipFaz .dropdown-item, #chipLote .dropdown-item').forEach(c=>c.style.display='');
  buildChips('chipAno', ANOS, state.anos, null, refresh);
  buildChips('chipMes', MESES, state.meses, m=>MES_NOMES[m-1], refresh);
  buildChips('chipLinhg', LINHGS, state.linhg, null, refresh);
  buildChips('chipTipo', TIPOS, state.tipo, null, refresh);
  document.querySelectorAll('#chipFaz .dropdown-item input').forEach(cb=>cb.checked = true);
  document.querySelectorAll('#chipLote .dropdown-item input').forEach(cb=>cb.checked = true);
  fazFilter.updateLabel();
  loteFilter.updateLabel();
  document.getElementById('semanaDe').value = state.semanaDe;
  document.getElementById('semanaAte').value = state.semanaAte;
  refresh();
});

document.getElementById('bienalMetric').addEventListener('change', refresh);

/* ---------- Bienal fixed chart (dedicated year filter, independent of sidebar) ---------- */
const bienalFixedState = { years: new Set(ANOS.slice(-2)) };
const BIENAL_BAR_COLORS  = [COL.blue, COL.orange, COL.green, COL.purple, COL.grayDark, COL.lightblue];
const BIENAL_LINE_COLORS = [COL.red, COL.gold, COL.blueDark, COL.orangeDark, COL.greenDark, COL.gray];

function buildBienalAnoChips(){
  buildChips('chipBienalAno', ANOS, bienalFixedState.years, null, renderBienalFixed);
}
buildBienalAnoChips();

document.querySelectorAll('[data-act="all-bienal-ano"], [data-act="clear-bienal-ano"]').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    if (btn.dataset.act === 'all-bienal-ano') ANOS.forEach(v=>bienalFixedState.years.add(v));
    else bienalFixedState.years.clear();
    buildBienalAnoChips();
    renderBienalFixed();
  });
});

function getIndicesIgnoringDateFilters(){
  const idx = [];
  for (let i=0;i<N;i++){
    if (!state.linhg.has(LINHGS[LG[i]])) continue;
    if (!state.tipo.has(TIPOS[TO[i]])) continue;
    if (!state.faz.has(FAZENDAS[F[i]])) continue;
    if (!state.lote.has(LOTES[L[i]])) continue;
    idx.push(i);
  }
  return idx;
}

function renderBienalFixed(){
  const base = getIndicesIgnoringDateFilters();
  const years = Array.from(bienalFixedState.years).sort((a,b)=>a-b);

  if (years.length === 0){
    chBienalFixed.data.datasets = [];
    chBienalFixed.update();
    document.getElementById('bienalTable').innerHTML = '<tr><td class="empty-state">Selecione ao menos um ano.</td></tr>';
    return;
  }

  // pre-group base indices by ano|mes for fast lookup
  const g = groupBy(base, i => AN[i]+'|'+ME[i]);
  const perYear = years.map(yr=>{
    const vend = [], iev = [];
    MESES.forEach(m=>{
      const ids = g.get(yr+'|'+m);
      if (!ids || ids.length===0){ vend.push(null); iev.push(null); return; }
      const ti = sumField(ids, TI);
      vend.push(ti>0 ? +pct(sumField(ids,TV), ti).toFixed(1) : null);
      iev.push(ti>0 ? +weightedAvg(ids, IEV, TI).toFixed(1) : null);
    });
    return { yr, vend, iev };
  });

  const datasets = [];
  perYear.forEach((py, i)=>{
    datasets.push({
      type:'bar', label:'%Vend. - '+py.yr, data:py.vend,
      backgroundColor: BIENAL_BAR_COLORS[i % BIENAL_BAR_COLORS.length],
      yAxisID:'y', borderRadius:3, order:2,
      datalabels:{
        display:true, color:'#1F2430', anchor:'center', align:'center', rotation:-90,
        font:{size:9.5, weight:'700'},
        formatter:v=> v===null ? '' : fmt(v,1)
      }
    });
  });
  perYear.forEach((py, i)=>{
    datasets.push({
      type:'line', label:'IEV - '+py.yr, data:py.iev,
      borderColor: BIENAL_LINE_COLORS[i % BIENAL_LINE_COLORS.length],
      backgroundColor: BIENAL_LINE_COLORS[i % BIENAL_LINE_COLORS.length],
      yAxisID:'y1', tension:.35, pointRadius:3, borderWidth:2.5, spanGaps:true, order:1,
      datalabels:{display:false}
    });
  });

  chBienalFixed.data.labels = MES_NOMES.map(m=>m.toLowerCase());
  chBienalFixed.data.datasets = datasets;
  chBienalFixed.update();

  // ---- table ----
  let html = '<tr><th class="rowlabel"></th>' + MES_NOMES.map(m=>`<th>${m.toLowerCase()}</th>`).join('') + '</tr>';
  perYear.forEach((py,i)=>{
    html += `<tr><td class="rowname"><span class="swatch" style="background:${BIENAL_BAR_COLORS[i % BIENAL_BAR_COLORS.length]}"></span>%Vend. - ${py.yr}</td>`;
    html += py.vend.map(v=> `<td>${v===null?'':fmt(v,1)}</td>`).join('');
    html += '</tr>';
  });
  perYear.forEach((py,i)=>{
    html += `<tr><td class="rowname"><span class="swatch" style="background:${BIENAL_LINE_COLORS[i % BIENAL_LINE_COLORS.length]}"></span>IEV - ${py.yr}</td>`;
    html += py.iev.map(v=> `<td>${v===null?'':fmt(v,1)}</td>`).join('');
    html += '</tr>';
  });
  document.getElementById('bienalTable').innerHTML = html;
}

/* ---------- 5. Filtering engine ---------- */
// Filtering by "Data Nascimento" (daily) gives real day-level granularity;
// string comparison works because dates are formatted 'YYYY-MM-DD'.
function getFilteredIndices(){
  const idx = [];
  const de = state.semanaDe, ate = state.semanaAte;
  for (let i=0;i<N;i++){
    if (!state.anos.has(AN[i])) continue;
    if (!state.meses.has(ME[i])) continue;
    const d = DATAS[DN[i]];
    if (d < de || d > ate) continue;
    if (!state.linhg.has(LINHGS[LG[i]])) continue;
    if (!state.tipo.has(TIPOS[TO[i]])) continue;
    if (!state.faz.has(FAZENDAS[F[i]])) continue;
    if (!state.lote.has(LOTES[L[i]])) continue;
    idx.push(i);
  }
  return idx;
}

/* ---------- 6. Aggregation helpers ---------- */
function sumField(idx, arr){
  let s=0; for (let k=0;k<idx.length;k++) s += arr[idx[k]];
  return s;
}
function weightedAvg(idx, arr, wArr){
  let s=0, w=0;
  for (let k=0;k<idx.length;k++){ const wi = wArr[idx[k]]; s += arr[idx[k]]*wi; w += wi; }
  return w>0 ? s/w : 0;
}
function groupBy(idx, keyFn){
  const map = new Map();
  for (let k=0;k<idx.length;k++){
    const i = idx[k];
    const key = keyFn(i);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(i);
  }
  return map;
}
function pct(n,d){ return d>0 ? (n/d*100) : 0; }
function fmt(n, dec){
  if (n===undefined||n===null||isNaN(n)) return '—';
  return n.toLocaleString('pt-BR', {minimumFractionDigits:dec, maximumFractionDigits:dec});
}
function fmtInt(n){
  return Math.round(n).toLocaleString('pt-BR');
}

/* ---------- 7. Chart.js common config ---------- */
const gridColor = '#EEF0F3';
function baseScales(extra){
  return Object.assign({
    x:{ grid:{display:false}, ticks:{font:{size:10.5}} },
    y:{ grid:{color:gridColor}, ticks:{font:{size:10.5}} }
  }, extra||{});
}

/* ---------- 8. Chart instances ---------- */
let chDonutLinhg, chLinhgPerf, chTipoOvo, chDescarte, chWeeklyVend, chWeeklyDescarte,
    chBienal, chBienalFixed, chRankIEV, chRankVend, chRankFazenda, chScatter, chMixAno;

const $ = id => document.getElementById(id);

function initCharts(){
  chDonutLinhg = new Chart($('chartDonutLinhg'), {
    type:'doughnut',
    data:{labels:[], datasets:[{data:[], backgroundColor:[], borderWidth:2, borderColor:'#fff'}]},
    options:{
      cutout:'58%',
      plugins:{
        legend:{position:'bottom'},
        tooltip:{ callbacks:{ label:(ctx)=>{
          const d = ctx.dataset.meta[ctx.dataIndex];
          return ` ${ctx.label}: ${fmt(d.share,1)}% do total · %Vend ${fmt(d.pctVend,1)}% · IEV ${fmt(d.iev,1)}`;
        }}},
        datalabels:{
          display:true, color:'#fff', font:{weight:'700',size:10.5},
          formatter:(v,ctx)=>{
            const d = ctx.dataset.meta[ctx.dataIndex];
            return d.share>=4 ? fmt(d.share,0)+'%' : '';
          }
        }
      }
    }
  });

  chLinhgPerf = new Chart($('chartLinhgPerf'), {
    type:'bar',
    data:{labels:[], datasets:[
      {type:'bar', label:'%Vendáveis', backgroundColor:COL.blue, data:[], yAxisID:'y', borderRadius:4, order:2},
      {type:'bar', label:'%Eclosão', backgroundColor:COL.orange, data:[], yAxisID:'y', borderRadius:4, order:2},
      {type:'line', label:'IEV médio', borderColor:COL.gold, backgroundColor:COL.gold, data:[], yAxisID:'y1', tension:.3, pointRadius:3, order:1}
    ]},
    options:{
      scales:{
        x:{grid:{display:false}},
        y:{position:'left', grid:{color:gridColor}, title:{display:true,text:'%',font:{size:10}}},
        y1:{position:'right', grid:{display:false}, title:{display:true,text:'IEV',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });

  chTipoOvo = new Chart($('chartTipoOvo'), {
    type:'bar',
    data:{labels:[], datasets:[
      {type:'bar', label:'Idade matriz média (sem.)', backgroundColor:COL.orange, data:[], yAxisID:'y', borderRadius:4, order:2},
      {type:'bar', label:'%Vendáveis', backgroundColor:COL.blue, data:[], yAxisID:'y1', borderRadius:4, order:2},
      {type:'line', label:'% do total incubado', borderColor:COL.goldDark, backgroundColor:COL.gold, data:[], yAxisID:'y1', tension:.3, pointRadius:3, order:1}
    ]},
    options:{
      scales:{
        x:{grid:{display:false}},
        y:{position:'left', grid:{color:gridColor}, title:{display:true,text:'semanas',font:{size:10}}},
        y1:{position:'right', grid:{display:false}, min:0, max:100, title:{display:true,text:'%',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });

  chDescarte = new Chart($('chartDescarte'), {
    type:'bar',
    data:{labels:['%Contaminados','%Eliminados','%Nasc. mortos'], datasets:[
      {label:'Período selecionado', backgroundColor:[COL.blue, COL.orange, COL.red], data:[], borderRadius:5},
      {label:'Média histórica (base completa)', backgroundColor:'#D9DCE3', data:[], borderRadius:5}
    ]},
    options:{
      scales: baseScales(),
      plugins:{legend:{position:'bottom'}, datalabels:{display:true, anchor:'end', align:'top', color:'#4B5160', font:{size:10,weight:'700'}, formatter:v=>fmt(v,2)+'%'}}
    }
  });

  chWeeklyVend = new Chart($('chartWeeklyVend'), {
    type:'bar',
    data:{labels:[], datasets:[
      {type:'bar', label:'IEV médio', backgroundColor:COL.lightblue, data:[], yAxisID:'y1', borderRadius:3, barPercentage:.7, order:2},
      {type:'line', label:'%Vendáveis', borderColor:COL.red, backgroundColor:COL.red, data:[], yAxisID:'y', tension:.25, pointRadius:2, borderWidth:2, order:1}
    ]},
    options:{
      scales:{
        x:{grid:{display:false}, ticks:{maxRotation:60, minRotation:60, autoSkip:true, maxTicksLimit:24, font:{size:9.5}}},
        y:{position:'left', grid:{color:gridColor}, title:{display:true,text:'% Vendáveis',font:{size:10}}},
        y1:{position:'right', grid:{display:false}, title:{display:true,text:'IEV',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });

  chWeeklyDescarte = new Chart($('chartWeeklyDescarte'), {
    type:'line',
    data:{labels:[], datasets:[
      {label:'%Contaminados', borderColor:COL.blue, backgroundColor:COL.blue, data:[], tension:.25, pointRadius:1.5, borderWidth:2},
      {label:'%Eliminados', borderColor:COL.orange, backgroundColor:COL.orange, data:[], tension:.25, pointRadius:1.5, borderWidth:2},
      {label:'%Nasc. mortos', borderColor:COL.red, backgroundColor:COL.red, data:[], tension:.25, pointRadius:1.5, borderWidth:2}
    ]},
    options:{
      scales:{
        x:{grid:{display:false}, ticks:{maxRotation:60, minRotation:60, autoSkip:true, maxTicksLimit:24, font:{size:9.5}}},
        y:{grid:{color:gridColor}, title:{display:true,text:'%',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });

  chBienal = new Chart($('chartBienal'), {
    type:'line',
    data:{labels:MES_NOMES, datasets:[]},
    options:{
      scales: baseScales(),
      plugins:{legend:{position:'bottom'}}
    }
  });

  chBienalFixed = new Chart($('chartBienalFixed'), {
    type:'bar',
    data:{labels:[], datasets:[]},
    options:{
      scales:{
        x:{grid:{display:false}},
        y:{position:'left', grid:{color:gridColor}, min:0, max:100, title:{display:true,text:'%Vendáveis',font:{size:10}}},
        y1:{position:'right', grid:{display:false}, min:0, title:{display:true,text:'IEV',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });

  chRankIEV = new Chart($('chartRankIEV'), {
    type:'bar',
    data:{labels:[], datasets:[{label:'IEV médio', backgroundColor:COL.blue, data:[], borderRadius:4}]},
    options:{
      indexAxis:'y',
      scales:{ x:{grid:{color:gridColor}}, y:{grid:{display:false}, ticks:{font:{size:10}}} },
      plugins:{legend:{display:false}, datalabels:{display:true, color:'#fff', anchor:'center', align:'center', font:{size:10.5,weight:'700'}, formatter:v=>fmt(v,1)}}
    }
  });

  chRankVend = new Chart($('chartRankVend'), {
    type:'bar',
    data:{labels:[], datasets:[{label:'%Vendáveis', backgroundColor:COL.green, data:[], borderRadius:4}]},
    options:{
      indexAxis:'y',
      scales:{ x:{grid:{color:gridColor}, max:100}, y:{grid:{display:false}, ticks:{font:{size:10}}} },
      plugins:{legend:{display:false}, datalabels:{
        display:true, color:'#fff', anchor:'center', align:'center', font:{size:9.5,weight:'700'},
        formatter:(v,ctx)=>{
          const idade = ctx.dataset.meta[ctx.dataIndex].idade;
          return 'Idade '+fmt(idade,0);
        }
      }, tooltip:{callbacks:{label:(ctx)=> ' %Vendáveis: '+fmt(ctx.parsed.x,1)+'%'}}}
    }
  });

  chRankFazenda = new Chart($('chartRankFazenda'), {
    type:'bar',
    data:{labels:[], datasets:[{label:'%Vendáveis', backgroundColor:COL.orange, data:[], borderRadius:4}]},
    options:{
      indexAxis:'y',
      scales:{ x:{grid:{color:gridColor}, max:100}, y:{grid:{display:false}, ticks:{font:{size:10}}} },
      plugins:{legend:{display:false}, datalabels:{display:true, color:'#fff', anchor:'center', align:'center', font:{size:10.5,weight:'700'}, formatter:v=>fmt(v,1)+'%'}}
    }
  });

  chScatter = new Chart($('chartScatter'), {
    type:'bubble',
    data:{datasets:[]},
    options:{
      scales:{
        x:{title:{display:true,text:'Idade média da matriz (semanas)',font:{size:10}}, grid:{color:gridColor}},
        y:{title:{display:true,text:'%Vendáveis',font:{size:10}}, grid:{color:gridColor}}
      },
      plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{label:(ctx)=>{
        const d = ctx.raw;
        return ` ${d.label}: idade ${fmt(d.x,1)} sem · %Vend ${fmt(d.y,1)}% · ${fmtInt(d.vol)} ovos`;
      }}}}
    }
  });

  chMixAno = new Chart($('chartMixAno'), {
    type:'bar',
    data:{labels:[], datasets:[]},
    options:{
      scales:{
        x:{grid:{display:false}, stacked:true},
        y:{grid:{color:gridColor}, stacked:true, max:100, title:{display:true,text:'% do total incubado',font:{size:10}}}
      },
      plugins:{legend:{position:'bottom'}}
    }
  });
}

/* ---------- 9. KPI cards ---------- */
const KPI_DEFS = [
  {key:'ti', label:'Ovos incubados', accent:COL.blue, unit:''},
  {key:'tn', label:'Total nascidos', accent:COL.orange, unit:''},
  {key:'tv', label:'Pintos vendáveis', accent:COL.green, unit:''},
  {key:'pctVend', label:'% Vendáveis', accent:COL.green, unit:'%'},
  {key:'pctEcl', label:'% Eclosão', accent:COL.orange, unit:'%'},
  {key:'iev', label:'IEV médio', accent:COL.gold, unit:''},
  {key:'iee', label:'IEE médio', accent:COL.gold, unit:''},
  {key:'pctElim', label:'% Eliminados', accent:COL.red, unit:'%'},
  {key:'pctCont', label:'% Contaminados', accent:COL.blueDark, unit:'%'},
  {key:'pctNM', label:'% Nasc. mortos', accent:COL.grayDark, unit:'%'},
];
function buildKpiGrid(){
  const el = $('kpiGrid');
  el.innerHTML = '';
  KPI_DEFS.forEach(d=>{
    const card = document.createElement('div');
    card.className = 'kpi-card';
    card.style.setProperty('--accent', d.accent);
    card.innerHTML = `<div class="kpi-label">${d.label}</div><div class="kpi-value" id="kpi_${d.key}">—</div>`;
    el.appendChild(card);
  });
}

/* ---------- 10. Historical (unfiltered) baseline for descarte comparison ---------- */
const ALL_IDX = Array.from({length:N}, (_,i)=>i);
const histTi = sumField(ALL_IDX, TI);
const histBaseline = {
  cont: pct(sumField(ALL_IDX,CT), histTi),
  elim: pct(sumField(ALL_IDX,EL), histTi),
  nm:   pct(sumField(ALL_IDX,NM), histTi),
};

/* ---------- 11. Main refresh routine ---------- */
function refresh(){
  const idx = getFilteredIndices();
  $('recCountNum').textContent = idx.length.toLocaleString('pt-BR');

  if (idx.length === 0){
    Object.keys(KPI_DEFS).forEach(()=>{});
    KPI_DEFS.forEach(d=>{ const e=$('kpi_'+d.key); if(e) e.textContent='—'; });
    $('periodBadge').textContent = 'sem dados para os filtros selecionados';
    return;
  }

  // ---- period badge ----
  // 'semana' values are the Monday of each week bucket; the true span of data
  // for the last week goes through the following Sunday, so add 6 days to the end.
  // ---- period badge ---- (based on real daily "Data Nascimento", not the weekly bucket)
  let minDn = Infinity, maxDn = -Infinity;
  for (let k=0;k<idx.length;k++){ const d=DN[idx[k]]; if(d<minDn)minDn=d; if(d>maxDn)maxDn=d; }
  const periodStart = DATAS[minDn];
  const periodEnd = DATAS[maxDn];
  $('periodBadge').textContent = periodStart+' a '+periodEnd;

  // ---- KPIs ----
  const totTi = sumField(idx, TI), totTn = sumField(idx, TN), totTv = sumField(idx, TV);
  const totEl = sumField(idx, EL), totCt = sumField(idx, CT), totNm = sumField(idx, NM);
  const kpis = {
    ti: totTi, tn: totTn, tv: totTv,
    pctVend: pct(totTv, totTi), pctEcl: pct(totTn, totTi),
    iev: weightedAvg(idx, IEV, TI), iee: weightedAvg(idx, IEE, TI),
    pctElim: pct(totEl, totTi), pctCont: pct(totCt, totTi), pctNM: pct(totNm, totTi)
  };
  KPI_DEFS.forEach(d=>{
    const v = kpis[d.key];
    const dec = (d.key==='ti'||d.key==='tn'||d.key==='tv') ? 0 : (d.key==='iev'||d.key==='iee' ? 1 : 2);
    const txt = (d.key==='ti'||d.key==='tn'||d.key==='tv') ? fmtInt(v) : fmt(v,dec)+d.unit;
    $('kpi_'+d.key).textContent = txt;
  });

  // ---- Donut by linhagem (share of Ovos Incubados) ----
  {
    const g = groupBy(idx, i=>LG[i]);
    const entries = Array.from(g.entries()).map(([lgIdx, ids])=>{
      const lg = LINHGS[lgIdx];
      const ti = sumField(ids, TI);
      return {
        lg, ti,
        share: pct(ti, totTi),
        pctVend: pct(sumField(ids,TV), ti),
        iev: weightedAvg(ids, IEV, TI)
      };
    }).sort((a,b)=>b.ti-a.ti);
    chDonutLinhg.data.labels = entries.map(e=>e.lg);
    chDonutLinhg.data.datasets[0].data = entries.map(e=>e.ti);
    chDonutLinhg.data.datasets[0].backgroundColor = entries.map(e=>LINHG_COLORS[e.lg]);
    chDonutLinhg.data.datasets[0].meta = entries;
    chDonutLinhg.update();
  }

  // ---- Linhagem performance combo ----
  {
    const g = groupBy(idx, i=>LG[i]);
    const entries = Array.from(g.entries()).map(([lgIdx, ids])=>{
      const lg = LINHGS[lgIdx];
      const ti = sumField(ids, TI);
      return { lg, pctVend: pct(sumField(ids,TV),ti), pctEcl: pct(sumField(ids,TN),ti), iev: weightedAvg(ids,IEV,TI), ti };
    }).sort((a,b)=>b.ti-a.ti);
    chLinhgPerf.data.labels = entries.map(e=>e.lg);
    chLinhgPerf.data.datasets[0].data = entries.map(e=>+e.pctVend.toFixed(1));
    chLinhgPerf.data.datasets[1].data = entries.map(e=>+e.pctEcl.toFixed(1));
    chLinhgPerf.data.datasets[2].data = entries.map(e=>+e.iev.toFixed(1));
    chLinhgPerf.update();
  }

  // ---- Tipo de ovo combo ----
  {
    const g = groupBy(idx, i=>TO[i]);
    let entries = Array.from(g.entries()).map(([toIdx, ids])=>{
      const tipo = TIPOS[toIdx];
      const ti = sumField(ids, TI);
      return { tipo, ti, idade: weightedAvg(ids, AM, TI), pctVend: pct(sumField(ids,TV),ti), share: pct(ti, totTi) };
    }).sort((a,b)=>b.ti-a.ti);
    entries.push({ tipo:'Total Geral', ti: totTi, idade: weightedAvg(idx,AM,TI), pctVend: pct(totTv,totTi), share:100 });
    chTipoOvo.data.labels = entries.map(e=>e.tipo);
    chTipoOvo.data.datasets[0].data = entries.map(e=>+e.idade.toFixed(1));
    chTipoOvo.data.datasets[1].data = entries.map(e=>+e.pctVend.toFixed(1));
    chTipoOvo.data.datasets[2].data = entries.map(e=>+e.share.toFixed(1));
    chTipoOvo.update();
  }

  // ---- Descarte comparison ----
  {
    chDescarte.data.datasets[0].data = [kpis.pctCont, kpis.pctElim, kpis.pctNM].map(v=>+v.toFixed(3));
    chDescarte.data.datasets[1].data = [histBaseline.cont, histBaseline.elim, histBaseline.nm].map(v=>+v.toFixed(3));
    chDescarte.update();
  }

  // ---- Weekly trends ----
  {
    const g = groupBy(idx, i=>SM[i]);
    const weeks = Array.from(g.keys()).sort((a,b)=>a-b);
    const labels = weeks.map(w=>{
      const [y,m,d] = SEMANAS[w].split('-');
      return d+'/'+m+'/'+y.slice(2);
    });
    const ievArr=[], vendArr=[], contArr=[], elimArr=[], nmArr=[];
    weeks.forEach(w=>{
      const ids = g.get(w);
      const ti = sumField(ids, TI);
      ievArr.push(+weightedAvg(ids,IEV,TI).toFixed(1));
      vendArr.push(+pct(sumField(ids,TV),ti).toFixed(1));
      contArr.push(+pct(sumField(ids,CT),ti).toFixed(3));
      elimArr.push(+pct(sumField(ids,EL),ti).toFixed(3));
      nmArr.push(+pct(sumField(ids,NM),ti).toFixed(3));
    });
    chWeeklyVend.data.labels = labels;
    chWeeklyVend.data.datasets[0].data = ievArr;
    chWeeklyVend.data.datasets[1].data = vendArr;
    chWeeklyVend.update();

    chWeeklyDescarte.data.labels = labels;
    chWeeklyDescarte.data.datasets[0].data = contArr;
    chWeeklyDescarte.data.datasets[1].data = elimArr;
    chWeeklyDescarte.data.datasets[2].data = nmArr;
    chWeeklyDescarte.update();
  }

  // ---- Bienal comparison (year lines by month) ----
  {
    const metric = $('bienalMetric').value;
    const g = groupBy(idx, i=> AN[i]+'-'+ME[i]);
    const yearsPresent = Array.from(new Set(idx.map(i=>AN[i]))).sort((a,b)=>a-b);
    const palette = ['#4472C4','#ED7D31','#A5A5A5','#FFC000','#70AD47','#8E44AD','#5B9BD5','#C00000','#548235','#264478'];
    const datasets = yearsPresent.map((yr,i)=>{
      const data = MESES.map(m=>{
        const ids = g.get(yr+'-'+m);
        if (!ids) return null;
        const ti = sumField(ids, TI);
        if (metric==='pctVend') return +pct(sumField(ids,TV),ti).toFixed(1);
        if (metric==='pctEcl') return +pct(sumField(ids,TN),ti).toFixed(1);
        if (metric==='iev') return +weightedAvg(ids,IEV,TI).toFixed(1);
        if (metric==='pctElim') return +pct(sumField(ids,EL),ti).toFixed(3);
        return null;
      });
      return {
        label:String(yr), data, borderColor:palette[i%palette.length], backgroundColor:palette[i%palette.length],
        tension:.3, spanGaps:true, pointRadius:2.5, borderWidth: (i===yearsPresent.length-1)?3:2
      };
    });
    chBienal.data.datasets = datasets;
    chBienal.update();
  }

  // ---- Heatmap Ano x Mês %Vendáveis ----
  {
    const g = groupBy(idx, i=> AN[i]+'-'+ME[i]);
    const yearsPresent = Array.from(new Set(idx.map(i=>AN[i]))).sort((a,b)=>a-b);
    let html = '<tr><th class="rowlabel"></th>' + MES_NOMES.map(m=>`<th>${m}</th>`).join('') + '</tr>';
    // compute color scale bounds
    let vals = [];
    yearsPresent.forEach(yr=>MESES.forEach(m=>{
      const ids = g.get(yr+'-'+m);
      if (ids){ const ti=sumField(ids,TI); vals.push(pct(sumField(ids,TV),ti)); }
    }));
    const vmin = vals.length? Math.min(...vals) : 0, vmax = vals.length? Math.max(...vals) : 100;
    function colorFor(v){
      if (v===null) return null;
      const t = vmax>vmin ? (v-vmin)/(vmax-vmin) : .5;
      // red -> gold -> green
      const stops = [[192,0,0],[255,192,0],[112,173,71]];
      const seg = t<0.5 ? [stops[0],stops[1],t/0.5] : [stops[1],stops[2],(t-0.5)/0.5];
      const [c1,c2,f] = seg;
      const r = Math.round(c1[0]+(c2[0]-c1[0])*f);
      const gC = Math.round(c1[1]+(c2[1]-c1[1])*f);
      const b = Math.round(c1[2]+(c2[2]-c1[2])*f);
      return `rgb(${r},${gC},${b})`;
    }
    yearsPresent.forEach(yr=>{
      html += `<tr><td class="rowlabel">${yr}</td>`;
      MESES.forEach(m=>{
        const ids = g.get(yr+'-'+m);
        if (!ids){ html += '<td class="empty">—</td>'; return; }
        const ti = sumField(ids,TI);
        const v = pct(sumField(ids,TV),ti);
        html += `<td style="background:${colorFor(v)}">${fmt(v,1)}</td>`;
      });
      html += '</tr>';
    });
    $('heatmapTable').innerHTML = html;
  }

  // ---- Ranking IEV (top 15 lotes) ----
  {
    const g = groupBy(idx, i=> F[i]+'|'+L[i]+'|'+LG[i]);
    let entries = Array.from(g.entries()).map(([key, ids])=>{
      const [fIdx,lIdx,lgIdx] = key.split('|').map(Number);
      const ti = sumField(ids, TI);
      return { label: `${FAZENDAS[fIdx]}-${LOTES[lIdx]}-${LINHGS[lgIdx]}`, iev: weightedAvg(ids,IEV,TI), ti };
    }).filter(e=>e.ti>0);
    entries.sort((a,b)=>b.iev-a.iev);
    entries = entries.slice(0,15);
    chRankIEV.data.labels = entries.map(e=>e.label);
    chRankIEV.data.datasets[0].data = entries.map(e=>+e.iev.toFixed(1));
    chRankIEV.update();
  }

  // ---- Ranking %Vendáveis (top 15 lotes) with idade label ----
  {
    const g = groupBy(idx, i=> F[i]+'|'+L[i]+'|'+LG[i]);
    let entries = Array.from(g.entries()).map(([key, ids])=>{
      const [fIdx,lIdx,lgIdx] = key.split('|').map(Number);
      const ti = sumField(ids, TI);
      return { label: `${FAZENDAS[fIdx]}-${LOTES[lIdx]}-${LINHGS[lgIdx]}`, pctVend: pct(sumField(ids,TV),ti), idade: weightedAvg(ids,AM,TI), ti };
    }).filter(e=>e.ti>0);
    entries.sort((a,b)=>b.pctVend-a.pctVend);
    entries = entries.slice(0,15);
    chRankVend.data.labels = entries.map(e=>e.label);
    chRankVend.data.datasets[0].data = entries.map(e=>+e.pctVend.toFixed(1));
    chRankVend.data.datasets[0].meta = entries;
    chRankVend.update();
  }

  // ---- Ranking by Fazenda ----
  {
    const g = groupBy(idx, i=> F[i]);
    let entries = Array.from(g.entries()).map(([fIdx, ids])=>{
      const ti = sumField(ids, TI);
      return { label: FAZENDAS[fIdx], pctVend: pct(sumField(ids,TV),ti), ti };
    }).filter(e=>e.ti>0);
    entries.sort((a,b)=>b.pctVend-a.pctVend);
    entries = entries.slice(0,18);
    chRankFazenda.data.labels = entries.map(e=>e.label);
    chRankFazenda.data.datasets[0].data = entries.map(e=>+e.pctVend.toFixed(1));
    chRankFazenda.update();
  }

  // ---- Scatter idade x %vendaveis by lote, bubble=volume, color=linhagem ----
  {
    const g = groupBy(idx, i=> F[i]+'|'+L[i]+'|'+LG[i]);
    const byLinhg = {};
    g.forEach((ids, key)=>{
      const [fIdx,lIdx,lgIdx] = key.split('|').map(Number);
      const lg = LINHGS[lgIdx];
      const ti = sumField(ids, TI);
      if (ti<=0) return;
      const point = { x:+weightedAvg(ids,AM,TI).toFixed(1), y:+pct(sumField(ids,TV),ti).toFixed(1), r: Math.max(3, Math.min(22, Math.sqrt(ti)/22)), vol: ti, label:`${FAZENDAS[fIdx]}-${LOTES[lIdx]}-${lg}` };
      if (!byLinhg[lg]) byLinhg[lg]=[];
      byLinhg[lg].push(point);
    });
    chScatter.data.datasets = Object.keys(byLinhg).map(lg=>({
      label: lg, data: byLinhg[lg], backgroundColor: LINHG_COLORS[lg]+'B3', borderColor: LINHG_COLORS[lg], borderWidth:1
    }));
    chScatter.update();
  }

  // ---- Mix tipo de ovo por ano (stacked 100%) ----
  {
    const g = groupBy(idx, i=> AN[i]+'|'+TO[i]);
    const yearsPresent = Array.from(new Set(idx.map(i=>AN[i]))).sort((a,b)=>a-b);
    const tiByYear = {};
    yearsPresent.forEach(yr=>{ tiByYear[yr] = sumField(idx.filter(i=>AN[i]===yr), TI); });
    const palette = [COL.blue, COL.orange, COL.gold, COL.gray, COL.green, COL.purple];
    const datasets = TIPOS.map((tipo, toIdx)=>{
      const data = yearsPresent.map(yr=>{
        const ids = g.get(yr+'|'+toIdx);
        const ti = ids ? sumField(ids, TI) : 0;
        return +pct(ti, tiByYear[yr]).toFixed(1);
      });
      return { label: tipo, data, backgroundColor: palette[toIdx%palette.length], borderRadius:2 };
    });
    chMixAno.data.labels = yearsPresent.map(String);
    chMixAno.data.datasets = datasets;
    chMixAno.update();
  }

  // ---- Bienal fixed card (own year filter; respects linhagem/tipo/fazenda/lote only) ----
  if (typeof renderBienalFixed === 'function' && chBienalFixed) renderBienalFixed();
}

/* ---------- Boot ---------- */
buildKpiGrid();
initCharts();
refresh();
document.getElementById('loadingOverlay').style.display='none';

}
};
