// v4.0 PWA + Supabase (online sync) — sin Planificación
const VERSION = "v4.0";
const NAMES = { A:"Sebastián", B:"Isa" };

// ---- Supabase config (rellena y sube) ----
const SUPABASE_URL = "https://zhpharrgsammenkekaax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocGhhcnJnc2FtbWVua2VrYWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjQ1NjgsImV4cCI6MjA3MDU0MDU2OH0.waDyJ--XCuMHbEBYJ8T6qprZG_IBRfQFiVLptWCU7Fo";
// ------------------------------------------

let supabaseClient = null;
let houseId = localStorage.getItem("fp_house") || "";
const state = { log: [] };
let logChannel = null;

// Tarifa por 30 min
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

// UI helpers
function qs(sel){ return document.querySelector(sel); }
function switchTab(id){
  const tabBtn=qs(`.tab[data-tab="${id}"]`);
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
  qs("#totalA").textContent = totalA;
  qs("#totalB").textContent = totalB;
  const lead=qs("#leaderText");
  if(totalA>totalB){ lead.textContent=`${NAMES.A} va arriba por ${totalA-totalB} puntos.`; }
  else if(totalB>totalA){ lead.textContent=`${NAMES.B} va arriba por ${totalB-totalA} puntos.`; }
  else{ lead.textContent="Aún no hay diferencia."; }
}

function renderLog(){
  const tbody=qs("#logTable tbody"); if(!tbody) return;
  tbody.innerHTML="";
  state.log.forEach((row)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td data-label="Persona">${row.who==="A"?NAMES.A:NAMES.B}</td>
      <td data-label="Fecha">${row.date}</td>
      <td data-label="Inicio">${row.start}</td>
      <td data-label="Fin">${row.end}</td>
      <td data-label="Actividad">${row.activity||""}</td>
      <td data-label="Notas">${row.notes||""}</td>
      <td data-label="Puntos">${row.points||0}</td>
      <td><button class="deleteBtn" data-id="${row.id}" type="button">Eliminar</button></td>`;
    tbody.appendChild(tr);
  });
}

function exportCSV(){
  const rows=[["Persona","Fecha","Inicio","Fin","Actividad","Notas","Puntos"]];
  state.log.forEach(r=>rows.push([r.who==="A"?NAMES.A:NAMES.B, r.date, r.start, r.end, r.activity||"", r.notes||"", r.points||0]));
  const csv=rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const a=document.createElement("a"); a.href=url; a.download="registro_puntos.csv"; a.click();
  URL.revokeObjectURL(url);
}

// Supabase
async function setupSupabase(){
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabaseClient.auth.getSession();
  if(error){ console.error(error); }
  qs("#authInfo").textContent = "Supabase listo";
}

function sanitizeHouseId(s){
  return (s||"").trim().toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20);
}

async function loadLog(){
  if(!houseId) return;
  const { data, error } = await supabaseClient
    .from('log')
    .select('*')
    .eq('house_id', houseId)
    .order('date', { ascending: true })
    .order('start', { ascending: true });
  if(error){ console.error(error); return; }
  state.log = data || [];
  renderLog(); renderResumen();
}

function subscribeLog(){
  if(logChannel){ supabaseClient.removeChannel(logChannel); logChannel=null; }
  if(!houseId) return;
  logChannel = supabaseClient
    .channel('log-changes-' + houseId)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'log', filter: `house_id=eq.${houseId}` }, payload => {
      loadLog();
    })
    .subscribe();
}

async function addLog(row){
  const { error } = await supabaseClient.from('log').insert([ row ]);
  if(error){ console.error(error); }
}
async function delLog(id){
  const { error } = await supabaseClient.from('log').delete().eq('id', id).eq('house_id', houseId);
  if(error){ console.error(error); }
}

// Init
function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click", (ev)=>{
    ev.preventDefault(); switchTab(btn.dataset.tab);
  }));

  qs("#joinHouse").addEventListener("click", ()=>{
    const input = sanitizeHouseId(qs("#houseId").value);
    if(!input){
      const rnd = Math.random().toString(36).slice(2,8).toUpperCase();
      houseId = "CASA-" + rnd;
      qs("#houseId").value = houseId;
    }else{
      houseId = input;
    }
    localStorage.setItem("fp_house", houseId);
    qs("#authInfo").textContent = "Hogar: " + houseId;
    loadLog(); subscribeLog();
  });

  // Log form
  qs("#logForm").addEventListener("submit",(e)=>{
    e.preventDefault();
    if(!houseId){ alert("Primero ingresa/crea el código del hogar."); return; }
    const date=qs("#logDate").value;
    const who=qs("#logWho").value;
    const start=qs("#logStart").value;
    const end=qs("#logEnd").value;
    const activity=qs("#logActivity").value;
    const notes=qs("#logNotes").value;
    const points=computePoints(date,start,end);
    const row={ id: crypto.randomUUID(), house_id: houseId, date, who, start, end, activity, notes, points, created_at: new Date().toISOString() };
    addLog(row);
    e.target.reset();
  });

  // Delete delegation
  document.body.addEventListener("click",(e)=>{
    const btn=e.target.closest(".deleteBtn");
    if(!btn) return;
    const id = btn.dataset.id;
    if(id){ delLog(id); }
  });

  qs("#exportCSV").addEventListener("click", exportCSV);
}

async function init(){
  await setupSupabase();
  if(houseId){ qs("#houseId").value = houseId; qs("#authInfo").textContent = "Hogar: " + houseId; loadLog(); subscribeLog(); }
  else { qs("#authInfo").textContent = "Ingresa un código para sincronizar"; }
  initEvents();
  console.log("App iniciada", VERSION);
}
document.addEventListener("DOMContentLoaded", init);
