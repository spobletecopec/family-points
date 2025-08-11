const LS = { names:"fp_names", limit:"fp_limit", plan:"fp_plan", log:"fp_log" };

function pointsForSlot(dt){
  const mins = dt.getHours()*60 + dt.getMinutes();
  const day = dt.getDay(); // 0 Sun ... 6 Sat
  const isWE = (day===0 || day===6);
  if(!isWE){
    if (mins>=0 && mins<420) return 2;      // 00:00–07:00
    if (mins>=420 && mins<510) return 4;    // 07:00–08:30
    if (mins>=510 && mins<1050) return 0;   // 08:30–17:30
    if (mins>=1050 && mins<1230) return 6;  // 17:30–20:30
    return 2;                               // 20:30–24:00
  }else{
    if (mins>=0 && mins<480) return 1;      // 00:00–08:00
    if (mins>=480 && mins<600) return 2;    // 08:00–10:00
    if (mins>=600 && mins<720) return 1;    // 10:00–12:00
    if (mins>=720 && mins<840) return 2;    // 12:00–14:00
    if (mins>=840 && mins<1050) return 1;   // 14:00–17:30
    if (mins>=1050 && mins<1230) return 3;  // 17:30–20:30
    return 1;                               // 20:30–24:00
  }
}
function floorToHalfHour(d){ const r=new Date(d); r.setMinutes(r.getMinutes()-(r.getMinutes()%30),0,0); return r; }
function ceilToHalfHour(d){ const r=new Date(d); if(r.getMinutes()%30!==0 || r.getSeconds()!==0 || r.getMilliseconds()!==0){ r.setMinutes(r.getMinutes()+(30-(r.getMinutes()%30)),0,0);} return r; }
function computePoints(dateStr,startStr,endStr){
  const start=new Date(dateStr+"T"+startStr);
  const end=new Date(dateStr+"T"+endStr);
  if(!(start<end)) return 0;
  const minutes=(end-start)/60000;
  if(minutes<=15) return 0;
  const from=floorToHalfHour(start);
  const to=ceilToHalfHour(end);
  let total=0;
  for(let t=new Date(from); t<to; t.setMinutes(t.getMinutes()+30)){
    const slotStart=new Date(t);
    const slotEnd=new Date(t); slotEnd.setMinutes(slotEnd.getMinutes()+30);
    const overlap=Math.max(0, Math.min(end,slotEnd)-Math.max(start,slotStart));
    if(overlap>0){ total+=pointsForSlot(slotStart); }
  }
  return total;
}

let state={ names:{A:"Sebastián",B:"Isa"}, limit:-12, plan:[], log:[] };
function loadState(){ const n=localStorage.getItem(LS.names); const l=localStorage.getItem(LS.limit); const p=localStorage.getItem(LS.plan); const g=localStorage.getItem(LS.log); if(n) state.names=JSON.parse(n); if(l) state.limit=parseInt(l,10); if(p) state.plan=JSON.parse(p); if(g) state.log=JSON.parse(g); }
function saveState(){ localStorage.setItem(LS.names, JSON.stringify(state.names)); localStorage.setItem(LS.limit, String(state.limit)); localStorage.setItem(LS.plan, JSON.stringify(state.plan)); localStorage.setItem(LS.log, JSON.stringify(state.log)); }
function switchTab(id){ document.querySelectorAll(".tab,.tabcontent").forEach(el=>el.classList.remove("active")); document.querySelector(`.tab[data-tab="${id}"]`).classList.add("active"); document.getElementById(id).classList.add("active"); }
function renderNames(){ document.getElementById("nameA").value=state.names.A; document.getElementById("nameB").value=state.names.B; document.getElementById("cardAName").textContent=state.names.A; document.getElementById("cardBName").textContent=state.names.B;
  Array.from(document.querySelectorAll("#planWho option,#logWho option")).forEach(opt=>{ if(opt.value==="A") opt.textContent=state.names.A; if(opt.value==="B") opt.textContent=state.names.B; });
}
function renderResumen(){ const totalA=state.log.filter(r=>r.who==="A").reduce((s,r)=>s+(r.points||0),0); const totalB=state.log.filter(r=>r.who==="B").reduce((s,r)=>s+(r.points||0),0);
  document.getElementById("totalA").textContent=totalA; document.getElementById("totalB").textContent=totalB;
  document.getElementById("blockA").textContent=(totalA<=state.limit?"Sí":"No"); document.getElementById("blockB").textContent=(totalB<=state.limit?"Sí":"No"); }
