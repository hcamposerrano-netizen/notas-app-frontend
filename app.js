// ==============================================================
// 📱 APLICACIÓN DE NOTAS - VERSIÓN 8.0 (EXPERIENCIA MÓVIL PREMIUM)
// ==============================================================

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://vtxcjzglafbhdcrehamc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzILNdiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0eGNqemdsYWZiaGRjcmVoYW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4NDQzMTIsImV4cCI6MjA3MTQyMDMxMn0.Mc2ot-pr4XVt0pFfbydDu2aCUhduuhT3Tc54tYQfu60';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- CONFIGURACIÓN DE LA API ---
const API_BASE_URL = "https://notas-app-backend-q1ne.onrender.com";

// ==============================================================
// 🔐 MÓDULO DE AUTENTICACIÓN
// ==============================================================
const AuthManager = {
    session: null,
    init() {
        supabaseClient.auth.onAuthStateChange((event, session) => {
            this.session = session;
            this.renderUI();
        });
    },
    renderUI() {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');
        if (this.session) {
            authContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = this.session.user.email;
            if (!NotesApp.isInitialized) NotesApp.init();
        } else {
            authContainer.style.display = 'block';
            appContainer.style.display = 'none';
        }
    },
    async signInWithGoogle() {
        const { error } = await supabaseClient.auth.signInWithOAuth({ provider: 'google' });
        if (error) console.error("Error al iniciar sesión:", error);
    },
    async signOut() {
        if (confirm("¿Estás seguro de que quieres cerrar sesión?") && confirm("Esta acción terminará tu sesión actual. ¿Continuar?")) {
            const { error } = await supabaseClient.auth.signOut();
            if (error) console.error("Error al cerrar sesión:", error);
        }
    },
    getToken() {
        return this.session?.access_token || null;
    }
};

