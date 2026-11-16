import {EMPTY_SNAPSHOT,workbookToSnapshot,clients,weeks,selectRows,aggregate,metricSummary,weeklySeries,groupRows,weekDelta,quality,fmtInt,fmtPct,fmtMoney,fmtMoney2,fmtWeek,ratio,sanitizeSnapshot,clean} from './engine.mjs';

const $=(sel)=>document.querySelector(sel);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const st={snapshot:structuredClone(EMPTY_SNAPSHOT),cliente:'TODOS',corte:'',periodo:'all',page:'general',loaded:false};
const PAGES={
 general:['Visión general','Indicadores de captación, seguimiento y matriculación.'],
 captacion:['Captación y leads','Evolución comercial, distribución de estados y fuentes de captación.'],
 matriculas:['Matrículas','Resultados por titulación, tipología y origen atribuido.'],
 inversion:['Inversión y objetivos','Eficiencia económica y cumplimiento de metas comunicadas.'],
 acciones:['Operaciones y calidad','Acciones pendientes y comprobación de la consistencia de los datos.']
};
const COLORS={leads:'#3b82f6',validos:'#25a78e',contactados:'#8b7cf6',interesados:'#e49a58',matriculas:'#1aaf91',pendientes:'#f0a263',contactado:'#668bdd',noInteresados:'#a0acbb',standby:'#a690df',falsos:'#dd7780',inversion:'#3b82f6'};
const STATUS=[['Pendientes','pendientes','#f0a263'],['Contactados','contactados','#668bdd'],['Interesados','interesados','#1aaf91'],['No interesados','noInteresados','#a6adba'],['Stand by','standby','#a690df'],['Falsos','falsos','#dd7780']];
const isEmpty=()=>!['semanales','matriculas','inversion','detalle','acciones'].some(k=>st.snapshot[k]?.length);
function toast(message,error=false){let node=$('#toast');node.textContent=message;node.className='toast show'+(error?' error':'');clearTimeout(toast.timeout);toast.timeout=setTimeout(()=>node.classList.remove('show'),4200)}
function download(content,filename,type){let url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1200)}
function emptyChart(msg='No hay datos para representar en este periodo'){return `<div class="chart-empty"><span class="chart-empty-icon">▤</span>${esc(msg)}</div>`}
function emptySmall(title='Sin registros disponibles',extra='Este apartado se activará cuando existan datos en la pestaña correspondiente.'){
 return `<div class="empty-small"><strong>${esc(title)}</strong>${esc(extra)}</div>`;
}
function stat(label,value,icon,detail='',tone=''){
 return `<article class="stat-card"><div class="stat-top"><span class="stat-label">${esc(label)}</span><span aria-hidden="true" class="stat-glyph ${tone}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-detail">${detail||'&nbsp;'}</div></article>`;
}
function panel(title,subtitle,inner,extra=''){return `<article class="panel"><div class="panel-head"><div><h3 class="panel-title">${esc(title)}</h3>${subtitle?`<p class="panel-subtitle">${esc(subtitle)}</p>`:''}</div>${extra}</div>${inner}</article>`}
function section(title,subtitle=''){return `<div class="section-head"><h2>${esc(title)}</h2>${subtitle?`<span class="tiny-tag">${esc(subtitle)}</span>`:''}</div>`}
function scopeLabel(s){if(!s.to)return 'Sin semana de corte';if(st.periodo==='all')return `Histórico hasta el ${fmtWeek(s.to)}`;return `${fmtWeek(s.from)} – ${fmtWeek(s.to)}`}
const signedDelta=(c,p,isPct=false)=> {
 if(c===null||p===null||p===undefined||c===undefined)return `<span class="delta neutral">—</span>`;
 if(isPct){let delta=(c-p)*100;return `<span class="delta ${delta>0?'positive':delta<0?'negative':'neutral'}">${delta>0?'+':''}${delta.toLocaleString('es-ES',{maximumFractionDigits:1})} pp</span>`}
 if(p===0)return `<span class="delta neutral">—</span>`;
 let delta=(c-p)/p;return `<span class="delta ${delta>0?'positive':delta<0?'negative':'neutral'}">${delta>0?'+':''}${(delta*100).toLocaleString('es-ES',{maximumFractionDigits:1})} %</span>`;
};
function chartLine(rows,series){
 if(!rows.length||!series.some(s=>rows.some(r=>r[s.key]!==null && r[s.key]!==undefined)))return emptyChart();
 const W=760,H=232,M={l:40,r:17,t:12,b:34},iw=W-M.l-M.r,ih=H-M.t-M.b;
 let vals=series.flatMap(s=>rows.map(r=>r[s.key]).filter(v=>v!==null && v!==undefined));let rawMax=Math.max(...vals,1),step=Math.max(1,Math.ceil(rawMax/4));let ymax=Math.ceil(rawMax/(step*4))*(step*4)||step*4;
 if(ymax<rawMax)ymax+=step;
 const x=i=>M.l+(rows.length===1?iw/2:i*iw/(rows.length-1)),y=v=>M.t+ih-(v/ymax)*ih;
 let svg=[];
 for(let j=0;j<=4;j++){let yy=M.t+ih*(j/4),value=ymax*(1-j/4);svg.push(`<line class="axis-line" x1="${M.l}" y1="${yy}" x2="${W-M.r}" y2="${yy}"/><text class="axis-value" x="${M.l-9}" y="${yy+4}" text-anchor="end">${esc(fmtAxis(value))}</text>`)}
 const maxLabels=7,every=Math.max(1,Math.ceil(rows.length/maxLabels));
 rows.forEach((r,i)=>{if(i%every===0||i===rows.length-1)svg.push(`<text class="axis-label" x="${x(i)}" y="${H-10}" text-anchor="middle">${esc(tickWeek(r.week))}</text>`)});
 for(const s of series){let run=[];
 const flush=()=>{if(run.length){svg.push(`<path class="chart-line" d="${run.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ')}" stroke="${s.color}"/>`);run=[]}};
 rows.forEach((r,i)=>{const v=r[s.key];if(v===null||v===undefined){flush();return}const xx=x(i),yy=y(v);run.push([xx.toFixed(2),yy.toFixed(2)]);svg.push(`<circle cx="${xx}" cy="${yy}" r="${rows.length>19?2.5:3.4}" fill="${s.color}" class="chart-dot"><title>${esc(s.label)} · ${esc(fmtWeek(r.week))}: ${fmtInt(v)}</title></circle>`)});flush();}
 return `<div class="chart-area"><svg role="img" aria-label="Gráfico de evolución semanal" viewBox="0 0 ${W} ${H}" width="100%" height="100%">${svg.join('')}</svg></div>${legend(series)}`;
}
function fmtAxis(n){if(n>=10000)return `${(n/1000).toLocaleString('es-ES',{maximumFractionDigits:1})} mil`;return Math.round(n).toLocaleString('es-ES')}
function tickWeek(d){if(!d)return '';return new Date(d+'T12:00:00Z').toLocaleDateString('es-ES',{day:'numeric',month:'short',timeZone:'UTC'})}
function legend(series){return `<div class="legend">${series.map(s=>`<span class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${esc(s.label)}</span>`).join('')}</div>`}
function chartBars(rows,key,color,label,currency=false){
 if(!rows.length||!rows.some(r=>r[key]!==null&&r[key]!==undefined))return emptyChart();
 const W=760,H=232,M={l:42,r:14,t:12,b:33},iw=W-M.l-M.r,ih=H-M.t-M.b;
 let vals=rows.map(r=>r[key]).filter(x=>x!==null&&x!==undefined);
 let ymax=Math.max(1,...vals),step=Math.max(currency?100:1,Math.ceil(ymax/4));ymax=Math.ceil(ymax/(step*4))*(step*4);
 const x=i=>M.l+(i+0.5)*iw/rows.length,y=v=>M.t+ih-v*ih/ymax;
 let svg=[];
 for(let i=0;i<=4;i++){const yy=M.t+ih*i/4;svg.push(`<line class="axis-line" x1="${M.l}" x2="${W-M.r}" y1="${yy}" y2="${yy}"/><text class="axis-value" x="${M.l-8}" y="${yy+3}" text-anchor="end">${esc(fmtAxis(ymax*(1-i/4)))}</text>`)}
 const barWidth=Math.min(38,iw/rows.length*.57);
 const each=Math.max(1,Math.ceil(rows.length/7));
 rows.forEach((r,i)=>{const value=r[key],xx=x(i);if(value!==null && value!==undefined){const yy=y(value),hh=M.t+ih-yy;
 svg.push(`<rect class="bar-rect" x="${xx-barWidth/2}" y="${yy}" width="${barWidth}" height="${Math.max(0,hh)}" fill="${color}"><title>${esc(label)} · ${esc(fmtWeek(r.week))}: ${currency?esc(fmtMoney(value)):fmtInt(value)}</title></rect>`)}
 if(i%each===0||i===rows.length-1)svg.push(`<text class="axis-label" x="${xx}" y="${H-10}" text-anchor="middle">${esc(tickWeek(r.week))}</text>`)});
 return `<div class="chart-area"><svg role="img" aria-label="${esc(label)} por semana" viewBox="0 0 ${W} ${H}" width="100%" height="100%">${svg.join('')}</svg></div>${legend([{label,color}])}`;
}
function rankings(data,color='#1aaf91',max=8){if(!data.length)return emptySmall();const highest=Math.max(1,...data.map(d=>d.value));return `<div class="rank-list">${data.slice(0,max).map(d=>`<div class="rank-entry"><span class="rank-name" title="${esc(d.name)}">${esc(d.name)}</span><b>${fmtInt(d.value)}</b><div class="rank-track"><div class="rank-fill" style="background:${color};width:${Math.max(0,Math.min(100,d.value/highest*100))}%"></div></div></div>`).join('')}</div>${data.length>max?`<p class="muted-note">Se muestran ${max} de ${data.length} categorías.</p>`:''}`}
function funnel(m,observed){const stages=[['Leads',m.leads,'#3b82f6'],['Válidos',m.validos,'#1aaf91'],['Contactados',m.contactados,'#8b7cf6'],['Interesados',m.interesados,'#e49a58']];return !observed?emptySmall():`<div class="funnel-list">${stages.map(([label,value,color])=>`<div class="funnel-row"><div><div class="funnel-top"><strong>${label}</strong><span class="funnel-figure">${fmtInt(value)}</span></div><div class="funnel-track"><div class="funnel-fill" style="background:${color};width:${m.leads>0?Math.min(100,value/m.leads*100):0}%"></div></div></div><div class="funnel-percent">${fmtPct(ratio(value,m.leads))}</div></div>`).join('')}</div><p class="muted-note">Cada barra representa una proporción del total de leads registrados. Las matrículas no se incluyen: no existe vinculación individual con el lead.</p>`}
function distribution(m,observed){if(!observed)return emptySmall();return `<div class="segment-bar" role="img" aria-label="Distribución de los estados de los leads">${STATUS.map(([,,c],i)=>`<span title="${esc(STATUS[i][0])}: ${fmtInt(m[STATUS[i][1]])}" style="background:${c};width:${m.estados?Math.max(0,m[STATUS[i][1]]/m.estados*100):0}%"></span>`).join('')}</div><div class="status-list">${STATUS.map(([name,key,c])=>`<div class="status-entry"><span><i class="status-dot" style="background:${c}"></i>${esc(name)}</span><b>${fmtInt(m[key])}</b></div>`).join('')}</div>`}
function compareTable(wd){if(!wd)return emptySmall('No hay fecha de corte');const a=wd.current,b=wd.previous;const config=[['Leads',a?.leads??null,b?.leads??null,false],['Leads válidos',a?.validos??null,b?.validos??null,false],['Interesados',a?.interesados??null,b?.interesados??null,false],['% contacto',a?.pctContacto??null,b?.pctContacto??null,true],['% interés',a?.pctInteres??null,b?.pctInteres??null,true],['Matrículas',wd.matriculasCurrent,wd.matriculasPrevious,false]];
 return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Indicador</th><th class="num">Actual</th><th class="num">Anterior</th><th class="num">Variación</th></tr></thead><tbody>${config.map(([name,current,prior,pct])=>`<tr><td><strong>${name}</strong></td><td class="num">${pct?fmtPct(current):fmtInt(current)}</td><td class="num">${pct?fmtPct(prior):fmtInt(prior)}</td><td class="num">${signedDelta(current,prior,pct)}</td></tr>`).join('')}</tbody></table></div><p class="chart-note">Comparación de las dos semanas naturales inmediatamente consecutivas; si no existe registro, se muestra «—».</p>`}
function emptyHero(){return `<section class="empty-hero"><div class="hero-illustration">↗</div><div><h2>Tu panel está listo para recibir datos</h2><p>El archivo original es una plantilla vacía. Carga una versión cumplimentada con las pestañas «Datos semanales», «Matriculas» y, opcionalmente, «Detalle leads», «Acciones» e «Inversión y objetivos».</p><button type="button" class="button" data-import>Cargar Excel cumplimentado</button><a class="secondary-link" href="README.md" target="_blank" rel="noopener">Ver instrucciones</a></div></section>`}
function scopeBanner(selected){const s=selected;const count=s.semanales.length;return `<div class="data-banner"><span class="banner-icon">◉</span><div><strong>${esc(scopeLabel(s))}</strong><span>${count} fila${count===1?'':'s'} de captación semanal · ${s.matriculas.length} registro${s.matriculas.length===1?'':'s'} de matrículas</span></div><span class="banner-right">${esc(st.cliente==='TODOS'?'Todos los centros':st.cliente)}</span></div>`}
function renderingInput(selected){return st.loaded||!isEmpty() ? '' : emptyHero()}
function renderGeneral(s){const m=metricSummary(s),has=s.semanales.length>0;
 const series=weeklySeries(s).slice(-12),d=weekDelta(st.snapshot,st.cliente,s.to);
 const alerts=quality(st.snapshot,{cliente:st.cliente,corte:s.to,periodo:st.periodo});
 const items=[];
 items.push(renderingInput(s));
 if(!isEmpty())items.push(scopeBanner(s));
 items.push(section('Indicadores principales',scopeLabel(s)));
 items.push(`<div class="dashboard-grid grid-5">${stat('Leads recibidos',has?fmtInt(m.leads):'—','↗','Volumen de captación en el periodo')}${stat('Leads válidos',has?fmtInt(m.validos):'—','✓',has?`${fmtPct(ratio(m.validos,m.leads))} del total de leads`:'Sin datos de leads','blue')}${stat('Contactados',has?fmtInt(m.contactados):'—','◷',has?`${fmtPct(m.pctContacto)} sobre válidos`:'Sin datos de contacto','purple')}${stat('Interesados',has?fmtInt(m.interesados):'—','◉',has?`${fmtPct(m.pctInteres)} de contactados`:'Sin datos de interés','orange')}${stat('Matrículas',fmtInt(m.matriculas),'▣',m.matriculas===null?'No comunicadas todavía':'Nuevas matrículas registradas','slate')}</div>`);
 items.push(`<div class="dashboard-grid grid-4">${stat('Tasa de contacto',has?fmtPct(m.pctContacto):'—','%','Contactados / leads válidos')}${stat('Tasa de interés',has?fmtPct(m.pctInteres):'—','%','Interesados / contactados','purple')}${stat('Interés sobre válidos',has?fmtPct(m.pctInteresValidos):'—','%','Interesados / leads válidos','blue')}${stat('Tasa de falsos',has?fmtPct(m.pctFalsos):'—','%','Falsos / leads totales','orange')}</div>`);
 items.push(section('Actividad y evolución','Máximo de 12 semanas mostradas'));
 items.push(`<div class="dashboard-grid grid-main">${panel('Evolución de la captación','Leads, válidos e interesados por semana',chartLine(series,[{key:'leads',label:'Leads',color:COLORS.leads},{key:'validos',label:'Válidos',color:COLORS.validos},{key:'interesados',label:'Interesados',color:COLORS.interesados}]))}${panel('Embudo comercial','Acumulado del periodo seleccionado',funnel(m,has))}</div>`);
 items.push(`<div class="dashboard-grid grid-2">${panel('Distribución del estado de los leads','Desglose de los registros semanales',distribution(m,has))}${panel('Comparativa semanal',`Actual vs. ${fmtWeek(d?.previousWeek)}`,compareTable(d))}</div>`);
 if(alerts.length)items.push(`<div class="data-source"><strong>${alerts.length} comprobación${alerts.length===1?'':'es'} de datos a revisar.</strong> ${esc(alerts.slice(0,2).map(a=>a.title).join(' · '))}. Abre «Operaciones y calidad» para ver el detalle.</div>`);
 return `<div class="stack">${items.join('')}</div>`;
}
function weeklyTable(s){if(!s.semanales.length)return emptySmall();const series=weeklySeries(s).sort((a,b)=>b.week.localeCompare(a.week));return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Semana</th><th class="num">Leads</th><th class="num">Válidos</th><th class="num">Contactados</th><th class="num">Interesados</th><th class="num">Pendientes</th><th class="num">% contacto</th></tr></thead><tbody>${series.slice(0,30).map(r=>`<tr><td><strong>${esc(fmtWeek(r.week))}</strong></td><td class="num">${fmtInt(r.leads)}</td><td class="num">${fmtInt(r.validos)}</td><td class="num">${fmtInt(r.contactados)}</td><td class="num">${fmtInt(r.interesados)}</td><td class="num">${fmtInt(r.pendientes)}</td><td class="num">${fmtPct(r.validos!==null?ratio(r.contactados,r.validos):null)}</td></tr>`).join('')}</tbody></table></div>${series.length>30?`<p class="chart-note">Se muestran las últimas 30 semanas de ${series.length}.</p>`:''}`}
function renderCaptacion(s){const m=metricSummary(s),has=s.semanales.length>0;const series=weeklySeries(s).slice(-26);
 const detailed=groupRows(s.detalle.map(r=>({...r,_count:1})),'origen','_count');
 const program=groupRows(s.detalle.map(r=>({...r,_count:1})),'programa','_count');
 return `<div class="stack">${renderingInput(s)}${section('Rendimiento de captación',scopeLabel(s))}<div class="dashboard-grid grid-4">${stat('Leads',has?fmtInt(m.leads):'—','↗','Volumen semanal agregado')}${stat('Válidos',has?fmtInt(m.validos):'—','✓','Leads excluyendo falsos','blue')}${stat('Pendientes',has?fmtInt(m.pendientes):'—','◷',has?fmtPct(ratio(m.pendientes,m.validos))+' de válidos':'Sin registros','orange')}${stat('Interesados',has?fmtInt(m.interesados):'—','◎',has?fmtPct(m.pctInteresValidos)+' de válidos':'Sin registros','purple')}</div>
 <div class="dashboard-grid grid-main">${panel('Tendencia semanal','Últimas 26 semanas disponibles del periodo',chartLine(series,[{key:'leads',label:'Leads',color:COLORS.leads},{key:'validos',label:'Válidos',color:COLORS.validos},{key:'interesados',label:'Interesados',color:COLORS.interesados}]))}${panel('Estado de la cartera','Estados de los leads declarados',distribution(m,has))}</div>
 ${section('Análisis del detalle de leads','Pestaña «Detalle leads»')}
 <div class="dashboard-grid grid-2">${panel('Leads por categoría de origen','Registros de detalle, no necesariamente equivalentes al total semanal',rankings(detailed,COLORS.leads))}${panel('Leads por programa','Registros del detalle de leads',rankings(program,COLORS.validos))}</div>
 ${panel('Seguimiento semanal','Recuentos por semana · las tasas se calculan sobre sus denominadores',weeklyTable(s))}
 <div class="data-source"><strong>Criterio de lectura:</strong> «Contacto» = contactados + interesados + no interesados + stand by. Los datos de «Detalle leads» son un recuento de sus registros y no se suman a «Datos semanales» para evitar duplicidades. ${st.snapshot.detalle.some(r=>!r.cliente)?'El detalle no tiene identificador de cliente y no se asigna cuando hay varios centros.':''}</div></div>`
}
function matTable(s){if(!s.matriculas.length)return emptySmall('Aún no se han comunicado matrículas','Una ausencia de registros no equivale a cero matrículas.');const byWeek=groupRows(s.matriculas,'semana','matriculados');byWeek.sort((a,b)=>b.name.localeCompare(a.name));const byProg=groupRows(s.matriculas,'programa','matriculados');return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Programa</th><th class="num">Matrículas</th><th class="num">% del total registrado</th></tr></thead><tbody>${byProg.map(r=>`<tr><td><strong>${esc(r.name)}</strong></td><td class="num">${fmtInt(r.value)}</td><td class="num">${fmtPct(ratio(r.value,s.matriculas.reduce((a,b)=>a+b.matriculados,0)))}</td></tr>`).join('')}</tbody></table></div>`}
function renderMatriculas(s){const m=metricSummary(s),has=m.matriculas!==null;const prog=groupRows(s.matriculas,'programa','matriculados'),tipo=groupRows(s.matriculas,'tipo','matriculados'),origen=groupRows(s.matriculas,'origen','matriculados');const weekly=weeklySeries(s).slice(-26);
 return `<div class="stack">${renderingInput(s)}${section('Resultados de matriculación',scopeLabel(s))}<div class="dashboard-grid grid-4">${stat('Matrículas registradas',fmtInt(m.matriculas),'▣',has?'Nuevas altas en el periodo':'No se han comunicado datos')}${stat('Programas con matrículas',has?fmtInt(prog.length):'—','◈','Titulaciones con registro','blue')}${stat('Tipos de formación',has?fmtInt(tipo.length):'—','◎','Categorías declaradas','purple')}${stat('Orígenes atribuidos',has?fmtInt(origen.filter(x=>x.name!=='Sin atribución').length):'—','↗','Sin atribución excluida','orange')}</div>
 <div class="dashboard-grid grid-main">${panel('Evolución de matrículas','Nuevas matrículas semanales; las semanas sin dato quedan vacías',chartBars(weekly,'matriculas',COLORS.matriculas,'Matrículas'))}${panel('Matrículas por tipo de programa','Distribución del total registrado',rankings(tipo,COLORS.purple))}</div>
 ${section('Desglose comercial')}
 <div class="dashboard-grid grid-2">${panel('Matrículas por programa','Programas con más altas registradas',rankings(prog,COLORS.validos,12))}${panel('Matrículas por origen atribuido','El origen vacío se muestra como «Sin atribución»',rankings(origen,COLORS.leads,12))}</div>
 ${panel('Detalle por titulación','Total de nuevas matrículas, sin sumar acumulados previos',matTable(s))}
 <div class="data-source"><strong>Nota metodológica:</strong> sin un ID de relación entre cada lead y cada matrícula, no puede calcularse la tasa real de conversión a matrícula por cohorte ni atribuir matrículas a campañas a partir de los leads de la misma semana.</div></div>`
}
function progress(title,value,target,label){if(target===null)return `<div class="progress-group"><div class="progress-header"><span>${esc(title)}</span><strong>Sin objetivo informado</strong></div><div class="progress-track"></div></div>`;
 const pct=value===null?null:ratio(value,target);return `<div class="progress-group"><div class="progress-header"><span>${esc(title)}</span><strong>${fmtPct(pct)}</strong></div><div class="progress-track"><div class="progress-fill" style="width:${pct!==null?Math.max(0,Math.min(100,pct*100)):0}%"></div></div><div class="progress-footer">${value===null?'Sin dato real comunicado':fmtInt(value)+' alcanzados'} sobre ${fmtInt(target)} previstos${label?' · '+esc(label):''}</div></div>`}
function investmentsTable(s){if(!s.inversion.length)return emptySmall();let rows=weeklySeries(s).filter(r=>r.inversion!==null).sort((a,b)=>b.week.localeCompare(a.week));return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Semana</th><th class="num">Inversión</th><th class="num">Leads</th><th class="num">Matrículas</th><th class="num">CPL</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${esc(fmtWeek(r.week))}</strong></td><td class="num">${fmtMoney(r.inversion)}</td><td class="num">${fmtInt(r.leads)}</td><td class="num">${fmtInt(r.matriculas)}</td><td class="num">${fmtMoney2(r.leads!==null?ratio(r.inversion,r.leads):null)}</td></tr>`).join('')}</tbody></table></div>`}
function renderInversion(s){const m=metricSummary(s);const series=weeklySeries(s).slice(-26);
 return `<div class="stack">${renderingInput(s)}${section('Eficiencia de inversión',scopeLabel(s))}<div class="dashboard-grid grid-4">${stat('Inversión captación',fmtMoney(m.inversion),'€',m.inversion===null?'No informada':'Inversión registrada en el periodo')}${stat('Coste por lead (CPL)',fmtMoney2(m.cpl),'↗','Inversión / leads recibidos','blue')}${stat('Coste por matrícula',fmtMoney2(m.cpm),'▣','Inversión / matrículas registradas','purple')}${stat('Ingresos registrados',fmtMoney(m.ingresos),'€',m.ingresos===null?'No informados':'Importe comunicado','orange')}</div>
 <div class="dashboard-grid grid-main">${panel('Evolución de la inversión','Importes semanales efectivamente comunicados',chartBars(series,'inversion',COLORS.inversion,'Inversión',true))}${panel('Cumplimiento de objetivos','Objetivos sumados para las semanas seleccionadas',`${progress('Captación de leads',s.semanales.length?m.leads:null,m.objetivoLeads)}${progress('Matrículas',m.matriculas,m.objetivoMatriculas,m.matriculas===null?'Sin dato de matrículas':'')}${m.matriculas===null&&m.objetivoMatriculas!==null?'<p class="chart-note">La consecución de matrícula queda pendiente: no se ha registrado el dato real.</p>':''}`)}</div>
 <div class="dashboard-grid grid-2">${panel('Indicadores económicos','Comparaciones de magnitudes declaradas',`<div class="substat"><span>Objetivo total de leads</span><strong>${fmtInt(m.objetivoLeads)}</strong></div><div class="substat"><span>Objetivo total de matrículas</span><strong>${fmtInt(m.objetivoMatriculas)}</strong></div><div class="substat"><span>Ingresos / inversión</span><strong>${fmtPct(m.ingresosInversion)}</strong></div><div class="substat"><span>% leads sobre objetivo</span><strong>${fmtPct(m.cumplimientoLeads)}</strong></div><div class="substat"><span>% matrículas sobre objetivo</span><strong>${fmtPct(m.cumplimientoMatriculas)}</strong></div><p class="chart-note">«Ingresos / inversión» es una relación agregada, no ROI ni rentabilidad atribuible a una campaña.</p>`)}${panel('Semanas con inversión declarada','Detalle para verificar periodos y coste',investmentsTable(s))}</div>
 <div class="data-source"><strong>Disponibilidad:</strong> esta área usa «Inversión y objetivos». Si hay semanas con leads o matrículas pero sin inversión informada, no se calcula el coste del periodo. Los importes ausentes no se imputan a cero. Los costes no prueban atribución individual.</div></div>`;
}
function labelState(raw){let a=clean(raw).toLowerCase();if(/cumplid|finalizad|cerrad|hech|complet|realizad|terminad/.test(a))return 'done';if(/cancelad|bloquead|retras|pendiente de validaci/.test(a))return 'block';return 'wait'}
function actionsTable(rows){if(!rows.length)return emptySmall('No hay acciones registradas','Rellena la pestaña «Acciones» para monitorizar tareas comerciales.');return `<div class="table-scroll"><table class="data-table"><thead><tr><th>Acción</th><th>Indicador</th><th>Responsable</th><th>Fecha límite</th><th>Estado</th></tr></thead><tbody>${rows.slice().sort((a,b)=>(a.fechaLimite||'9999').localeCompare(b.fechaLimite||'9999')).slice(0,50).map(r=>`<tr><td><strong>${esc(r.accion)}</strong></td><td>${esc(r.indicador||'—')}</td><td>${esc(r.responsable||'—')}</td><td>${esc(fmtWeek(r.fechaLimite))}</td><td><span class="label-chip ${labelState(r.estado)}">${esc(r.estado)}</span></td></tr>`).join('')}</tbody></table></div>${rows.length>50?`<p class="chart-note">Se muestran las primeras 50 acciones.</p>`:''}`}
function renderAcciones(s){const issues=quality(st.snapshot,{cliente:st.cliente,corte:s.to,periodo:st.periodo});const rows=s.acciones;const count={total:rows.length,done:rows.filter(r=>labelState(r.estado)==='done').length,wait:rows.filter(r=>labelState(r.estado)==='wait').length,block:rows.filter(r=>labelState(r.estado)==='block').length};
 return `<div class="stack">${renderingInput(s)}${section('Seguimiento operativo',scopeLabel(s))}<div class="dashboard-grid grid-4">${stat('Acciones registradas',rows.length?fmtInt(count.total):'—','☷','Tareas del periodo')}${stat('Completadas',rows.length?fmtInt(count.done):'—','✓','Según el estado declarado','blue')}${stat('En seguimiento',rows.length?fmtInt(count.wait):'—','◷','Pendientes o sin estado','orange')}${stat('Comprobaciones',fmtInt(issues.length),'!','Inconsistencias y avisos','purple')}</div>
 <div class="dashboard-grid grid-main">${panel('Plan de acción comercial','Ordenado por fecha límite comunicada',actionsTable(rows))}${panel('Calidad de datos','Validaciones de estados, filas y cobertura',issues.length?`<div>${issues.slice(0,12).map(a=>`<div class="alert ${esc(a.level)}"><div class="alert-icon">${a.level==='error'?'!':a.level==='warning'?'△':'i'}</div><div><strong>${esc(a.title)}</strong><p>${esc(a.detail)}</p></div></div>`).join('')}</div>${issues.length>12?`<p class="chart-note">${issues.length-12} incidencias adicionales no mostradas.</p>`:''}`:`<div class="empty-small"><strong>Sin incidencias detectadas</strong>${s.semanales.length?'Los estados declarados cuadran con los leads registrados en este periodo.':'Añade datos semanales para comprobar la consistencia.'}</div>`)}</div>
 ${panel('Reglas de cálculo y control','Definiciones tomadas de la plantilla maestra',`<div class="dashboard-grid grid-2"><div><div class="callout-row"><div class="callout-number">1</div><div><strong>Leads válidos</strong><p>Leads recibidos menos leads falsos.</p></div></div><div class="callout-row"><div class="callout-number">2</div><div><strong>Total contactados</strong><p>Contactados + interesados + no interesados + stand by.</p></div></div><div class="callout-row"><div class="callout-number">3</div><div><strong>Tasa de contacto</strong><p>Total contactados / leads válidos.</p></div></div></div><div><div class="callout-row"><div class="callout-number">4</div><div><strong>Tasa de interés</strong><p>Interesados / total contactados.</p></div></div><div class="callout-row"><div class="callout-number">5</div><div><strong>Interés sobre válidos</strong><p>Interesados / leads válidos.</p></div></div><div class="callout-row"><div class="callout-number">6</div><div><strong>Matrículas no informadas</strong><p>Se muestran sin dato; no se sustituyen por cero.</p></div></div></div></div><p class="chart-note">La verificación de duplicados por email + programa no es posible con las columnas de «Detalle leads» de esta plantilla, ya que no incorpora email ni ID de lead.</p>`)}
 </div>`;
}
function getPage(){return Object.hasOwn(PAGES,st.page)?st.page:'general'}
function setPage(page){st.page=Object.hasOwn(PAGES,page)?page:'general';history.replaceState(null,'','#'+st.page);render()}
function updateSelectors(){const cs=clients(st.snapshot),ws=weeks(st.snapshot,st.cliente);
 if(st.cliente!=='TODOS'&&!cs.includes(st.cliente))st.cliente=cs.length===1?cs[0]:'TODOS';
 let chtml=`<option value="TODOS">Todos los centros${cs.length?' ('+cs.length+')':''}</option>`+cs.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
 $('#clientFilter').innerHTML=chtml;$('#clientFilter').value=st.cliente;
 if(!ws.includes(st.corte))st.corte=ws.at(-1)||'';
 $('#dateFilter').innerHTML=ws.length?ws.slice().reverse().map(w=>`<option value="${esc(w)}">Semana del ${esc(fmtWeek(w))}</option>`).join(''):'<option value="">Sin semanas registradas</option>';
 $('#dateFilter').value=st.corte;$('#dateFilter').disabled=!ws.length;
 $('#periodFilter').value=st.periodo;
 let count=(st.snapshot.semanales?.length||0)+(st.snapshot.matriculas?.length||0)+(st.snapshot.inversion?.length||0);
 $('#sourceLabel').textContent=st.loaded?st.snapshot.meta?.source||'Excel importado':'Plantilla sin datos';
 $('#sourceCount').textContent=st.loaded?`${count} registros base · ${cs.length} cliente${cs.length===1?'':'s'}`:'Carga un archivo para comenzar';
 $('#sourceDot').classList.toggle('loaded',!isEmpty());
}
function render(){updateSelectors();const pg=getPage();$('#pageTitle').textContent=PAGES[pg][0];$('#pageSubtitle').textContent=PAGES[pg][1];$('#pageKicker').textContent=pg==='general'?'INTELIGENCIA COMERCIAL':'ANÁLISIS POR ÁREA';
 document.querySelectorAll('[data-nav]').forEach(a=>a.classList.toggle('active',a.dataset.nav===pg));
 const selected=selectRows(st.snapshot,{cliente:st.cliente,corte:st.corte,periodo:st.periodo});
 let html={general:renderGeneral,captacion:renderCaptacion,matriculas:renderMatriculas,inversion:renderInversion,acciones:renderAcciones}[pg](selected);
 $('#dashboardContent').innerHTML=html;document.title=PAGES[pg][0]+' | Eduqia';
}
async function loadXLSX(){if(window.XLSX)return;
 const urls=['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'];
 for(const url of urls){try{await new Promise((resolve,reject)=>{let script=document.createElement('script');script.src=url;script.async=true;script.onload=()=>window.XLSX?resolve():reject(new Error('No se pudo iniciar el lector XLSX'));script.onerror=()=>reject(new Error('No se pudo descargar el lector XLSX'));document.head.appendChild(script);setTimeout(()=>{if(!window.XLSX)reject(new Error('Tiempo de carga agotado'))},9500)});if(window.XLSX)return;}catch(e){if(window.XLSX)return}}
 throw new Error('No se ha podido cargar el lector de Excel. Comprueba la conexión a Internet y vuelve a intentarlo.');
}
async function handleFile(file){if(!file)return;
 try{toast('Leyendo el Excel...');await loadXLSX();const arr=await file.arrayBuffer();const wb=window.XLSX.read(arr,{type:'array',cellDates:true});const snapshot=workbookToSnapshot(wb,file.name);
 st.snapshot=snapshot;st.loaded=true;const cs=clients(snapshot);st.cliente=cs.length===1?cs[0]:'TODOS';st.corte='';st.periodo='all';render();
 let total=snapshot.semanales.length+snapshot.matriculas.length+snapshot.inversion.length;
 toast(total?`${file.name}: ${total} registros base cargados correctamente.`:`${file.name}: es una plantilla sin registros. El dashboard está preparado.`);
 }catch(error){console.error(error);toast('No se pudo importar: '+error.message,true)}finally{$('#fileInput').value=''}}
function exportJSON(){if(!st.loaded && isEmpty()){toast('Todavía no hay datos que exportar. Primero carga un Excel.',true);return}
 const str=JSON.stringify(sanitizeSnapshot(st.snapshot),null,2);download(str,'datos.json','application/json');toast('JSON descargado. Para publicarlo, sustituye data/datos.json en el repositorio.');}
async function init(){
 const hash=location.hash.slice(1);if(PAGES[hash])st.page=hash;
 document.body.addEventListener('click',e=>{const nav=e.target.closest('[data-nav]');if(nav){e.preventDefault();setPage(nav.dataset.nav);$('#sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});return}if(e.target.closest('[data-import]'))$('#fileInput').click()});
 $('#clientFilter').addEventListener('change',e=>{st.cliente=e.target.value;st.corte='';render()});
 $('#dateFilter').addEventListener('change',e=>{st.corte=e.target.value;render()});
 $('#periodFilter').addEventListener('change',e=>{st.periodo=e.target.value;render()});
 $('#exportButton').addEventListener('click',exportJSON);
 $('#fileInput').addEventListener('change',e=>handleFile(e.target.files?.[0]));
 $('#menuBtn').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
 window.addEventListener('hashchange',()=>{let h=location.hash.slice(1);if(PAGES[h]){st.page=h;render()}});
 render();
 try{const r=await fetch('./data/datos.json',{cache:'no-store'});if(r.ok){const data=await r.json();if(data&&Array.isArray(data.semanales)&&Array.isArray(data.matriculas)){
 st.snapshot={...structuredClone(EMPTY_SNAPSHOT),...data};st.loaded=!!data.meta?.importedAt||!!data.semanales.length||!!data.matriculas.length||!!data.inversion?.length;const cs=clients(st.snapshot);if(cs.length===1)st.cliente=cs[0];render();
 }}}catch(e){console.warn('Sin snapshot local prepublicado; puede cargarse un Excel manualmente.');}
}
init();