function renderPlan(){ const tb=document.querySelector("#planTable tbody"); tb.innerHTML=""; state.plan.forEach((row,idx)=>{ const tr=document.createElement("tr");
  tr.innerHTML=`<td>${row.week}</td><td>${row.who==="A"?state.names.A:state.names.B}</td><td>${row.day}</td><td>${row.start}</td><td>${row.end}</td><td>${row.type}</td><td>${row.notes||""}</td><td><button class="small deleteBtn" data-type="plan" data-idx="${idx}">Eliminar</button></td>`; tb.appendChild(tr); }); }
function renderLog(){ const tb=document.querySelector("#logTable tbody"); tb.innerHTML=""; state.log.forEach((row,idx)=>{ const tr=document.createElement("tr");
  tr.innerHTML=`<td>${row.date}</td><td>${row.who==="A"?state.names.A:state.names.B}</td><td>${row.start}</td><td>${row.end}</td><td>${row.activity||""}</td><td>${row.notes||""}</td><td>${row.points||0}</td><td><button class="small deleteBtn" data-type="log" data-idx="${idx}">Eliminar</button></td>`; tb.appendChild(tr); }); }
function exportCSV(){ const rows=[["Fecha","Persona","Inicio","Fin","Actividad","Notas","Puntos"]];
  state.log.forEach(r=>rows.push([r.date,(r.who==="A"?state.names.A:state.names.B),r.start,r.end,r.activity||"",r.notes||"",r.points||0]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="registro_puntos.csv"; a.click(); URL.revokeObjectURL(url);
}
function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));
  document.getElementById("saveNames").addEventListener("click",()=>{ state.names.A=document.getElementById("nameA").value||"Persona A"; state.names.B=document.getElementById("nameB").value||"Persona B"; saveState(); renderNames(); renderLog(); renderPlan(); renderResumen(); });
  document.getElementById("planForm").addEventListener("submit",(e)=>{ e.preventDefault();
    const row={ week:document.getElementById("planWeek").value, who:document.getElementById("planWho").value, day:document.getElementById("planDay").value, start:document.getElementById("planStart").value, end:document.getElementById("planEnd").value, type:document.getElementById("planType").value, notes:document.getElementById("planNotes").value };
    state.plan.push(row); saveState(); renderPlan(); e.target.reset();
  });
  document.getElementById("logForm").addEventListener("submit",(e)=>{ e.preventDefault();
    const date=document.getElementById("logDate").value, who=document.getElementById("logWho").value, start=document.getElementById("logStart").value, end=document.getElementById("logEnd").value, activity=document.getElementById("logActivity").value, notes=document.getElementById("logNotes").value;
    const points=computePoints(date,start,end);
    const row={ date, who, start, end, activity, notes, points };
    state.log.push(row); saveState(); renderLog(); renderResumen(); e.target.reset();
  });
  document.body.addEventListener("click",(e)=>{ const btn=e.target.closest(".deleteBtn"); if(!btn) return; const idx=parseInt(btn.dataset.idx,10); const type=e.target.dataset.type;
    if(type==="plan"){ state.plan.splice(idx,1); saveState(); renderPlan(); } else if(type==="log"){ state.log.splice(idx,1); saveState(); renderLog(); renderResumen(); } });
  document.getElementById("saveLimit").addEventListener("click",()=>{ const v=parseInt(document.getElementById("limitDebt").value,10); if(!Number.isNaN(v)){ state.limit=v; saveState(); renderResumen(); } });
  document.getElementById("backupJSON").addEventListener("click",()=>{ const data=JSON.stringify(state,null,2); const blob=new Blob([data],{type:"application/json"}); const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download="backup_planificador.json"; a.click(); URL.revokeObjectURL(url); });
  document.getElementById("restoreJSON").addEventListener("change",(e)=>{ const f=e.target.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=()=>{ try{ const data=JSON.parse(fr.result); if(data && data.names && data.plan && data.log){ state=data; saveState(); document.getElementById("limitDebt").value=state.limit; renderNames(); renderPlan(); renderLog(); renderResumen(); } else { alert("Archivo inválido"); } }catch{ alert("No se pudo importar el backup"); } }; fr.readAsText(f); });
  document.getElementById("exportCSV").addEventListener("click",exportCSV);
  document.getElementById("clearAll").addEventListener("click",()=>{ if(confirm("¿Seguro que quieres borrar TODO?")){ state={ names:{A:"Sebastián",B:"Isa"}, limit:-12, plan:[], log:[] }; saveState(); document.getElementById("limitDebt").value=state.limit; renderNames(); renderPlan(); renderLog(); renderResumen(); }});
}
function init(){ loadState(); renderNames(); renderPlan(); renderLog(); document.getElementById("limitDebt").value=state.limit; renderResumen(); initEvents(); }
document.addEventListener("DOMContentLoaded", init);
