/** Pure, auditable business rules matching plantilla-final.xlsx. */
export const EMPTY_SNAPSHOT = {version:1, meta:{source:'plantilla-final.xlsx', importedAt:null}, semanales:[], matriculas:[], inversion:[], detalle:[], acciones:[], correspondencia:[]};
const toString = (v) => v == null ? '' : String(v).trim();
export const clean = toString;
export function num(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).replace(/[\s€%]/g,'');
  if (/^-?[\d.]+,\d+$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
  else if (/^-?\d+,\d+$/.test(s)) s=s.replace(',','.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s=s.replace(/\./g,'');
  const n=Number(s);return Number.isFinite(n)?n:null;
}
export function isoDate(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date && !isNaN(v.getTime())) return [v.getUTCFullYear(),String(v.getUTCMonth()+1).padStart(2,'0'),String(v.getUTCDate()).padStart(2,'0')].join('-');
  if (typeof v === 'number' && v>1000 && v<200000) {
    const d=new Date(Date.UTC(1899,11,30) + Math.floor(v)*86400000); return d.toISOString().slice(0,10);
  }
  const s=String(v).trim();
  if (/^\d{4}-\d\d-\d\d/.test(s)) return s.slice(0,10);
  const m=s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}
export const validDate = (s)=> /^\d{4}-\d\d-\d\d$/.test(s) && !Number.isNaN(Date.parse(s+'T00:00:00Z'));
const sum = (rows,k) => rows.reduce((a,r)=> a+(num(r[k])??0),0);
export const ratio=(a,b) => b>0 ? a/b : null;
export const fmtInt=(v)=>v==null?'—':Math.round(v).toLocaleString('es-ES');
export const fmtMoney=(v)=>v==null?'—':v.toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
export const fmtMoney2=(v)=>v==null?'—':v.toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:2});
export const fmtPct=(v)=>v==null?'—':(v*100).toLocaleString('es-ES',{maximumFractionDigits:1})+' %';
export const fmtWeek=(s)=>s ? new Date(s+'T12:00:00Z').toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}):'—';
function records(wb,name){const sheet=wb.Sheets[name];return sheet ? window.XLSX.utils.sheet_to_json(sheet,{defval:null,raw:true,blankrows:false,...(name==='Inversión y objetivos'?{range:3}:{})}) : []}
const pick=(obj,k)=>obj?.[k];
const goodRow=(r)=>Object.values(r||{}).some(v=>v!==null && v!=='');
export function workbookToSnapshot(wb,filename='archivo.xlsx') {
  const sw=records(wb,'Datos semanales');
  const mm=records(wb,'Matriculas');
  const iv=records(wb,'Inversión y objetivos');
  const dt=records(wb,'Detalle leads');
  const ac=records(wb,'Acciones');
  const mp=records(wb,'Correspondencia');
  if (!wb.Sheets['Datos semanales'] || !wb.Sheets['Matriculas']) throw Error('Faltan las pestañas «Datos semanales» o «Matriculas». Se necesita la estructura original de la plantilla.');
  const summaryName=clean(wb.Sheets['Resumen']?.['B1']?.v);
  const clientName=summaryName && !/^NOMBRE DEL CLIENTE$/i.test(summaryName) ? summaryName : '';
  const semanales=sw.filter(r=>clean(r['Cliente']) && isoDate(r['Semana (lunes)']) && num(r['Leads'])!==null).map(r=>({
    cliente:clean(r['Cliente']),semana:isoDate(r['Semana (lunes)']),
    leads:num(r['Leads']),pendientes:num(r['Pendientes'])??0,contactados:num(r['Contactados'])??0,
    interesados:num(r['Interesados'])??0,noInteresados:num(r['No interesados'])??0,
    standby:num(r['Stand by'])??0,falsos:num(r['Falsos'])??0
  }));
  const matriculas=mm.filter(r=>clean(r.Cliente) && isoDate(r['Semana (lunes)']) && num(r.Matriculados)!==null).map(r=>({
    cliente:clean(r.Cliente),semana:isoDate(r['Semana (lunes)']),programa:clean(r.Programa)||'Sin programa',
    tipo:clean(r['Tipo programa'])||'Sin especificar',campana:clean(r['Campaña']),
    origen:clean(r['Origen atribuido'])||'Sin atribución',matriculados:num(r.Matriculados),
    fuente:clean(r['Fuente del dato'])
  }));
  const inversion=iv.filter(r=>clean(r.Cliente)&&isoDate(r['Semana (lunes)']) && ['Inversión captación €','Objetivo leads','Objetivo matrículas','Ingresos registrados €'].some(k=>num(r[k])!==null)).map(r=>({
    cliente:clean(r.Cliente),semana:isoDate(r['Semana (lunes)']),inversion:num(r['Inversión captación €']),
    objetivoLeads:num(r['Objetivo leads']),objetivoMatriculas:num(r['Objetivo matrículas']),
    ingresos:num(r['Ingresos registrados €'])
  }));
  const correspon=mp.filter(r=>clean(r['Estado en el CRM']) && ['Pendientes','Contactados','Interesados','No interesados','Stand by','Falsos'].includes(clean(r['Estado en el informe']))).map(r=>({crm:clean(r['Estado en el CRM']),informe:clean(r['Estado en el informe'])}));
  const clientSet=new Set([...semanales,...matriculas,...inversion,...ac.filter(r=>clean(r.Cliente))].map(r=>r.cliente || clean(r.Cliente)).filter(Boolean));
  const inferredClient=clientSet.size===1?[...clientSet][0]:clientName && clientSet.has(clientName)?clientName:'';
  const detalle=dt.filter(r=>goodRow(r) && isoDate(r.Semana)).map(r=>({
    cliente:inferredClient,semana:isoDate(r.Semana),fecha:isoDate(r['Fecha alta']),
    programa:clean(r.Programa)||'Sin programa',tipo:clean(r['Tipo programa'])||'Sin especificar',
    origen:clean(r['Cat. origen'])||clean(r.Origen)||'Sin origen',
    campana:clean(r['Campaña']),crm:clean(r['Estado CRM']),
    informe:clean(r['Estado informe']),perdido:clean(r['¿Perdido?']),razon:clean(r['Razón perdido']),
    intentos:num(r['Intento llamada'])
  }));
  const acciones=ac.filter(r=>clean(r.Cliente) && clean(r['Acción'])).map(r=>({
    cliente:clean(r.Cliente),semana:isoDate(r.Semana),accion:clean(r['Acción']),indicador:clean(r.Indicador),
    responsable:clean(r.Responsable),fechaLimite:isoDate(r['Fecha límite']),estado:clean(r.Estado)||'Sin estado',
    esperado:clean(r['Resultado esperado']),real:clean(r['Resultado real']),cumplido:clean(r.Cumplido)
  }));
  return {version:1,meta:{source:filename, importedAt:new Date().toISOString(),detailClient:inferredClient||null,
    notes:'Datos de las pestañas de entrada; no se usan los resultados almacenados de fórmulas.'},
    semanales,matriculas,inversion,detalle,acciones,correspondencia:correspon};
}
export function clients(snapshot) {
 return [...new Set([...(snapshot.semanales||[]),...(snapshot.matriculas||[]),...(snapshot.inversion||[]),...(snapshot.acciones||[])].map(r=>r.cliente).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
}
export function weeks(snapshot,client='TODOS') {
 return [...new Set([...(snapshot.semanales||[]),...(snapshot.matriculas||[]),...(snapshot.inversion||[]),...(snapshot.acciones||[])].filter(r=>client==='TODOS'||r.cliente===client).map(r=>r.semana).filter(validDate))].sort();
}
const all=(r,client,from,to)=> (client==='TODOS'||r.cliente===client) && r.semana && (!from || r.semana>=from) && (!to || r.semana<=to);
export function selectRows(snapshot,{cliente='TODOS',corte='',periodo='all'}={}){
  const allWeeks=weeks(snapshot,cliente),end=validDate(corte)?corte:allWeeks.at(-1)||'';
  let from='';
  if (end && periodo!=='all') {const d=new Date(end+'T00:00:00Z');d.setUTCDate(d.getUTCDate() - 7*(Number(periodo)-1));from=d.toISOString().slice(0,10)}
  const matched=(r)=>all(r,cliente,from,end);
  return {from,to:end,
    semanales:(snapshot.semanales||[]).filter(matched),
    matriculas:(snapshot.matriculas||[]).filter(matched),
    inversion:(snapshot.inversion||[]).filter(matched),
    detalle:(snapshot.detalle||[]).filter(r=>r.cliente && matched(r)),
    acciones:(snapshot.acciones||[]).filter(r=> (cliente==='TODOS'||r.cliente===cliente) && ((!r.semana)||matched(r)))
  };
}
export function aggregate(rows) {
  const leads=sum(rows,'leads'),falsos=sum(rows,'falsos'),validos=leads-falsos;
  const contactados=sum(rows,'contactados')+sum(rows,'interesados')+sum(rows,'noInteresados')+sum(rows,'standby');
  const interesados=sum(rows,'interesados');
  return {leads,validos,pendientes:sum(rows,'pendientes'),contactados,interesados,
    noInteresados:sum(rows,'noInteresados'),standby:sum(rows,'standby'),falsos,
    pctContacto:ratio(contactados,validos),pctInteres:ratio(interesados,contactados),
    pctInteresValidos:ratio(interesados,validos),pctFalsos:ratio(falsos,leads),
    estados:sum(rows,'pendientes')+sum(rows,'contactados')+sum(rows,'interesados')+sum(rows,'noInteresados')+sum(rows,'standby')+falsos};
}
export function metricSummary(selected){
  const a=aggregate(selected.semanales);const hasMat=selected.matriculas.length>0;
  const matriculas=hasMat?sum(selected.matriculas,'matriculados'):null;
  const iv=selected.inversion;
  const m=(key)=>iv.some(r=>r[key]!==null&&r[key]!==undefined)?sum(iv,key):null;
  const inversion=m('inversion'),objetivoLeads=m('objetivoLeads'),objetivoMatriculas=m('objetivoMatriculas'),ingresos=m('ingresos');
  const investmentWeeks=new Set(iv.filter(r=>r.inversion!==null).map(r=>r.semana+'|'+r.cliente));
  const spendCoversLeads=selected.semanales.length>0 && selected.semanales.every(r=>investmentWeeks.has(r.semana+'|'+r.cliente));
  const spendCoversMats=hasMat && selected.matriculas.every(r=>investmentWeeks.has(r.semana+'|'+r.cliente));
  const hasWeeklyLeads=selected.semanales.length>0;
  return {...a,matriculas,inversion,objetivoLeads,objetivoMatriculas,ingresos,
    spendCoversLeads,spendCoversMats,
    cpl:inversion!==null&&spendCoversLeads?ratio(inversion,a.leads):null,
    cpm:inversion!==null&&spendCoversMats?ratio(inversion,matriculas):null,
    cumplimientoLeads:objetivoLeads!==null&&hasWeeklyLeads?ratio(a.leads,objetivoLeads):null,
    cumplimientoMatriculas:objetivoMatriculas!==null&&matriculas!==null?ratio(matriculas,objetivoMatriculas):null,
    ingresosInversion:ingresos!==null&&inversion!==null?ratio(ingresos,inversion):null};
}
export function weeklySeries(selected,possibleWeeks=[]) {
 const dict=new Map();
 const get=(w)=>{if(!dict.has(w))dict.set(w,{week:w,semanales:[],matriculas:[],inversion:[]});return dict.get(w)};
 for(const w of possibleWeeks) get(w);
 for(const r of selected.semanales) get(r.semana).semanales.push(r);
 for(const r of selected.matriculas) get(r.semana).matriculas.push(r);
 for(const r of selected.inversion) get(r.semana).inversion.push(r);
 const keys=[...dict.keys()].sort();
 if(keys.length>=2){
   const first=new Date(keys[0]+'T00:00:00Z'),last=new Date(keys.at(-1)+'T00:00:00Z');
   if(first.getUTCDay()===last.getUTCDay() && Math.round((last-first)/86400000)<=7*520){
     for(let d=new Date(first);d<=last;d.setUTCDate(d.getUTCDate()+7))get(d.toISOString().slice(0,10));
   }
 }
 return [...dict.values()].sort((a,b)=>a.week.localeCompare(b.week)).map(r=>{
  const a=r.semanales.length?aggregate(r.semanales):null;
  return {week:r.week,leads:a?.leads??null,validos:a?.validos??null,contactados:a?.contactados??null,
    interesados:a?.interesados??null,pendientes:a?.pendientes??null,falsos:a?.falsos??null,
    matriculas:r.matriculas.length?sum(r.matriculas,'matriculados'):null,
    inversion:r.inversion.some(v=>v.inversion!==null)?sum(r.inversion,'inversion'):null};
 });
}
export function groupRows(rows,key,valueKey,unknown='Sin especificar') {
 const groups=new Map();
 for(const row of rows){const label=clean(row[key])||unknown;groups.set(label,(groups.get(label)||0)+(num(row[valueKey])??0))}
 return [...groups].map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value||a.name.localeCompare(b.name,'es'));
}
export function weekDelta(snapshot,cliente,corte){
 if(!corte) return null;
 const d=new Date(corte+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-7);const previous=d.toISOString().slice(0,10);
 const records=(snapshot.semanales||[]).filter(r=>cliente==='TODOS'||r.cliente===cliente);
 const curr=records.filter(r=>r.semana===corte),prev=records.filter(r=>r.semana===previous);
 const mm=(snapshot.matriculas||[]).filter(r=>cliente==='TODOS'||r.cliente===cliente);
 const mc=mm.filter(r=>r.semana===corte),mp=mm.filter(r=>r.semana===previous);
 return {current:curr.length?aggregate(curr):null,previous:prev.length?aggregate(prev):null,
    matriculasCurrent:mc.length?sum(mc,'matriculados'):null,matriculasPrevious:mp.length?sum(mp,'matriculados'):null,previousWeek:previous};
}
export function quality(snapshot,{cliente='TODOS',corte='',periodo='all'}={}){
 const selected=selectRows(snapshot,{cliente,corte,periodo}),entries=selected.semanales;
 const issues=[];const counter=new Map();
 for(const r of entries){const k=r.cliente+'|'+r.semana;counter.set(k,(counter.get(k)||0)+1);
  const a=aggregate([r]);
  if(Math.abs(a.leads-a.estados)>0.001) issues.push({level:'error',title:'Descuadre de estados',detail:`${r.cliente} · ${fmtWeek(r.semana)}: ${fmtInt(a.leads)} leads frente a ${fmtInt(a.estados)} estados.`});
  if([r.leads,r.pendientes,r.contactados,r.interesados,r.noInteresados,r.standby,r.falsos].some(x=>x<0)) issues.push({level:'error',title:'Valor negativo',detail:`${r.cliente} · ${fmtWeek(r.semana)} contiene recuentos negativos.`});
 }
 for(const [k,n] of counter){if(n>1){const [c,w]=k.split('|');issues.push({level:'warning',title:'Semana repetida',detail:`${c} · ${fmtWeek(w)} aparece ${n} veces en «Datos semanales». Se suman sus filas.`})}}
 const weeklyClients=new Set(entries.map(r=>r.cliente));
 for(const c of new Set(selected.matriculas.map(r=>r.cliente))){if(!weeklyClients.has(c))issues.push({level:'info',title:'Matrículas sin captación semanal',detail:`${c} tiene matrículas en el periodo, pero ninguna fila semanal de leads.`})}
 if(snapshot.detalle?.length && snapshot.detalle.some(r=>!r.cliente))issues.push({level:'warning',title:'Detalle sin cliente identificable',detail:'El detalle de leads no incluye columna «Cliente» y el archivo contiene varios clientes: no se asigna arbitrariamente.'});
 return issues;
}
export function sanitizeSnapshot(s){return {version:1,meta:s.meta||{},semanales:s.semanales||[],matriculas:s.matriculas||[],inversion:s.inversion||[],detalle:s.detalle||[],acciones:s.acciones||[],correspondencia:s.correspondencia||[]}}