// ==============================================================
// 📱 MÓDULO PRINCIPAL DE LA APLICACIÓN
// ==============================================================
const NotesApp = {
    isInitialized: false,
    notes: new Map(),
    quickNote: "",
    links: [],
    columnNames: {},
    COLORS: [ { name: "Amarillo", value: "#f1e363ff" }, { name: "Azul", value: "#81d4fa" }, { name: "Verde", value: "#78a347ff" }, { name: "Rosa", value: "#b16982ff" }, { name: "Lila", value: "#8b5794ff" }, { name: "Naranja", value: "#ce730cff" }, { name: "Turquesa", value: "#558f97ff" }, { name: "Gris", value: "#afa4a4ff" } ],

    // --- MÉTODOS DE API PROTEGIDOS ---
    async fetchWithAuth(url, options = {}) {
        const token = AuthManager.getToken();
        if (!token) {
            console.error("No hay token de autenticación.");
            return null;
        }
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        return fetch(url, { ...options, headers });
    },

    async refreshAllData() {
        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes`);
            if (!response || !response.ok) throw new Error("No se pudo obtener los datos del servidor");
            const notesFromServer = await response.json();
            this.notes.clear();
            (notesFromServer || []).forEach(n => this.notes.set(n.id, n));
            this.renderNotes();
        } catch (error) { console.error('❌ Error al recargar datos:', error); }
    },

    async apiUpdate(note) {
        const { fecha, hora, ...noteToSend } = note;
        try {
            await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${note.id}`, { 
                method: 'PUT', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(noteToSend) 
            });
            await this.refreshAllData();
        } catch (error) { console.error(`❌ Error al actualizar nota ${note.id}:`, error); }
    },
    
    async handleFileUpload(noteId, file) {
        if (!file || file.size > 5 * 1024 * 1024) { 
            alert(file ? "❌ El archivo es demasiado grande (máx 5MB)." : "No se seleccionó archivo.");
            return;
        }
        const formData = new FormData();
        formData.append('file', file);
        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${noteId}/upload`, { method: 'POST', body: formData });
            if (!response || !response.ok) throw new Error('Error en la respuesta del servidor.');
            alert('✅ Archivo subido con éxito!');
            await this.refreshAllData();
        } catch (error) { console.error('❌ Error al subir el archivo:', error); alert('❌ Hubo un problema al subir el archivo.'); }
    },

    // --- LÓGICA DEL MODAL DE CREACIÓN ---
    createNote() {
        const overlay = document.getElementById('new-note-overlay');
        document.getElementById('new-note-form').reset();
        overlay.classList.remove('overlay-hidden');
        document.getElementById('new-note-nombre').focus();
    },

    _populateColorSelector() {
        const select = document.getElementById('new-note-color');
        select.innerHTML = '';
        this.COLORS.forEach(color => {
            const option = document.createElement('option');
            option.value = color.value;
            option.textContent = color.name;
            if (color.value === "#f1e363ff") option.selected = true;
            select.appendChild(option);
        });
    },

    async _handleCreateNoteSubmit(event) {
        event.preventDefault();
        const noteData = {
            nombre: document.getElementById('new-note-nombre').value || "Nueva Nota",
            contenido: document.getElementById('new-note-contenido').value,
            tipo: document.getElementById('new-note-tipo').value,
            color: document.getElementById('new-note-color').value,
            fecha_hora: null,
            fijada: false
        };
        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            if (!response || !response.ok) throw new Error('Error del servidor al crear la nota.');
            
            const newNote = await response.json(); // Obtenemos la nota creada para la animación
            
            this._closeNewNoteModal();
            await this.refreshAllData();

            // Después de renderizar todo, encontramos la nueva nota y la animamos
            setTimeout(() => {
                const newNoteElement = document.querySelector(`.note[data-note-id='${newNote.id}']`);
                if (newNoteElement) {
                    newNoteElement.classList.add('note-entering');
                }
            }, 50);

        } catch (error) { console.error('❌ Error al crear nota desde el modal:', error); alert('Hubo un problema al guardar la nota.'); }
    },
    
    _closeNewNoteModal() {
        document.getElementById('new-note-overlay').classList.add('overlay-hidden');
    },
    
    // --- FUNCIONES DE LÓGICA Y RENDERIZADO ---
    async handleDateTimeChange(note, dateInput, timeInput) {
        let new_fecha_hora = null;
        if (dateInput.value) {
            new_fecha_hora = `${dateInput.value}T${timeInput.value || '00:00'}:00.000Z`;
        }
        if (note.fecha_hora !== new_fecha_hora) {
            note.fecha_hora = new_fecha_hora;
            await this.apiUpdate(note);
        }
    },
      
    async deletePastNotes() {
        const notesToDeleteIds = Array.from(this.notes.values()).filter(n => n.fecha_hora && n.fecha_hora < new Date().toISOString() && n.tipo === 'Entrega').map(n => n.id);
        if (notesToDeleteIds.length === 0) return alert("👍 No hay entregas antiguas para eliminar.");
        if (!confirm(`🧹 ¿Seguro que quieres borrar ${notesToDeleteIds.length} entrega(s) pasada(s)?`)) return;
        try {
            await Promise.all(notesToDeleteIds.map(id => this.fetchWithAuth(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' })));
            await this.refreshAllData();
            alert(`🧹 ${notesToDeleteIds.length} entregas antiguas fueron eliminadas.`);
        } catch (error) { console.error('❌ Error durante el borrado en lote:', error); }
    },
      
    renderNotes() { const c = document.getElementById("columns-container"); c.innerHTML = ""; const g = this.groupNotesByColor(); for (let [color, group] of Object.entries(g)) { this.createColumnForColor(color, group, c); } this.updateReminders(); },
    sortNotes(a, b) { if (b.fijada !== a.fijada) return b.fijada - a.fijada; const dA = a.fecha_hora ? new Date(a.fecha_hora) : null; const dB = b.fecha_hora ? new Date(b.fecha_hora) : null; if (!dA && dB) return 1; if (dA && !dB) return -1; return dA - dB; },
    groupNotesByColor() { const g = {}; for (let n of this.notes.values()) { (g[n.color] = g[n.color] || []).push(n); } for (let group of Object.values(g)) { group.sort(this.sortNotes); } return g; },
    createColumnForColor(c, n, cont) { const col = document.createElement("div"); col.className = "column"; const d = this.COLORS.find(cl => cl.value === c)?.name || "Sin nombre"; const t = this.createColumnTitle(c, d); col.appendChild(t); n.forEach(note => col.appendChild(this.createNoteElement(note))); cont.appendChild(col); },
    createColumnTitle(c, d) { const i = document.createElement("input"); i.type = "text"; i.placeholder = d; i.value = this.columnNames[c] || d; Object.assign(i.style, { fontWeight: "bold", fontSize: "1.1em", marginBottom: "0.5em", border: "none", borderBottom: "2px solid #ccc", background: "transparent", textAlign: "center", width: "100%" }); i.oninput = () => { this.columnNames[c] = i.value; localStorage.setItem('columnNames', JSON.stringify(this.columnNames)); }; return i; },
    createNoteElement(n) { const d = document.createElement("div"); d.className = "note"; d.dataset.noteId = n.id; this.styleNoteElement(d, n); const l = this.createTypeLabel(n); const i = this.createNameInput(n); const s = this.createTypeSelect(n, l); const t = this.createContentArea(n); const aL = this.createAttachmentLink(n); const ctrl = this.createControls(n); const cC = this.getContrastColor(n.color); i.style.color = cC; t.style.color = cC; d.append(l, i, s, t, aL, ctrl); return d; },
    styleNoteElement(d, n) { d.style.backgroundColor = n.color; d.style.color = this.getContrastColor(n.color); d.style.paddingLeft = "0.5rem"; d.style.borderLeft = `5px solid ${n.tipo === "Entrega" ? '#d32f2f' : '#1976d2'}`; },
    createDateInput(n, t) { const i = document.createElement("input"); i.type = "date"; i.value = n.fecha || ''; i.onchange = () => this.handleDateTimeChange(n, i, t); return i; },
    createTimeInput(n, d) { const i = document.createElement("input"); i.type = "time"; i.value = n.hora || ''; i.style.width = "75px"; i.onchange = () => this.handleDateTimeChange(n, d, i); return i; },
    
    // ⭐ NUEVA FUNCIÓN DE CONTROLES CON MENÚ DESPLEGABLE ⭐
    createControls(n) {
        const controlsContainer = document.createElement("div");
        controlsContainer.className = "controls";
    
        let dateInput, timeInput;
        timeInput = this.createTimeInput(n, dateInput);
        dateInput = this.createDateInput(n, timeInput);
        controlsContainer.append(dateInput, timeInput);
    
        const moreOptionsBtn = document.createElement("button");
        moreOptionsBtn.className = "more-options-btn";
        moreOptionsBtn.textContent = "⋮";
        moreOptionsBtn.title = "Más opciones";
        
        const menu = document.createElement("div");
        menu.className = "note-menu";
    
        const editBtn = document.createElement("button");
        editBtn.innerHTML = "📝<span>Editar Avanzado</span>";
        editBtn.onclick = () => this.Editor.open(n.id);
    
        const uploadBtn = document.createElement("button");
        uploadBtn.innerHTML = "📎<span>Adjuntar Archivo</span>";
        uploadBtn.onclick = () => {
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = ".pdf,.jpg,.jpeg,.png,.txt";
            fileInput.onchange = (e) => this.handleFileUpload(n.id, e.target.files[0]);
            fileInput.click();
        };
    
        const pinBtn = this.createPinButton(n);
        pinBtn.innerHTML = n.fijada ? "📌<span>Desfijar Nota</span>" : "📍<span>Fijar Nota</span>";
    
        const deleteBtn = this.createDeleteButton(n);
        deleteBtn.innerHTML = "🗑️<span>Borrar Nota</span>";
    
        const colorSelectLabel = document.createElement("label");
        colorSelectLabel.textContent = "🎨 Color:";
        const colorSelect = this.createColorSelect(n);
        const colorSelectContainer = document.createElement("div");
        colorSelectContainer.className = "menu-color-select";
        colorSelectContainer.append(colorSelectLabel, colorSelect);
    
        menu.append(editBtn, uploadBtn, pinBtn, deleteBtn, colorSelectContainer);
        
        moreOptionsBtn.onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.note-menu.show').forEach(m => {
                if (m !== menu) m.classList.remove('show');
            });
            menu.classList.toggle('show');
        };
    
        controlsContainer.append(moreOptionsBtn, menu);
        return controlsContainer;
    },

    createAttachmentLink(n) { const c = document.createElement('div'); if (n.attachment_url && n.attachment_filename) { c.style.marginTop = "0.5rem"; const l = document.createElement('a'); l.href = n.attachment_url; l.target = "_blank"; l.textContent = `📄 ${n.attachment_filename}`; l.style.color = this.getContrastColor(n.color); l.style.textDecoration = "underline"; l.style.fontSize = "0.85rem"; c.appendChild(l); } return c; },
    createTypeLabel(n) { const l = document.createElement("div"); l.className = "note-type-label"; l.textContent = n.tipo || "Clase"; Object.assign(l.style, { fontSize: "0.7em", fontWeight: "bold", marginBottom: "0.2em" }); return l; },
    createNameInput(n) { const i = document.createElement("input"); i.type = "text"; i.placeholder = "Título..."; i.value = n.nombre || ""; i.oninput = () => { n.nombre = i.value; this.debouncedSave(n.id); }; return i; },
    createContentArea(n) { const t = document.createElement("textarea"); t.value = n.contenido; t.oninput = () => { n.contenido = t.value; this.debouncedSave(n.id); }; return t; },
    createTypeSelect(n, l) { const s = document.createElement("select"); ["Clase", "Entrega"].forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; if (t === n.tipo) o.selected = true; s.appendChild(o); }); s.addEventListener("change", () => { n.tipo = s.value; l.textContent = s.value; this.styleNoteElement(s.closest('.note'), n); this.apiUpdate(n); }); return s; },
    createColorSelect(n) { const s = document.createElement("select"); this.COLORS.forEach(c => { const o = document.createElement("option"); o.value = c.value; o.textContent = c.name; if (c.value === n.color) o.selected = true; s.appendChild(o); }); s.onchange = () => { n.color = s.value; this.apiUpdate(n); }; return s; },
    createPinButton(n) { const b = document.createElement("button"); b.onclick = (e) => { e.stopPropagation(); n.fijada = !n.fijada; this.apiUpdate(n); }; return b; },
    
    // ⭐ NUEVA FUNCIÓN DE BORRADO CON ANIMACIÓN ⭐
    createDeleteButton(n) {
        const b = document.createElement("button");
        b.onclick = async (e) => {
            e.stopPropagation();
            if (confirm("¿Seguro que quieres borrar esta nota?")) {
                const noteElement = b.closest('.note');
                noteElement.classList.add('note-leaving');
                setTimeout(async () => {
                    await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${n.id}`, { method: 'DELETE' });
                    await this.refreshAllData();
                }, 300);
            }
        };
        return b;
    },

    updateReminders() { const rL = document.getElementById("reminder-list"); const u = [...this.notes.values()].filter(n => n.fecha_hora && new Date(n.fecha_hora) >= new Date() && n.tipo === "Entrega").sort(this.sortNotes).slice(0, 5); rL.innerHTML = ""; u.forEach(n => { const li = document.createElement("li"); li.textContent = `${n.fecha}${n.hora ? ' ' + n.hora : ''} - ${n.nombre || "(sin título)"}`; rL.appendChild(li); }); this.renderLinks(); },
    renderLinks() { const l = document.getElementById("link-list"); if(!l) return; l.innerHTML = ""; this.links.forEach((u, i) => { const li = document.createElement("li"); const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.textContent = u; const d = document.createElement("button"); d.textContent = "🗑️"; d.onclick = () => { this.links.splice(i, 1); this.renderLinks(); }; li.append(a, d); l.appendChild(li); }); },
    getContrastColor(h) { if(!h) return "#000"; const r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16); return ((.299*r+.587*g+.114*b)/255)>.6?"#000":"#fff"; },
    exportData() { const d = { notes: [...this.notes.values()].map(({ fecha, hora, ...rest }) => rest), quickNote: document.getElementById("quick-note")?.value||"", links: this.links, columnNames: this.columnNames }; const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "notas.json"; a.click(); URL.revokeObjectURL(u); },
    async importData(file) { if (!file) return; const reader = new FileReader(); reader.onload = async () => { if (!confirm("¿Estás seguro? Esto reemplazará TODAS las notas actuales.")) return; try { const data = JSON.parse(reader.result); if (data.quickNote) await this.saveQuickNoteToServer(data.quickNote); if (data.columnNames) { this.columnNames = data.columnNames; localStorage.setItem('columnNames', JSON.stringify(this.columnNames));} await Promise.all(Array.from(this.notes.keys()).map(id => this.fetchWithAuth(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' }))); const nTC = (data.notes || []).map(n => { let fN = {...n}; if (fN.fecha_hora) fN.fecha_hora = new Date(fN.fecha_hora).toISOString(); delete fN.id; return fN; }); if (nTC.length > 0) await Promise.all(nTC.map(note => this.fetchWithAuth(`${API_BASE_URL}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) }))); await this.refreshAllData(); alert("✅ ¡Éxito! Los datos han sido importados."); } catch (error) { alert("❌ Error durante la importación."); console.error('❌ Error detallado:', error); } }; reader.readAsText(file); },
    debouncedSave(noteId) { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { const note = this.notes.get(noteId); if (note) this.apiUpdate(note); }, 1000); },
    async saveQuickNoteToServer(c) { try { await this.fetchWithAuth(`${API_BASE_URL}/api/settings/quicknote`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: c }) }); } catch (e) { console.error('❌ Error al guardar nota rápida:', e); } },

    // --- PUNTO DE ENTRADA Y CONFIGURACIÓN ---
    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.Editor.init(this);
        this.setupEventListeners();
        try { 
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/settings/quicknote`); 
            if (response && response.ok) {
                document.getElementById('quick-note').value = (await response.json()).value || '';
            }
        } catch (e) { console.error('❌ No se pudo cargar la nota rápida:', e); }
        try { this.columnNames = JSON.parse(localStorage.getItem('columnNames')) || {}; } catch (e) { this.columnNames = {}; }
        await this.refreshAllData();
        console.log('✅ Aplicación principal iniciada correctamente');
    },

    setupEventListeners() {
        document.getElementById("add-note").onclick = () => this.createNote();
        document.getElementById("export-json").onclick = () => this.exportData();
        document.getElementById("import-json").onchange = (e) => this.importData(e.target.files[0]);
        document.getElementById("add-link").onclick = () => { const i = document.getElementById("link-input"); if (i.value.trim()) { this.links.push(i.value.trim()); i.value = ""; this.renderLinks(); } };
        const q = document.getElementById("quick-note");
        q.addEventListener('input', () => { if (this.quickNoteDebounce) clearTimeout(this.quickNoteDebounce); this.quickNoteDebounce = setTimeout(() => this.saveQuickNoteToServer(q.value), 1000); });
        window.deletePastNotes = () => this.deletePastNotes();

        const newNoteForm = document.getElementById('new-note-form');
        const closeModalBtn = document.getElementById('close-modal-btn');
        const newNoteOverlay = document.getElementById('new-note-overlay');
        newNoteForm.addEventListener('submit', (event) => this._handleCreateNoteSubmit(event));
        closeModalBtn.addEventListener('click', () => this._closeNewNoteModal());
        newNoteOverlay.addEventListener('click', (event) => { if (event.target === newNoteOverlay) this._closeNewNoteModal(); });
        
        this._populateColorSelector();
    },
};

// ==============================================================
// 🚀 INICIO GLOBAL
// ==============================================================
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('login-button').addEventListener('click', () => AuthManager.signInWithGoogle());
    document.getElementById('logout-button').addEventListener('click', () => AuthManager.signOut());
    AuthManager.init();
});

window.NotesApp = NotesApp;