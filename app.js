// State (fixed names, no config screen)
const LS = { plan:"fp_plan", log:"fp_log" };
const NAMES = { A:"Sebastián", B:"Isa" };

// Tariffs per 30 min
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

// App state
let state={ plan:[], log:[] };
function loadState(){ const p=localStorage.getItem(LS.plan); const g=localStorage.getItem(LS.log); if(p) state.plan=JSON.parse(p); if(g) state.log=JSON.parse(g); }
function saveState(){ localStorage.setItem(LS.plan, JSON.stringify(state.plan)); localStorage.setItem(LS.log, JSON.stringify(state.log)); }

// Tabs
function switchTab(id){
  document.querySelectorAll(".tab,.tabcontent").forEach(el=>el.classList.remove("active"));
  document.querySelector(`.tab[data-tab="${id}"]`).classList.add("active");
  document.querySelector(`.tab[data-tab="${id}"]`).setAttribute("aria-selected","true");
  document.getElementById(id).classList.add("active");
  document.querySelectorAll(".tab").forEach(b=>{ if(b.dataset.tab!==id) b.setAttribute("aria-selected","false"); });
}

// Renders
function renderResumen(){
  const totalA=state.log.filter(r=>r.who==="A").reduce((s,r)=>s+(r.points||0),0);
  const totalB=state.log.filter(r=>r.who==="B").reduce((s,r)=>s+(r.points||0),0);
  document.getElementById("totalA").textContent=totalA;
  document.getElementById("totalB").textContent=totalB;

  let leaderText="Aún no hay diferencia.";
  if(totalA>totalB){
    leaderText = `${NAMES.A} va arriba por ${totalA-totalB} puntos.`;
  }else if(totalB>totalA){
    leaderText = `${NAMES.B} va arriba por ${totalB-totalA} puntos.`;
  }
  document.getElementById("leaderText").textContent = leaderText;
}

function renderPlan(){
  const tbody=document.querySelector("#planTable tbody");
  tbody.innerHTML="";
  state.plan.forEach((row, idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td data-label="Persona">${row.who==="A"?NAMES.A:NAMES.B}</td>
      <td data-label="Fecha">${row.date}</td>
      <td data-label="Inicio">${row.start}</td>
      <td data-label="Fin">${row.end}</td>
      <td data-label="Tipo">${row.type}</td>
      <td data-label="Notas">${row.notes||""}</td>
      <td><button class="deleteBtn" data-type="plan" data-idx="${idx}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderLog(){
  const tbody=document.querySelector("#logTable tbody");
  tbody.innerHTML="";
  state.log.forEach((row, idx)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td data-label="Persona">${row.who==="A"?NAMES.A:NAMES.B}</td>
      <td data-label="Fecha">${row.date}</td>
      <td data-label="Inicio">${row.start}</td>
      <td data-label="Fin">${row.end}</td>
      <td data-label="Actividad">${row.activity||""}</td>
      <td data-label="Notas">${row.notes||""}</td>
      <td data-label="Puntos">${row.points||0}</td>
      <td><button class="deleteBtn" data-type="log" data-idx="${idx}">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
}

// Export CSV
function exportCSV(){
  const rows=[["Persona","Fecha","Inicio","Fin","Actividad","Notas","Puntos"]];
  state.log.forEach(r=>rows.push([r.who==="A"?NAMES.A:NAMES.B, r.date, r.start, r.end, r.activity||"", r.notes||"", r.points||0]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a");
  a.href=url; a.download="registro_puntos.csv"; a.click();
  URL.revokeObjectURL(url);
}

// Events
function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));

  // Plan form
  document.getElementById("planForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    const row={
      who:document.getElementById("planWho").value,
      date:document.getElementById("planDate").value,
      start:document.getElementById("planStart").value,
      end:document.getElementById("planEnd").value,
      type:document.getElementById("planType").value,
      notes:document.getElementById("planNotes").value
    };
    state.plan.push(row);
    saveState(); renderPlan();
    e.target.reset();
  });

  // Log form
  document.getElementById("logForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    const date=document.getElementById("logDate").value;
    const who=document.getElementById("logWho").value;
    const start=document.getElementById("logStart").value;
    const end=document.getElementById("logEnd").value;
    const activity=document.getElementById("logActivity").value;
    const notes=document.getElementById("logNotes").value;
    const points=computePoints(date,start,end);
    const row={ date, who, start, end, activity, notes, points };
    state.log.push(row);
    saveState(); renderLog(); renderResumen();
    e.target.reset();
  });

  // Delete (delegation)
  document.body.addEventListener("click",(e)=>{
    const btn=e.target.closest(".deleteBtn");
    if(!btn) return;
    const idx=parseInt(btn.dataset.idx,10);
    const type=btn.dataset.type;
    if(type==="plan"){ state.plan.splice(idx,1); saveState(); renderPlan(); }
    if(type==="log"){ state.log.splice(idx,1); saveState(); renderLog(); renderResumen(); }
  });

  document.getElementById("exportCSV").addEventListener("click", exportCSV);
}

function init(){
  loadState();
  renderPlan(); renderLog(); renderResumen();
  initEvents();
}
document.addEventListener("DOMContentLoaded", init);
