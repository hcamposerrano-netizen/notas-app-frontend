// ==============================================================
// 📱 APLICACIÓN DE NOTAS - VERSIÓN 4.1 (LISTA PARA DESPLIEGUE, SIN SHARE)
// ==============================================================

// <-- ¡ACCIÓN! Pega aquí la URL de tu backend en Render
const API_BASE_URL = "https://TU_URL_DE_RENDER.onrender.com";

const NotesApp = {
  // (Propiedades existentes sin cambios)
  notes: new Map(), quickNote: "", links: [], columnNames: {},
  COLORS: [ { name: "Amarillo", value: "#f1e363ff" }, { name: "Azul", value: "#81d4fa" }, { name: "Verde", value: "#78a347ff" }, { name: "Rosa", value: "#b16982ff" }, { name: "Lila", value: "#8b5794ff" }, { name: "Naranja", value: "#ce730cff" }, { name: "Turquesa", value: "#558f97ff" }, { name: "Gris", value: "#afa4a4ff" } ],

  // --- MÉTODOS DE API Y MANEJO DE ESTADO ---
  async refreshAllData() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/notes`); // <-- USANDO LA VARIABLE
      if (!response.ok) throw new Error("No se pudo obtener los datos del servidor");
      const notesFromServer = await response.json();
      this.notes.clear();
      (notesFromServer || []).forEach(n => this.notes.set(n.id, n));
      this.renderNotes();
    } catch (error) { console.error('❌ Error al recargar datos:', error); }
  },

  async apiUpdate(note) {
    const { fecha, hora, ...noteToSend } = note;
    try {
      await fetch(`${API_BASE_URL}/api/notes/${note.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteToSend) }); // <-- USANDO LA VARIABLE
      await this.refreshAllData();
    } catch (error) { console.error(`❌ Error al actualizar nota ${note.id}:`, error); }
  },
  
  // --- ACCIONES DEL USUARIO ---
  async createNote() {
    const noteData = { nombre: "Nueva Nota", fecha_hora: null }; // <-- Mejorado: fecha_hora es null por defecto
    try {
      await fetch(`${API_BASE_URL}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteData) }); // <-- USANDO LA VARIABLE
      await this.refreshAllData();
    } catch (error) { console.error('❌ Error al crear nota:', error); }
  },

  async handleDateTimeChange(note, dateInput, timeInput) {
    const dateValue = dateInput.value; const timeValue = timeInput.value;
    let new_fecha_hora = null;
    if (dateValue) {
      const effectiveTime = timeValue || '00:00';
      new_fecha_hora = `${dateValue}T${effectiveTime}:00.000Z`;
    }
    if (note.fecha_hora !== new_fecha_hora) {
      note.fecha_hora = new_fecha_hora;
      await this.apiUpdate(note);
    }
  },
  
  async deletePastNotes() {
    const today = new Date().toISOString();
    const notesToDeleteIds = Array.from(this.notes.values()).filter(n => n.fecha_hora && n.fecha_hora < today && n.tipo === 'Entrega').map(n => n.id);
    if (notesToDeleteIds.length === 0) { alert("👍 No hay entregas antiguas para eliminar."); return; }
    if (!confirm(`🧹 ¿Seguro que quieres borrar ${notesToDeleteIds.length} entrega(s) pasada(s)?`)) return;
    try {
      const deletePromises = notesToDeleteIds.map(id => fetch(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' })); // <-- USANDO LA VARIABLE
      await Promise.all(deletePromises);
      await this.refreshAllData();
      alert(`🧹 ${notesToDeleteIds.length} entregas antiguas fueron eliminadas.`);
    } catch (error) { console.error('❌ Error durante el borrado en lote:', error); await this.refreshAllData(); }
  },
  
  // --- LÓGICA DE RENDERIZADO --- (Sin cambios en las llamadas a la API)
  renderNotes() { const container = document.getElementById("columns-container"); container.innerHTML = ""; const grouped = this.groupNotesByColor(); for (let [color, group] of Object.entries(grouped)) { this.createColumnForColor(color, group, container); } this.updateReminders(); },
  sortNotes(a, b) { if (b.fijada && !a.fijada) return 1; if (a.fijada && !b.fijada) return -1; const dateA = a.fecha_hora ? new Date(a.fecha_hora) : null; const dateB = b.fecha_hora ? new Date(b.fecha_hora) : null; if (!dateA && dateB) return 1; if (dateA && !dateB) return -1; if (!dateA && !dateB) return 0; return dateA - dateB; },
  groupNotesByColor() { const grouped = {}; for (let note of this.notes.values()) { if (!grouped[note.color]) grouped[note.color] = []; grouped[note.color].push(note); } for (let group of Object.values(grouped)) { group.sort(this.sortNotes); } return grouped; },
  createColumnForColor(c, n, cont) { const col = document.createElement("div"); col.className = "column"; const d = this.COLORS.find(cl => cl.value === c)?.name || "Sin nombre"; const t = this.createColumnTitle(c, d); col.appendChild(t); n.forEach(note => { const el = this.createNoteElement(note); col.appendChild(el); }); cont.appendChild(col); },
  createColumnTitle(c, d) { const i = document.createElement("input"); i.type = "text"; i.placeholder = d; i.value = this.columnNames[c] || d; Object.assign(i.style, { fontWeight: "bold", fontSize: "1.1em", marginBottom: "0.5em", border: "none", borderBottom: "2px solid #ccc", background: "transparent", textAlign: "center", width: "100%" }); i.oninput = () => { this.columnNames[c] = i.value; localStorage.setItem('columnNames', JSON.stringify(this.columnNames)); }; return i; },
  createNoteElement(n) { const d = document.createElement("div"); d.className = "note"; d.dataset.noteId = n.id; this.styleNoteElement(d, n); const l = this.createTypeLabel(n); const i = this.createNameInput(n); const s = this.createTypeSelect(n, l); const t = this.createContentArea(n); const ctrl = this.createControls(n); const cc = this.getContrastColor(n.color); i.style.color = cc; t.style.color = cc; d.append(l, i, s, t, ctrl); return d; },
  styleNoteElement(d, n) { d.style.backgroundColor = n.color; d.style.color = this.getContrastColor(n.color); d.style.paddingLeft = "0.5rem"; if (n.tipo === "Clase") { d.style.borderLeft = "5px solid #1976d2"; } else if (n.tipo === "Entrega") { d.style.borderLeft = "5px solid #d32f2f"; } },
  createDateInput(n, t) { const i = document.createElement("input"); i.type = "date"; i.value = n.fecha || ''; i.onchange = () => this.handleDateTimeChange(n, i, t); return i; },
  createTimeInput(n, d) { const i = document.createElement("input"); i.type = "time"; i.value = n.hora || ''; i.style.width = "75px"; i.onchange = () => this.handleDateTimeChange(n, d, i); return i; },
  
  createControls(n) {
    const c = document.createElement("div"); c.className = "controls"; let d, t;
    t = this.createTimeInput(n, d); d = this.createDateInput(n, t);
    t.onchange = () => this.handleDateTimeChange(n, d, t);
    
    const editBtn = document.createElement("button");
    editBtn.textContent = "📝"; editBtn.title = "Abrir editor avanzado";
    editBtn.onclick = () => this.Editor.open(n.id);
    
    const s = this.createColorSelect(n);
    const b = this.createDeleteButton(n);
    const p = this.createPinButton(n);

    c.append(d, t, s, editBtn, b, p);
    return c;
  },

  createTypeLabel(n) { const l = document.createElement("div"); l.className = "note-type-label"; l.textContent = n.tipo || "Clase"; Object.assign(l.style, { fontSize: "0.7em", fontWeight: "bold", marginBottom: "0.2em" }); return l; },
  createNameInput(n) { const i = document.createElement("input"); i.type = "text"; i.placeholder = "Título..."; i.value = n.nombre || ""; i.oninput = () => { n.nombre = i.value; this.debouncedSave(n.id); }; return i; },
  createContentArea(n) { const t = document.createElement("textarea"); t.value = n.contenido; t.oninput = () => { n.contenido = t.value; this.debouncedSave(n.id); }; return t; },
  createTypeSelect(n, l) { const s = document.createElement("select"); ["Clase", "Entrega"].forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; if (t === n.tipo) o.selected = true; s.appendChild(o); }); s.addEventListener("change", () => { n.tipo = s.value; l.textContent = s.value; this.styleNoteElement(s.closest('.note'), n); this.apiUpdate(n); }); return s; },
  createColorSelect(n) { const s = document.createElement("select"); this.COLORS.forEach(c => { const o = document.createElement("option"); o.value = c.value; o.textContent = c.name; if (c.value === n.color) o.selected = true; s.appendChild(o); }); s.onchange = () => { n.color = s.value; this.apiUpdate(n); }; return s; },
  createPinButton(n) { const b = document.createElement("button"); b.textContent = n.fijada ? "📌" : "📍"; b.onclick = () => { n.fijada = !n.fijada; this.apiUpdate(n); }; return b; },
  createDeleteButton(n) { const b = document.createElement("button"); b.textContent = "🗑️"; b.onclick = async () => { if (confirm("¿Seguro que quieres borrar esta nota?")) { await fetch(`${API_BASE_URL}/api/notes/${n.id}`, { method: 'DELETE' }); await this.refreshAllData(); } }; return b; }, // <-- USANDO LA VARIABLE
  
  updateReminders() { const rl = document.getElementById("reminder-list"); const t = new Date(); const u = [...this.notes.values()].filter(n => n.fecha_hora && new Date(n.fecha_hora) >= t && n.tipo === "Entrega").sort(this.sortNotes).slice(0, 5); rl.innerHTML = ""; u.forEach(n => { const li = document.createElement("li"); li.textContent = `${n.fecha}${n.hora ? ' ' + n.hora : ''} - ${n.nombre || "(sin título)"}`; rl.appendChild(li); }); this.renderLinks(); },
  renderLinks() { const l = document.getElementById("link-list"); if(!l) return; l.innerHTML = ""; this.links.forEach((u, i) => { const li = document.createElement("li"); const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.textContent = u; const d = document.createElement("button"); d.textContent = "🗑️"; d.onclick = () => { this.links.splice(i, 1); this.renderLinks(); }; li.append(a, d); l.appendChild(li); }); },
  getContrastColor(h) { if(!h) return "#000"; const r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16); return ((.299*r+.587*g+.114*b)/255)>.6?"#000":"#fff"; },
  exportData() { const d = [...this.notes.values()].map(({ fecha, hora, ...rest }) => rest); const data = { notes: d, quickNote: document.getElementById("quick-note")?.value||"", links: this.links, columnNames: this.columnNames }; const b = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "notas.json"; a.click(); URL.revokeObjectURL(u); },
  async importData(file) {
    if (!file) return; const reader = new FileReader();
    reader.onload = async () => {
      if (!confirm("¿Estás seguro? Esto reemplazará TODAS las notas actuales.")) return;
      try {
        const data = JSON.parse(reader.result);
        if (data.quickNote) await this.saveQuickNoteToServer(data.quickNote);
        if (data.columnNames) { this.columnNames = data.columnNames; localStorage.setItem('columnNames', JSON.stringify(this.columnNames));}
        await this.refreshAllData();
        const currentNoteIds = Array.from(this.notes.keys());
        if(currentNoteIds.length > 0) { const deletePromises = currentNoteIds.map(id => fetch(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' })); await Promise.all(deletePromises); } // <-- USANDO LA VARIABLE
        const notesToCreate = (data.notes || []).map(n => { let finalNote = {...n}; if (finalNote.fecha_hora) finalNote.fecha_hora = new Date(finalNote.fecha_hora).toISOString(); delete finalNote.id; return finalNote; });
        if (notesToCreate.length > 0) { const postPromises = notesToCreate.map(note => fetch(`${API_BASE_URL}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) })); await Promise.all(postPromises); } // <-- USANDO LA VARIABLE
        await this.refreshAllData();
        alert("✅ ¡Éxito! Los datos han sido importados.");
      } catch (error) { alert("❌ Error durante la importación."); console.error('❌ Error detallado:', error); await this.refreshAllData(); }
    };
    reader.readAsText(file);
  },
  
  debouncedSave(noteId) { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { const note = this.notes.get(noteId); if (note) this.apiUpdate(note); }, 1000); },
  async saveQuickNoteToServer(c) { try { await fetch(`${API_BASE_URL}/api/settings/quicknote`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: c }) }); } catch (e) { console.error('❌ Error al guardar nota rápida:', e); } }, // <-- USANDO LA VARIABLE
  
  setupEventListeners() {
    document.getElementById("add-note").onclick = () => this.createNote();
    document.getElementById("export-json").onclick = () => this.exportData();
    document.getElementById("import-json").onchange = (e) => this.importData(e.target.files[0]);
    document.getElementById("add-link").onclick = () => { const i = document.getElementById("link-input"); if (i.value.trim()) { this.links.push(i.value.trim()); i.value = ""; this.renderLinks(); } };
    const q = document.getElementById("quick-note");
    q.addEventListener('input', () => { if (this.quickNoteDebounce) clearTimeout(this.quickNoteDebounce); this.quickNoteDebounce = setTimeout(() => this.saveQuickNoteToServer(q.value), 1000); });
    window.deletePastNotes = () => this.deletePastNotes();
  },

  async init() {
    console.log('🚀 Iniciando aplicación...');
    this.Editor.init(this);
    this.setupEventListeners();
    try { const r = await fetch(`${API_BASE_URL}/api/settings/quicknote`); const d = await r.json(); document.getElementById('quick-note').value = d.value || ''; } catch (e) { console.error('❌ No se pudo cargar la nota rápida:', e); } // <-- USANDO LA VARIABLE
    const s = localStorage.getItem('columnNames'); if (s) { try { this.columnNames = JSON.parse(s); } catch (e) { this.columnNames = {}; } }
    await this.refreshAllData();
    this.renderLinks();
    console.log('✅ Aplicación iniciada correctamente');
  }
};

document.addEventListener('DOMContentLoaded', () => NotesApp.init());
window.NotesApp = NotesApp;