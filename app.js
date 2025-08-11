// v2.3 PWA
const LS = { plan:"fp_plan", log:"fp_log" };
const NAMES = { A:"Sebastián", B:"Isa" };

function pointsForSlot(dt){
  const mins = dt.getHours()*60 + dt.getMinutes();
  const day = dt.getDay();
  const isWE = (day===0 || day===6);
  if(!isWE){
    if (mins>=0 && mins<420) return 2;
    if (mins>=420 && mins<510) return 4;
    if (mins>=510 && mins<1050) return 0;
    if (mins>=1050 && mins<1230) return 6;
    return 2;
  }else{
    if (mins>=0 && mins<480) return 1;
    if (mins>=480 && mins<600) return 2;
    if (mins>=600 && mins<720) return 1;
    if (mins>=720 && mins<840) return 2;
    if (mins>=840 && mins<1050) return 1;
    if (mins>=1050 && mins<1230) return 3;
    return 1;
  }
}
function floorToHalfHour(d){ const r=new Date(d); r.setMinutes(r.getMinutes()-(r.getMinutes()%30),0,0); return r; }
function ceilToHalfHour(d){ const r=new Date(d); if(r.getMinutes()%30!==0 || r.getSeconds()!==0 || r.getMilliseconds()!==0){ r.setMinutes(r.getMinutes()+(30-(r.getMinutes()%30)),0,0);} return r; }
function computePoints(dateStr,startStr,endStr){
  try{
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
  }catch(e){ console.error("computePoints error", e); return 0; }
}

let state={ plan:[], log:[] };
function loadState(){ try{ const p=localStorage.getItem(LS.plan); const g=localStorage.getItem(LS.log); if(p) state.plan=JSON.parse(p); if(g) state.log=JSON.parse(g);}catch(e){ console.warn("loadState", e); } }
function saveState(){ try{ localStorage.setItem(LS.plan, JSON.stringify(state.plan)); localStorage.setItem(LS.log, JSON.stringify(state.log)); }catch(e){ console.warn("saveState", e); } }

function switchTab(id){
  const tabBtn=document.querySelector(`.tab[data-tab="${id}"]`);
  const tabContent=document.getElementById(id);
  if(!tabBtn || !tabContent) return;
  document.querySelectorAll(".tab,.tabcontent").forEach(el=>el.classList.remove("active"));
  tabBtn.classList.add("active"); tabBtn.setAttribute("aria-selected","true");
  tabContent.classList.add("active");
  document.querySelectorAll(".tab").forEach(b=>{ if(b.dataset.tab!==id) b.setAttribute("aria-selected","false"); });
}

function renderResumen(){
  const totalA=state.log.filter(r=>r.who==="A").reduce((s,r)=>s+(r.points||0),0);
  const totalB=state.log.filter(r=>r.who==="B").reduce((s,r)=>s+(r.points||0),0);
  const tA=document.getElementById("totalA"); const tB=document.getElementById("totalB"); const lead=document.getElementById("leaderText");
  if(tA) tA.textContent=totalA;
  if(tB) tB.textContent=totalB;
  if(lead){
    if(totalA>totalB){ lead.textContent=`${NAMES.A} va arriba por ${totalA-totalB} puntos.`; }
    else if(totalB>totalA){ lead.textContent=`${NAMES.B} va arriba por ${totalB-totalA} puntos.`; }
    else{ lead.textContent="Aún no hay diferencia."; }
  }
}

function renderPlan(){
  const tbody=document.querySelector("#planTable tbody");
  if(!tbody) return;
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
      <td><button class="deleteBtn" data-type="plan" data-idx="${idx}" type="button">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
}

function renderLog(){
  const tbody=document.querySelector("#logTable tbody");
  if(!tbody) return;
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
      <td><button class="deleteBtn" data-type="log" data-idx="${idx}" type="button">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
}

function exportCSV(){
  try{
    const rows=[["Persona","Fecha","Inicio","Fin","Actividad","Notas","Puntos"]];
    state.log.forEach(r=>rows.push([r.who==="A"?NAMES.A:NAMES.B, r.date, r.start, r.end, r.activity||"", r.notes||"", r.points||0]));
    const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a"); a.href=url; a.download="registro_puntos.csv"; a.click();
    URL.revokeObjectURL(url);
  }catch(e){ console.error("exportCSV", e); }
}

function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click", (ev)=>{
    ev.preventDefault(); switchTab(btn.dataset.tab);
  }));

  const planForm=document.getElementById("planForm");
  if(planForm){
    planForm.addEventListener("submit",(e)=>{
      e.preventDefault();
      const row={
        who:document.getElementById("planWho")?.value || "A",
        date:document.getElementById("planDate")?.value || "",
        start:document.getElementById("planStart")?.value || "",
        end:document.getElementById("planEnd")?.value || "",
        type:document.getElementById("planType")?.value || "",
        notes:document.getElementById("planNotes")?.value || ""
      };
      if(!row.date || !row.start || !row.end){ return; }
      state.plan.push(row);
      saveState(); renderPlan();
      planForm.reset();
    });
  }

  const logForm=document.getElementById("logForm");
  if(logForm){
    logForm.addEventListener("submit",(e)=>{
      e.preventDefault();
      const date=document.getElementById("logDate")?.value || "";
      const who=document.getElementById("logWho")?.value || "A";
      const start=document.getElementById("logStart")?.value || "";
      const end=document.getElementById("logEnd")?.value || "";
      const activity=document.getElementById("logActivity")?.value || "";
      const notes=document.getElementById("logNotes")?.value || "";
      if(!date || !start || !end){ return; }
      const points=computePoints(date,start,end);
      const row={ date, who, start, end, activity, notes, points };
      state.log.push(row);
      saveState(); renderLog(); renderResumen();
      logForm.reset();
    });
  }

  document.body.addEventListener("click",(e)=>{
    const btn=e.target.closest(".deleteBtn");
    if(!btn) return;
    const idx=parseInt(btn.dataset.idx,10);
    const type=btn.dataset.type;
    if(Number.isFinite(idx)){
      if(type==="plan"){ state.plan.splice(idx,1); saveState(); renderPlan(); }
      if(type==="log"){ state.log.splice(idx,1); saveState(); renderLog(); renderResumen(); }
    }
  });

  const exportBtn=document.getElementById("exportCSV");
  if(exportBtn){ exportBtn.addEventListener("click", exportCSV); }
}

function init(){
  try{
    loadState();
    renderPlan(); renderLog(); renderResumen();
    initEvents();
    console.log("App iniciada", window.__APP_VERSION__ || "");
  }catch(e){
    console.error("init error", e);
  }
}
document.addEventListener("DOMContentLoaded", init);
