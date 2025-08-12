// v4.6 PWA + Supabase + simplificaciones
const VERSION = "v4.6";
const NAMES = { A:"Sebastián", B:"Isa" };

// ---- Supabase config (rellena y sube) ----
const SUPABASE_URL = "https://zhpharrgsammenkekaax.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpocGhhcnJnc2FtbWVua2VrYWF4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ5NjQ1NjgsImV4cCI6MjA3MDU0MDU2OH0.waDyJ--XCuMHbEBYJ8T6qprZG_IBRfQFiVLptWCU7Fo";
// ------------------------------------------

let supabaseClient = null;
let houseId = localStorage.getItem("fp_house") || "";
const state = { log: [] };
let logChannel = null;

// Owner preference
const ownerKey = "fp_device_owner";

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
    let start=new Date(dateStr+"T"+startStr);
    let end=new Date(dateStr+"T"+endStr);
    if(!(start<end)){
      end = new Date(start);
      const [eh, em] = endStr.split(":").map(Number);
      end.setDate(end.getDate()+1);
      end.setHours(eh||0, em||0, 0, 0);
    }
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

// Formatters
function toDDMMYYYY(isoDate){
  // isoDate = "yyyy-mm-dd"
  if(!isoDate) return "";
  const [y,m,d] = isoDate.split("-");
  return `${d}-${m}-${y}`;
}
function initials(who){ return who==="A" ? "S" : "I"; }

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
      <td data-label="Persona"><span class="avatar">${initials(row.who)}</span></td>
      <td data-label="Fecha">${toDDMMYYYY(row.date)}</td>
      <td data-label="Inicio">${row.start}</td>
      <td data-label="Fin">${row.end}</td>
      <td data-label="Actividad">${row.activity||""}</td>
      <td data-label="Puntos">${row.points||0}</td>
      <td class="actionBtns">
        <button class="copyBtn" data-id="${row.id}" type="button">Copiar</button>
        <button class="deleteBtn" data-id="${row.id}" type="button">Eliminar</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// Supabase
async function setupSupabase(){
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabaseClient.auth.getSession();
  if(error){ console.error(error); }
}

function sanitizeHouseId(s){
  return (s||"").trim().toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20);
}

// Helpers de-dup
function indexById(id){ return state.log.findIndex(r=>r.id===id); }
function upsertRow(row){
  const i = indexById(row.id);
  if(i>-1){ state.log[i] = row; }
  else { state.log.push(row); }
  // Ordena por fecha + inicio
  state.log.sort((a,b)=> (a.date.localeCompare(b.date) || a.start.localeCompare(b.start)));
  renderLog(); renderResumen();
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
      if(payload.eventType === 'INSERT'){ upsertRow(payload.new); }
      else if(payload.eventType === 'UPDATE'){ upsertRow(payload.new); }
      else if(payload.eventType === 'DELETE'){ const i = indexById(payload.old.id); if(i>-1){ state.log.splice(i,1); renderLog(); renderResumen(); } }
    })
    .subscribe();
}

async function addLog(row){
  const { error } = await supabaseClient.from('log').insert([ row ]);
  if(error){ console.error(error); alert("Error al guardar: " + error.message); }
}
async function delLog(id){
  const { error } = await supabaseClient.from('log').delete().eq('id', id).eq('house_id', houseId);
  if(error){ console.error(error); alert("Error al eliminar: " + error.message); }
}

// Copy helper
function copyToForm(row){
  qs("#logWho").value = row.who;
  qs("#logDate").value = row.date;
  qs("#logStart").value = row.start;
  qs("#logEnd").value = row.end;
  qs("#logActivity").value = row.activity || "";
  switchTab("registro");
}

