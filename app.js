// v4.3 PWA + Supabase + mejoras
const VERSION = "v4.3";
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
      <td class="actionBtns">
        <button class="copyBtn" data-id="${row.id}" type="button">Copiar</button>
        <button class="editBtn" data-id="${row.id}" type="button">Editar</button>
        <button class="deleteBtn" data-id="${row.id}" type="button">Eliminar</button>
      </td>`;
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
  // No hay textos arriba; si necesitas, puedes usar la sección de config para mensajes
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
      // Actualiza en función del tipo de evento para evitar refrescos completos
      const rec = payload.new || payload.old;
      if(payload.eventType === 'INSERT'){
        state.log.push(payload.new);
      }else if(payload.eventType === 'UPDATE'){
        const i = state.log.findIndex(r=>r.id===payload.new.id);
        if(i>-1) state.log[i] = payload.new;
      }else if(payload.eventType === 'DELETE'){
        const i = state.log.findIndex(r=>r.id===payload.old.id);
        if(i>-1) state.log.splice(i,1);
      }
      renderLog(); renderResumen();
    })
    .subscribe();
}

async function addLog(row){
  // Optimista: agrega localmente mientras llega realtime
  state.log.push(row);
  renderLog(); renderResumen();
  const { error } = await supabaseClient.from('log').insert([ row ]);
  if(error){ console.error(error); }
}
async function updateLog(id, patch){
  const { error } = await supabaseClient.from('log').update(patch).eq('id', id).eq('house_id', houseId);
  if(error){ console.error(error); }
}
async function delLog(id){
  // Optimista: elimina local al tiro
  const idx = state.log.findIndex(r=>r.id===id);
  if(idx>-1){
    state.log.splice(idx,1);
    renderLog(); renderResumen();
  }
  const { error } = await supabaseClient.from('log').delete().eq('id', id).eq('house_id', houseId);
  if(error){ console.error(error); }
}

// Owner UI
function showOwnerIndicator(owner){
  const name = owner==="A"?NAMES.A:NAMES.B;
  qs("#ownerName").textContent = name;
  qs("#ownerIndicator").classList.remove("hidden");
  qs("#ownerSetup").classList.add("hidden");
  qs("#logWho").value = owner;
}
function showOwnerSetup(){
  qs("#ownerIndicator").classList.add("hidden");
  qs("#ownerSetup").classList.remove("hidden");
}

function setEditMode(row){
  qs("#editId").value = row.id;
  qs("#logWho").value = row.who;
  qs("#logDate").value = row.date;
  qs("#logStart").value = row.start;
  qs("#logEnd").value = row.end;
  qs("#logActivity").value = row.activity || "";
  qs("#logNotes").value = row.notes || "";
  qs("#submitBtn").textContent = "Guardar cambios";
  qs("#cancelEdit").classList.remove("hidden");
  switchTab("registro");
}

function clearEditMode(){
  qs("#editId").value = "";
  qs("#submitBtn").textContent = "Agregar";
  qs("#cancelEdit").classList.add("hidden");
  const owner = localStorage.getItem(ownerKey) || "A";
  qs("#logForm").reset();
  qs("#logWho").value = owner;
}

function copyToForm(row){
  // Copia todos los campos al formulario en modo "nuevo" (no edición)
  qs("#editId").value = "";
  qs("#logWho").value = row.who;
  qs("#logDate").value = row.date;
  qs("#logStart").value = row.start;
  qs("#logEnd").value = row.end;
  qs("#logActivity").value = row.activity || "";
  qs("#logNotes").value = row.notes || "";
  qs("#submitBtn").textContent = "Agregar";
  qs("#cancelEdit").classList.add("hidden");
  switchTab("registro");
}

// Init
function initEvents(){
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click", (ev)=>{
    ev.preventDefault(); switchTab(btn.dataset.tab);
  }));

  // Owner buttons
  qs("#setOwnerA").addEventListener("click", ()=>{
    localStorage.setItem(ownerKey, "A");
    showOwnerIndicator("A");
  });
  qs("#setOwnerB").addEventListener("click", ()=>{
    localStorage.setItem(ownerKey, "B");
    showOwnerIndicator("B");
  });
  qs("#changeOwner").addEventListener("click", ()=>{
    localStorage.removeItem(ownerKey);
    showOwnerSetup();
  });

  // Household join / change (al final de la página)
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
    qs("#houseLabel").textContent = "Hogar: " + houseId;
    qs("#housePanel").classList.add("hidden");
    qs("#houseIndicator").classList.remove("hidden");
    loadLog(); subscribeLog();
  });

  qs("#changeHouse").addEventListener("click", ()=>{
    qs("#housePanel").classList.remove("hidden");
    qs("#houseIndicator").classList.add("hidden");
    qs("#houseId").focus();
  });

  // Log form submit (add or update)
  qs("#logForm").addEventListener("submit", async (e)=>{
    e.preventDefault();
    if(!houseId){ alert("Primero ingresa/crea el código del hogar (abajo en Configuración)."); return; }
    const date=qs("#logDate").value;
    const who=qs("#logWho").value;
    const start=qs("#logStart").value;
    const end=qs("#logEnd").value;
    const activity=qs("#logActivity").value;
    const notes=qs("#logNotes").value;
    const editId = qs("#editId").value;

    if(editId){
      const points=computePoints(date,start,end);
      await updateLog(editId, { date, who, start, end, activity, notes, points });
      clearEditMode();
    }else{
      const points=computePoints(date,start,end);
      const row={ id: crypto.randomUUID(), house_id: houseId, date, who, start, end, activity, notes, points, created_at: new Date().toISOString() };
      await addLog(row);
      qs("#logForm").reset();
      const owner = localStorage.getItem(ownerKey) || "A";
      qs("#logWho").value = owner;
    }
  });

  // Cancel edit
  qs("#cancelEdit").addEventListener("click", ()=>{
    clearEditMode();
  });

  // Table delegation for copy/edit/delete
  document.body.addEventListener("click",(e)=>{
    const del = e.target.closest(".deleteBtn");
    if(del){
      const id = del.dataset.id;
      if(id){ delLog(id); }
      return;
    }
    const edit = e.target.closest(".editBtn");
    if(edit){
      const id = edit.dataset.id;
      const row = state.log.find(r=>r.id===id);
      if(row){ setEditMode(row); }
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

  qs("#exportCSV").addEventListener("click", exportCSV);
}

async function init(){
  // Setup Supabase
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Owner init
  const owner = localStorage.getItem(ownerKey);
  if(owner){ showOwnerIndicator(owner); } else { showOwnerSetup(); }

  // Household auto-join
  if(houseId){
    qs("#houseLabel").textContent = "Hogar: " + houseId;
    qs("#housePanel").classList.add("hidden");
    qs("#houseIndicator").classList.remove("hidden");
    await loadLog(); subscribeLog();
  }else{
    qs("#housePanel").classList.remove("hidden");
    qs("#houseIndicator").classList.add("hidden");
  }

  initEvents();
  console.log("App iniciada", VERSION);
}
document.addEventListener("DOMContentLoaded", init);
