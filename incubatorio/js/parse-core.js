/* Leitura e transformação do CSV da planilha (executa dentro do Web Worker). */

function parseCSV(text){
  var rows=[], row=[], field='', q=false;
  for(var i=0;i<text.length;i++){
    var c=text[i];
    if(q){
      if(c === '"'){ if(text[i+1]==='"'){ field+='"'; i++; } else q=false; }
      else field+=c;
    } else if(c === '"'){ q=true; }
    else if(c === ','){ row.push(field); field=''; }
    else if(c === '\n'){ row.push(field); rows.push(row); row=[]; field=''; }
    else if(c === '\r'){ /* ignora */ }
    else field+=c;
  }
  if(field.length||row.length){ row.push(field); rows.push(row); }
  return rows;
}

function num(v){
  if(v==null) return 0;
  var s=String(v).trim();
  if(!s) return 0;
  s=s.replace(/\s|%/g,'');
  if(s.indexOf(',')>=0) s=s.replace(/\./g,'').replace(',', '.');
  else if(/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}

function pad(n){ return n<10?'0'+n:''+n; }

/* Aceita "8/31/2026" (M/D/AAAA), "31/08/2026" (D/M/AAAA) e "2026-08-31". */
function parseDate(v){
  var s=String(v||'').trim();
  if(!s) return null;
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  var m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(m){
    var a=+m[1], b=+m[2], mes, dia;
    if(a>12){ dia=a; mes=b; } else { mes=a; dia=b; }
    return m[3]+'-'+pad(mes)+'-'+pad(dia);
  }
  var d=new Date(s);
  if(!isNaN(d.getTime())) return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  return null;
}

function mondayOf(iso){
  var d=new Date(iso+'T00:00:00');
  var wd=(d.getDay()+6)%7; // 0 = segunda-feira
  d.setDate(d.getDate()-wd);
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
}

function normHeader(h){
  return String(h||'').replace(/\s+/g,' ').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}

var COLMAP = {
  dataNasc:['data nascimento','data de nascimento','data nasc'],
  fazenda:['fazenda'],
  lote:['lote'],
  tipoOvo:['tipo ovo','tipo de ovo'],
  idadeMatriz:['idade matriz'],
  linhg:['linhg','linhagem'],
  diasEstoq:['dias estoq.','dias estoq','dias estoque'],
  totalInc:['total incubados','total incubado'],
  cont:['cont.','cont','contaminados'],
  totalNasc:['total nascidos','total nascido'],
  elim:['elim.','elim','eliminados'],
  nascMortos:['nasc. mortos','nasc mortos','nascidos mortos'],
  totalVend:['total vendaveis','total vendavel'],
  stdEcl:['% std eclosao','std eclosao'],
  difEcl:['% dif eclosao','dif eclosao'],
  iev:['iev'],
  iee:['iee']
};

function mapHeaders(header){
  var norm=header.map(normHeader), idx={}, key, i, aliases, a;
  for(key in COLMAP){
    idx[key]=-1;
    aliases=COLMAP[key];
    for(a=0;a<aliases.length;a++){
      i=norm.indexOf(aliases[a]);
      if(i>=0){ idx[key]=i; break; }
    }
  }
  return idx;
}

function buildDataset(csvText){
  var rows=parseCSV(csvText);
  if(!rows.length) throw new Error('A planilha retornou vazia.');
  var idx=mapHeaders(rows[0]);
  var faltando=Object.keys(COLMAP).filter(function(k){ return idx[k]<0; });
  if(faltando.length) throw new Error('Colunas não encontradas na planilha: '+faltando.join(', ')+'. Cabeçalhos recebidos: '+rows[0].join(' | '));

  var dict={semana:[],dataNasc:[],fazenda:[],lote:[],tipoOvo:[],linhg:[]};
  var maps={semana:{},dataNasc:{},fazenda:{},lote:{},tipoOvo:{},linhg:{}};
  function id(kind,val){
    var m=maps[kind], i=m[val];
    if(i===undefined){ i=dict[kind].length; m[val]=i; dict[kind].push(val); }
    return i;
  }

  var R={f:[],l:[],to:[],lg:[],sm:[],dn:[],am:[],ds:[],ti:[],ct:[],tn:[],el:[],nm:[],tv:[],iev:[],iee:[],se:[],df:[],an:[],me:[]};
  for(var r=1;r<rows.length;r++){
    var row=rows[r];
    if(!row || row.length<3) continue;
    var iso=parseDate(row[idx.dataNasc]);
    if(!iso) continue;
    var ti=num(row[idx.totalInc]);
    if(!ti) continue;
    R.dn.push(id('dataNasc',iso));
    R.sm.push(id('semana',mondayOf(iso)));
    R.f.push(id('fazenda',String(row[idx.fazenda]||'').trim()));
    R.l.push(id('lote',String(row[idx.lote]||'').trim()));
    R.to.push(id('tipoOvo',String(row[idx.tipoOvo]||'').trim()));
    R.lg.push(id('linhg',String(row[idx.linhg]||'').trim()));
    R.am.push(num(row[idx.idadeMatriz]));
    R.ds.push(num(row[idx.diasEstoq]));
    R.ti.push(ti);
    R.ct.push(num(row[idx.cont]));
    R.tn.push(num(row[idx.totalNasc]));
    R.el.push(num(row[idx.elim]));
    R.nm.push(num(row[idx.nascMortos]));
    R.tv.push(num(row[idx.totalVend]));
    R.iev.push(num(row[idx.iev]));
    R.iee.push(num(row[idx.iee]));
    R.se.push(num(row[idx.stdEcl]));
    R.df.push(num(row[idx.difEcl]));
    R.an.push(+iso.slice(0,4));
    R.me.push(+iso.slice(5,7));
  }
  if(!R.ti.length) throw new Error('Nenhum registro válido encontrado na planilha.');

  /* Coloca os dicionários de datas em ordem cronológica */
  ['semana','dataNasc'].forEach(function(kind){
    var order=dict[kind].map(function(v,i){ return [v,i]; })
      .sort(function(a,b){ return a[0]<b[0]?-1:(a[0]>b[0]?1:0); });
    var remap=new Array(dict[kind].length);
    order.forEach(function(pair,newIdx){ remap[pair[1]]=newIdx; });
    dict[kind]=order.map(function(p){ return p[0]; });
    var arr = kind==='semana' ? R.sm : R.dn;
    for(var i=0;i<arr.length;i++) arr[i]=remap[arr[i]];
  });

  return { dict: dict, rows: R, n: R.ti.length, updatedAt: Date.now() };
}