// Init
function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click", (ev)=>{
    ev.preventDefault(); switchTab(btn.dataset.tab);
  }));

  // Owner buttons
  const owner = localStorage.getItem(ownerKey);
  if(owner){
    const name = owner==="A"?NAMES.A:NAMES.B;
    const ownerNameEl = document.getElementById("ownerName");
    if(ownerNameEl) ownerNameEl.textContent = name;
    const ind = document.getElementById("ownerIndicator");
    const setup = document.getElementById("ownerSetup");
    if(ind && setup){ ind.classList.remove("hidden"); setup.classList.add("hidden"); }
    const whoSel = document.getElementById("logWho");
    if(whoSel) whoSel.value = owner;
  }
  const btnA = document.getElementById("setOwnerA");
  const btnB = document.getElementById("setOwnerB");
  const changeOwner = document.getElementById("changeOwner");
  if(btnA) btnA.addEventListener("click", ()=>{
    localStorage.setItem(ownerKey, "A");
    const ownerNameEl = document.getElementById("ownerName");
    if(ownerNameEl) ownerNameEl.textContent = NAMES.A;
    document.getElementById("ownerIndicator").classList.remove("hidden");
    document.getElementById("ownerSetup").classList.add("hidden");
    const whoSel = document.getElementById("logWho");
    if(whoSel) whoSel.value = "A";
  });
  if(btnB) btnB.addEventListener("click", ()=>{
    localStorage.setItem(ownerKey, "B");
    const ownerNameEl = document.getElementById("ownerName");
    if(ownerNameEl) ownerNameEl.textContent = NAMES.B;
    document.getElementById("ownerIndicator").classList.remove("hidden");
    document.getElementById("ownerSetup").classList.add("hidden");
    const whoSel = document.getElementById("logWho");
    if(whoSel) whoSel.value = "B";
  });
  if(changeOwner) changeOwner.addEventListener("click", ()=>{
    localStorage.removeItem(ownerKey);
    document.getElementById("ownerIndicator").classList.add("hidden");
    document.getElementById("ownerSetup").classList.remove("hidden");
  });

  // Household controls
  const joinBtn = document.getElementById("joinHouse");
  const changeHouse = document.getElementById("changeHouse");
  if(joinBtn) joinBtn.addEventListener("click", ()=>{
    const houseInput = document.getElementById("houseId");
    const input = (houseInput?.value || "").trim().toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20);
    let newId = input;
    if(!input){
      const rnd = Math.random().toString(36).slice(2,8).toUpperCase();
      newId = "CASA-" + rnd;
      if(houseInput) houseInput.value = newId;
    }
    houseId = newId;
    localStorage.setItem("fp_house", houseId);
    const houseLabel = document.getElementById("houseLabel");
    if(houseLabel) houseLabel.textContent = "Hogar: " + houseId;
    document.getElementById("housePanel").classList.add("hidden");
    document.getElementById("houseIndicator").classList.remove("hidden");
    loadLog(); subscribeLog();
  });
  if(changeHouse) changeHouse.addEventListener("click", ()=>{
    document.getElementById("housePanel").classList.remove("hidden");
    document.getElementById("houseIndicator").classList.add("hidden");
    const houseInput = document.getElementById("houseId");
    if(houseInput) houseInput.focus();
  });

  // Log form submit (siempre agrega)
  qs("#logForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(!houseId){ alert("Primero ingresa/crea el código del hogar en Configuración."); return; }
    const date=qs("#logDate").value;
    const who=qs("#logWho").value;
    const start=qs("#logStart").value;
    const end=qs("#logEnd").value;
    const activity=qs("#logActivity").value;
    const points=computePoints(date,start,end);
    const row={ id: crypto.randomUUID(), house_id: houseId, date, who, start, end, activity, points, created_at: new Date().toISOString() };
    await addLog(row);
    qs("#logForm").reset();
    const owner = localStorage.getItem(ownerKey) || "A";
    qs("#logWho").value = owner;
  });

  // Table delegation for copy/delete
  document.body.addEventListener("click",(e)=>{
    const del = e.target.closest(".deleteBtn");
    if(del){
      const id = del.dataset.id;
      if(id){ delLog(id); }
      return;
    }
    const copy = e.target.closest(".copyBtn");
    if(copy){
      const id = copy.dataset.id;
      const row = state.log.find(r=>r.id===id);
      if(row){ copyToForm(row); }
      return;
    }
  });
}

async function init(){
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Owner init
  const owner = localStorage.getItem(ownerKey);
  if(owner){
    const name = owner==="A"?NAMES.A:NAMES.B;
    const ownerNameEl = document.getElementById("ownerName");
    if(ownerNameEl) ownerNameEl.textContent = name;
    document.getElementById("ownerIndicator").classList.remove("hidden");
    document.getElementById("ownerSetup").classList.add("hidden");
    qs("#logWho").value = owner;
  }

  // Household auto-join
  if(houseId){
    const houseLabel = document.getElementById("houseLabel");
    if(houseLabel) houseLabel.textContent = "Hogar: " + houseId;
    document.getElementById("housePanel").classList.add("hidden");
    document.getElementById("houseIndicator").classList.remove("hidden");
    await loadLog(); subscribeLog();
  }else{
    document.getElementById("housePanel").classList.remove("hidden");
    document.getElementById("houseIndicator").classList.add("hidden");
  }

  initEvents();
  console.log("App iniciada", VERSION);
}
document.addEventListener("DOMContentLoaded", init);
