// ==============================================================
// 📱 APLICACIÓN DE NOTAS - VERSIÓN 10.1 (ESTRUCTURA CORREGIDA)
// ==============================================================

// --- CONFIGURACIÓN DE SUPABASE ---
const SUPABASE_URL = 'https://vtxcjzglafbhdcrehamc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0eGNqemdsYWZiaGRjcmVoYW1jIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NTg0NDMxMiwiZXhwIjoyMDcxNDIwMzEyfQ.Nn2qLvYxzvNT-iZSCI5IEWZ26JKyhrQX1uYYlnp6KzU';
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
            if (!NotesApp.isInitialized) {
                NotesApp.init();
            }
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
    columnOrder: [],
    activeColorFilter: 'all',
    isViewingArchived: false,
    COLORS: [ { name: "Amarillo", value: "#f1e363ff" }, { name: "Azul", value: "#81d4fa" }, { name: "Verde", value: "#78a347ff" }, { name: "Rosa", value: "#b16982ff" }, { name: "Lila", value: "#8b5794ff" }, { name: "Naranja", value: "#ce730cff" }, { name: "Turquesa", value: "#558f97ff" }, { name: "Gris", value: "#afa4a4ff" } ],

        _processNote(note) {
        if (note.fecha_hora) {
            const localDate = new Date(note.fecha_hora);
            
            // Corrección: Construir la fecha YYYY-MM-DD usando métodos locales
            const year = localDate.getFullYear();
            const month = String(localDate.getMonth() + 1).padStart(2, '0'); // Meses son 0-11
            const day = String(localDate.getDate()).padStart(2, '0');
            
            note.fecha = `${year}-${month}-${day}`; // <-- Solución
            note.hora = localDate.toTimeString().substring(0, 5);
        }
        return note;
    },

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
        const endpoint = this.isViewingArchived ? '/api/notes/archived' : '/api/notes';
        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}${endpoint}`);
            if (!response) return;
            if (!response.ok) throw new Error("No se pudo obtener los datos del servidor. Estado: " + response.status);
            
            const notesFromServer = await response.json();
            if (Array.isArray(notesFromServer)) {
                this.notes.clear();
                notesFromServer.forEach(n => {
                    const processedNote = this._processNote(n);
                    this.notes.set(processedNote.id, processedNote);
                });
            } else {
                console.error('Respuesta inesperada del servidor, se esperaba un array pero se recibió:', notesFromServer);
                this.notes.clear();
            }
            this.renderNotes();
        } catch (error) { console.error('❌ Error al recargar datos:', error); }
    },

    async apiUpdate(note) {
        const { fecha, hora, ...noteToSend } = note;
        try {
            await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${note.id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(noteToSend)
            });
            await this.refreshAllData();
        } catch (error) { console.error(`❌ Error al actualizar nota ${note.id}:`, error); }
    },

    async toggleArchiveNote(note) {
        const noteElement = document.querySelector(`.note[data-note-id='${note.id}']`);
        if(noteElement) noteElement.classList.add('note-leaving');

        setTimeout(async () => {
            try {
                await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${note.id}/archive`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ is_archived: !note.is_archived })
                });
                await this.refreshAllData();
            } catch (error) {
                console.error("Error al archivar/desarchivar", error);
                if(noteElement) noteElement.classList.remove('note-leaving');
            }
        }, 300);
    },

    async toggleNoteNotifications(note) {
        const newState = !note.notificaciones_activas;
        
        if (newState && Notification.permission !== 'granted') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                alert('No se pueden activar las notificaciones sin tu permiso.');
                return;
            }
        }
        
        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${note.id}/notifications`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notificaciones_activas: newState })
            });
            if (!response || !response.ok) throw new Error('Error al actualizar en el servidor.');
            
            const updatedNote = await response.json();
            this.notes.set(note.id, this._processNote(updatedNote));
            this.renderNotes();
            
            alert(`Notificaciones ${newState ? 'activadas' : 'desactivadas'} para esta nota.`);

        } catch (error) {
            console.error("Error al cambiar estado de notificación:", error);
            alert("Hubo un problema al cambiar el estado de las notificaciones.");
        }
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
        } catch (error) {
            console.error('❌ Error al subir el archivo:', error);
            alert('❌ Hubo un problema al subir el archivo.');
        }
    },
    
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
        const fecha = document.getElementById('new-note-fecha').value;
        const hora = document.getElementById('new-note-hora').value;
        let fecha_hora = null;

        if (fecha) {
            const horaFinal = hora || '12:00'; 
            const [year, month, day] = fecha.split('-').map(Number);
            const [hours, minutes] = horaFinal.split(':').map(Number);
            const localDate = new Date(year, month - 1, day, hours, minutes);
            fecha_hora = localDate.toISOString();
        }

        const noteData = {
            nombre: document.getElementById('new-note-nombre').value || "Nueva Nota",
            contenido: document.getElementById('new-note-contenido').value,
            tipo: document.getElementById('new-note-tipo').value,
            color: document.getElementById('new-note-color').value,
            fecha_hora: fecha_hora,
            fijada: false,
            notificaciones_activas: document.getElementById('new-note-notificaciones').checked
        };

        try {
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(noteData)
            });
            if (!response || !response.ok) throw new Error('Error del servidor al crear la nota.');
            
            const newNoteRaw = await response.json();
            const newNote = this._processNote(newNoteRaw);
            this.notes.set(newNote.id, newNote);

            this.renderNotes();
            const newNoteElement = document.querySelector(`.note[data-note-id='${newNote.id}']`);
            if (newNoteElement) newNoteElement.classList.add('note-entering');
            
            this._closeNewNoteModal();
        } catch (error) {
            console.error('❌ Error al crear nota desde el modal:', error);
            alert('Hubo un problema al guardar la nota.');
        }
    },

    _closeNewNoteModal() {
        document.getElementById('new-note-overlay').classList.add('overlay-hidden');
    },

    async handleDateTimeChange(note, dateInput, timeInput) {
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
        this.debounceTimeout = setTimeout(async () => {
            let new_fecha_hora = null;
            
            if (dateInput.value) {
                const horaFinal = timeInput.value || '12:00';
                const [year, month, day] = dateInput.value.split('-').map(Number);
                const [hours, minutes] = horaFinal.split(':').map(Number);
                const localDate = new Date(year, month - 1, day, hours, minutes);
                new_fecha_hora = localDate.toISOString();
            }

            if (note.fecha_hora !== new_fecha_hora) {
                note.fecha_hora = new_fecha_hora;
                await this.apiUpdate(note);
            }
        }, 1000);
    },

    async deletePastNotes() {
        const notesToDeleteIds = Array.from(this.notes.values()).filter(n => n.fecha_hora && new Date(n.fecha_hora) < new Date() && n.tipo === 'Entrega').map(n => n.id);
        if (notesToDeleteIds.length === 0) return alert("👍 No hay entregas antiguas para eliminar.");
        if (!confirm(`🧹 ¿Seguro que quieres borrar ${notesToDeleteIds.length} entrega(s) pasada(s)?`)) return;
        try {
            await Promise.all(notesToDeleteIds.map(id => this.fetchWithAuth(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' })));
            await this.refreshAllData();
            alert(`🧹 ${notesToDeleteIds.length} entregas antiguas fueron eliminadas.`);
        } catch (error) {
            console.error('❌ Error durante el borrado en lote:', error);
        }
    },

    renderNotes() {
        this.createColorFilterPanel();
        const container = document.getElementById("columns-container");
        container.innerHTML = "";

        if (this.notes.size === 0) {
            const message = this.isViewingArchived 
                ? `<h3>🗄️ No hay notas archivadas</h3><p>Puedes archivar notas desde el menú de opciones (⋮).</p>`
                : `<h3>✨ Tu espacio está listo</h3><p>Crea tu primera nota para empezar a organizarte.</p>`;
            container.innerHTML = `<div class="empty-state-message">${message}</div>`;
            this.updateReminders();
            return;
        }

        const grouped = this.groupNotesByColor();
        const allCurrentColors = Object.keys(grouped);
        const validStoredOrder = this.columnOrder.filter(color => allCurrentColors.includes(color));
        const newColors = allCurrentColors.filter(color => !this.columnOrder.includes(color));
        const finalSortedColors = [...validStoredOrder, ...newColors];
        this.columnOrder = finalSortedColors;
        localStorage.setItem('columnOrder', JSON.stringify(this.columnOrder));

        for (let color of finalSortedColors) {
            if (!grouped[color]) continue;
            const column = this.createColumnForColor(color, grouped[color]);
            if (this.activeColorFilter !== 'all' && this.activeColorFilter !== color) {
                column.classList.add('column-hidden-by-filter');
            }
            container.appendChild(column);
        }
        this.updateReminders();
        this._initColumnDragAndDrop();
    },

    createColorFilterPanel() {
        let panel = document.getElementById("color-filter-panel");
        if (!panel) {
            panel = document.createElement("div");
            panel.id = "color-filter-panel";
            document.getElementById("main-container").prepend(panel);
        }
        panel.innerHTML = "";
        const allBtn = document.createElement("button");
        allBtn.textContent = "Todos";
        allBtn.onclick = () => { this.activeColorFilter = 'all'; this.renderNotes(); };
        if (this.activeColorFilter === 'all') allBtn.classList.add('active');
        panel.appendChild(allBtn);
        this.COLORS.forEach(c => {
            const btn = document.createElement("button");
            btn.style.backgroundColor = c.value;
            btn.onclick = () => { this.activeColorFilter = c.value; this.renderNotes(); };
            if (this.activeColorFilter === c.value) btn.classList.add('active');
            panel.appendChild(btn);
        });
    },
    
    _initColumnDragAndDrop() {
        const container = document.getElementById("columns-container");
        if (!container || this.isViewingArchived || window.innerWidth <= 768) return;
        new Sortable(container, {
            animation: 150, handle: '.column-title-draggable', ghostClass: 'sortable-ghost', dragClass: 'sortable-drag',
            onEnd: (evt) => {
                const movedItem = this.columnOrder.splice(evt.oldIndex, 1)[0];
                this.columnOrder.splice(evt.newIndex, 0, movedItem);
                localStorage.setItem('columnOrder', JSON.stringify(this.columnOrder));
            }
        });
    },

    sortNotes(a, b) {
        if (a.fijada && !b.fijada) return -1;
        if (!a.fijada && b.fijada) return 1;
        if (a.fecha_hora && b.fecha_hora) return new Date(a.fecha_hora) - new Date(b.fecha_hora);
        if (a.fecha_hora) return -1;
        if (b.fecha_hora) return 1;
        return a.id > b.id ? 1 : -1;
    },

    groupNotesByColor() {
        const grouped = {};
        Array.from(this.notes.values()).forEach(note => {
            const color = note.color || "#f1e363ff";
            if (!grouped[color]) grouped[color] = [];
            grouped[color].push(note);
        });
        for (let color in grouped) { grouped[color].sort(this.sortNotes); }
        return grouped;
    },

    createColumnForColor(color, notesInGroup) {
        const column = document.createElement("div");
        column.className = "column";
        column.dataset.color = color;
        column.appendChild(this.createColumnTitle(color, notesInGroup.length));
        const notesContainer = document.createElement("div");
        notesInGroup.forEach(note => notesContainer.appendChild(this.createNoteElement(note)));
        column.appendChild(notesContainer);
        return column;
    },
    
    createColumnTitle(color, noteCount) {
        const titleContainer = document.createElement("div");
        titleContainer.className = "column-title-draggable";
        const colorData = this.COLORS.find(c => c.value === color);
        const colorName = colorData ? colorData.name : "Sin Color";
        const titleInput = document.createElement("input");
        titleInput.type = "text";
        titleInput.value = this.columnNames[color] || `${colorName} (${noteCount})`;
        titleInput.onchange = () => {
            this.columnNames[color] = titleInput.value;
            localStorage.setItem('columnNames', JSON.stringify(this.columnNames));
        };
        titleContainer.appendChild(titleInput);
        return titleContainer;
    },
    
    createNoteElement(note) {
        const noteDiv = document.createElement("div");
        noteDiv.className = "note";
        noteDiv.dataset.noteId = note.id;
        const typeLabel = this.createTypeLabel(note);
        const nameInput = this.createNameInput(note);
        const contentArea = this.createContentArea(note);
        const controls = this.createControls(note, typeLabel);
        const attachmentLink = this.createAttachmentLink(note);
        noteDiv.append(typeLabel, nameInput, contentArea, attachmentLink, controls);
        this.styleNoteElement(noteDiv, note);
        return noteDiv;
    },
    
    styleNoteElement(div, note) {
        div.style.backgroundColor = note.color || "#f1e363ff";
        const contrastColor = this.getContrastColor(note.color);
        div.style.color = contrastColor;
        div.querySelectorAll('input, textarea').forEach(el => el.style.color = contrastColor);
        div.style.borderLeft = note.tipo === 'Entrega' ? '4px solid #d32f2f' : '4px solid transparent';
    },

    createControls(n, l) {
        const c = document.createElement("div"); c.className = "controls";
        const dI = document.createElement("input"); dI.type = "date"; dI.value = n.fecha || "";
        const tI = document.createElement("input"); tI.type = "time"; tI.value = n.hora || "";
        dI.onchange = () => this.handleDateTimeChange(n, dI, tI);
        tI.onchange = () => this.handleDateTimeChange(n, dI, tI);
        c.append(dI, tI);
        const mOBtn = document.createElement("button"); mOBtn.className = "more-options-btn"; mOBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
        const menu = this.createNoteMenu(n, l);
        mOBtn.onclick = (e) => { e.stopPropagation(); document.querySelectorAll('.note-menu.show').forEach(m => m !== menu && m.classList.remove('show')); menu.classList.toggle('show'); };
        c.append(mOBtn, menu);
        return c;
    },

    createNoteMenu(n, l) {
        const menu = document.createElement("div"); menu.className = "note-menu";
        const buttons = [
            { html: "📝<span>Editar Avanzado</span>", action: () => this.Editor.open(n.id) },
            { html: "📎<span>Adjuntar Archivo</span>", action: () => { const fI = document.createElement('input'); fI.type = 'file'; fI.onchange = e => this.handleFileUpload(n.id, e.target.files[0]); fI.click(); } },
            { html: n.fijada ? "📌<span>Desfijar</span>" : "📍<span>Fijar</span>", action: () => { n.fijada = !n.fijada; this.apiUpdate(n); } },
            { html: this.isViewingArchived ? "🔄<span>Restaurar</span>" : "🗄️<span>Archivar</span>", action: () => this.toggleArchiveNote(n) },
            { html: n.notificaciones_activas ? "🔕<span>Desactivar Avisos</span>" : "🔔<span>Activar Avisos</span>", action: () => n.fecha_hora ? this.toggleNoteNotifications(n) : alert("Establece una fecha para activar notificaciones.") },
            { html: "🗑️<span>Borrar Nota</span>", action: () => this.deleteNote(n.id) }
        ];
        buttons.forEach(b => { const btn = document.createElement("button"); btn.innerHTML = b.html; btn.onclick = e => { e.stopPropagation(); b.action(); }; menu.appendChild(btn); });
        const tS = this.createTypeSelect(n, l); const cS = this.createColorSelect(n);
        menu.append(tS, cS);
        return menu;
    },

    deleteNote(noteId) {
        if (!confirm("¿Seguro que quieres borrar esta nota?")) return;
        const noteElement = document.querySelector(`.note[data-note-id='${noteId}']`);
        noteElement.classList.add('note-leaving');
        setTimeout(async () => {
            await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${noteId}`, { method: 'DELETE' });
            this.notes.delete(noteId);
            this.renderNotes();
        }, 300);
    },

    createAttachmentLink(n) { const c = document.createElement('div'); c.className = 'attachment-container'; if (n.attachment_url && n.attachment_filename) { c.style.marginTop = "0.5rem"; const l = document.createElement('a'); l.href = n.attachment_url; l.target = "_blank"; l.textContent = `📄 ${n.attachment_filename}`; l.style.color = this.getContrastColor(n.color); l.style.textDecoration = "underline"; c.appendChild(l); } return c; },
    createTypeLabel(n) { const l = document.createElement("div"); l.className = "note-type-label"; l.textContent = n.tipo || "Clase"; return l; },
    createNameInput(n) { const i = document.createElement("input"); i.type = "text"; i.placeholder = "Título..."; i.value = n.nombre || ""; i.oninput = () => { n.nombre = i.value; this.debouncedSave(n.id); }; return i; },
    createContentArea(n) { const t = document.createElement("textarea"); t.value = n.contenido; t.oninput = () => { n.contenido = t.value; this.debouncedSave(n.id); }; return t; },
    createTypeSelect(n, l) { const c = document.createElement("div"); c.className = "menu-type-select"; c.innerHTML = "<label>🏷️ Tipo:</label>"; const s = document.createElement("select"); ["Clase", "Entrega"].forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; if (t === n.tipo) o.selected = true; s.appendChild(o); }); s.onchange = () => { n.tipo = s.value; l.textContent = s.value; this.styleNoteElement(s.closest('.note'), n); this.apiUpdate(n); }; c.appendChild(s); return c; },
    createColorSelect(n) { const c = document.createElement("div"); c.className = "menu-color-select"; c.innerHTML = "<label>🎨 Color:</label>"; const s = document.createElement("select"); this.COLORS.forEach(clr => { const o = document.createElement("option"); o.value = clr.value; o.textContent = clr.name; if (clr.value === n.color) o.selected = true; s.appendChild(o); }); s.onchange = () => { n.color = s.value; this.apiUpdate(n); }; c.appendChild(s); return c; },
    updateReminders() { const rL = document.getElementById("reminder-list"); const u = [...this.notes.values()].filter(n => n.fecha_hora && new Date(n.fecha_hora) >= new Date() && n.tipo === "Entrega").sort(this.sortNotes).slice(0, 5); rL.innerHTML = ""; u.forEach(n => { const li = document.createElement("li"); li.textContent = `${n.fecha} ${n.hora} - ${n.nombre || "(sin título)"}`; rL.appendChild(li); }); },
    getContrastColor(h) { if(!h) return "#000"; const r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16); return ((.299*r+.587*g+.114*b)/255)>.6?"#000":"#fff"; },
    debouncedSave(noteId) { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); this.debounceTimeout = setTimeout(() => { const note = this.notes.get(noteId); if (note) this.apiUpdate(note); }, 1000); },
    async saveQuickNoteToServer(c) { try { await this.fetchWithAuth(`${API_BASE_URL}/api/settings/quicknote`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: c }) }); } catch (e) { console.error('❌ Error al guardar nota rápida:', e); } },

    async init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.Editor.init(this);
        try { this.columnOrder = JSON.parse(localStorage.getItem('columnOrder')) || []; } catch(e) { this.columnOrder = []; }
        try { this.columnNames = JSON.parse(localStorage.getItem('columnNames')) || {}; } catch (e) { this.columnNames = {}; }
        this.setupEventListeners();
        try { 
            const response = await this.fetchWithAuth(`${API_BASE_URL}/api/settings/quicknote`);
            if (response && response.ok) document.getElementById('quick-note').value = (await response.json()).value || '';
        } catch (e) { console.error('❌ No se pudo cargar la nota rápida:', e); }

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            try {
                const response = await this.fetchWithAuth(`${API_BASE_URL}/api/vapid-public-key`);
                if (response && response.ok) {
                    const vapidPublicKey = await response.text();
                    if (window.PushManager && vapidPublicKey) {
                        PushManager.init(this, vapidPublicKey);
                    }
                }
            } catch (e) {
                console.error('❌ No se pudo inicializar el gestor de notificaciones push:', e);
            }
        }

        await this.refreshAllData();
        console.log('✅ Aplicación principal iniciada correctamente');
    },

    _toggleArchivedView() {
        this.isViewingArchived = !this.isViewingArchived;
        const btn = document.getElementById('view-archived-btn');
        btn.textContent = this.isViewingArchived ? '📋 Volver a Notas' : '🗄️ Ver Archivadas';
        document.getElementById('add-note').style.display = this.isViewingArchived ? 'none' : '';
        this.refreshAllData();
    },
    
    setupEventListeners() {
        document.getElementById("add-note").onclick = () => this.createNote();
        document.getElementById("view-archived-btn").onclick = () => this._toggleArchivedView();
        const q = document.getElementById("quick-note");
        q.addEventListener('input', () => { if (this.quickNoteDebounce) clearTimeout(this.quickNoteDebounce); this.quickNoteDebounce = setTimeout(() => this.saveQuickNoteToServer(q.value), 1000); });
        window.deletePastNotes = () => this.deletePastNotes();
        document.getElementById('new-note-form').addEventListener('submit', (e) => this._handleCreateNoteSubmit(e));
        document.getElementById('close-modal-btn').addEventListener('click', () => this._closeNewNoteModal());
        document.getElementById('new-note-overlay').addEventListener('click', (e) => { if (e.target === e.currentTarget) this._closeNewNoteModal(); });
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
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('✅ Service Worker registrado con éxito:', reg))
                .catch(err => console.error('❌ Error al registrar el Service Worker:', err));
        });
    }
});

window.NotesApp = NotesApp;