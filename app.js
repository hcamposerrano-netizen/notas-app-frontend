// ==============================================================
// 📱 APLICACIÓN DE NOTAS - VERSIÓN 9.6 (INICIALIZACIÓN CORREGIDA)
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
        // onAuthStateChange se activa cuando el usuario inicia sesión, cierra sesión, o la sesión se refresca.
        supabaseClient.auth.onAuthStateChange((event, session) => {
            this.session = session;
            this.renderUI();
        });
    },
    renderUI() {
        const authContainer = document.getElementById('auth-container');
        const appContainer = document.getElementById('app-container');
        if (this.session) {
            // El usuario TIENE una sesión válida
            authContainer.style.display = 'none';
            appContainer.style.display = 'flex';
            const userEmailEl = document.getElementById('user-email');
            if (userEmailEl) userEmailEl.textContent = this.session.user.email;
            
            // ✅ LA CORRECCIÓN CLAVE:
            // Solo inicializamos la app DESPUÉS de confirmar que hay una sesión.
            if (!NotesApp.isInitialized) {
                NotesApp.init();
            }
        } else {
            // El usuario NO tiene sesión
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
            const year = localDate.getFullYear();
            const month = (localDate.getMonth() + 1).toString().padStart(2, '0');
            const day = localDate.getDate().toString().padStart(2, '0');
            note.fecha = `${year}-${month}-${day}`;
            const hours = localDate.getHours().toString().padStart(2, '0');
            const minutes = localDate.getMinutes().toString().padStart(2, '0');
            note.hora = `${hours}:${minutes}`;
        }
        return note;
    },

    async fetchWithAuth(url, options = {}) {
        const token = AuthManager.getToken();
        if (!token) {
            console.error("No hay token de autenticación. La sesión podría haber expirado.");
            // Opcional: podrías forzar un logout aquí para limpiar el estado.
            // AuthManager.signOut(); 
            return null;
        }
        const headers = { ...options.headers, 'Authorization': `Bearer ${token}` };
        return fetch(url, { ...options, headers });
    },

    // ... (el resto de tu app.js se mantiene igual) ...

// ✅ CORREGIDO: La función ahora verifica que la respuesta sea un array antes de procesarla.
async refreshAllData() {
    const endpoint = this.isViewingArchived ? '/api/notes/archived' : '/api/notes';
    try {
        const response = await this.fetchWithAuth(`${API_BASE_URL}${endpoint}`);
        if (!response) return;
        if (!response.ok) throw new Error("No se pudo obtener los datos del servidor. Estado: " + response.status);
        
        const notesFromServer = await response.json();

        // --- INICIO DE LA CORRECCIÓN ---
        // Verificamos si la respuesta del servidor es realmente un array
        if (Array.isArray(notesFromServer)) {
            this.notes.clear();
            notesFromServer.forEach(n => { // Ahora esto es seguro
                const processedNote = this._processNote(n);
                this.notes.set(processedNote.id, processedNote);
            });
        } else {
            // Si no es un array, algo está mal en la respuesta del servidor.
            // Lo mostramos en la consola para depurarlo y evitamos que la app se rompa.
            console.error('Respuesta inesperada del servidor, se esperaba un array pero se recibió:', notesFromServer);
            this.notes.clear(); // Limpiamos las notas para no mostrar datos viejos.
        }
        // --- FIN DE LA CORRECCIÓN ---

        this.renderNotes();
    } catch (error) { console.error('❌ Error al recargar datos:', error); }
},

// ... (el resto de tu app.js se mantiene igual) ...

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
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
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
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
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
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notificaciones_activas: newState })
            });

            if (!response || !response.ok) throw new Error('Error al actualizar en el servidor.');

            const updatedNote = await response.json();
            const processedNote = this._processNote(updatedNote);
            this.notes.set(note.id, processedNote); 

            if (processedNote.notificaciones_activas) {
                this.scheduleNotifications(processedNote);
            } else {
                this.cancelNotifications(processedNote);
            }
            
            alert(`Notificaciones ${newState ? 'activadas' : 'desactivadas'} para esta nota.`);
            this.renderNotes(); 
        } catch (error) {
            console.error("Error al cambiar estado de notificación:", error);
            alert("Hubo un problema al cambiar el estado de las notificaciones.");
        }
    },
    
    _postMessageToSW(message) {
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
             navigator.serviceWorker.controller.postMessage(message);
             console.log("Mensaje enviado al Service Worker:", message.type);
        } else {
            console.error("Service Worker no está listo o no es soportado.");
        }
    },

    scheduleNotifications(note) {
        if (!note.fecha_hora) return;
        console.log(`Programando notificaciones para la nota: ${note.nombre}`);
        this._postMessageToSW({
            type: 'SCHEDULE_NOTIFICATION',
            payload: note
        });
    },

    cancelNotifications(note) {
        console.log(`Cancelando notificaciones para la nota: ${note.id}`);
        this._postMessageToSW({
            type: 'CANCEL_NOTIFICATION',
            payload: { id: note.id }
        });
    },

    async handleFileUpload(noteId, file) { if (!file || file.size > 5 * 1024 * 1024) { alert(file ? "❌ El archivo es demasiado grande (máx 5MB)." : "No se seleccionó archivo."); return; } const formData = new FormData(); formData.append('file', file); try { const response = await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${noteId}/upload`, { method: 'POST', body: formData }); if (!response || !response.ok) throw new Error('Error en la respuesta del servidor.'); alert('✅ Archivo subido con éxito!'); await this.refreshAllData(); } catch (error) { console.error('❌ Error al subir el archivo:', error); alert('❌ Hubo un problema al subir el archivo.'); } },
    
    createNote() { 
        const overlay = document.getElementById('new-note-overlay'); 
        document.getElementById('new-note-form').reset(); 
        overlay.classList.remove('overlay-hidden'); 
        document.getElementById('new-note-nombre').focus(); 
    },

    _populateColorSelector() { 
        const select = document.getElementById('new-note-color'); 
        select.innerHTML = ''; this.COLORS.forEach(color => { 
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
            const localDateString = `${fecha}T${hora || '00:00'}:00`;
            const localDate = new Date(localDateString);
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
            // --- INICIO DE LA CORRECCIÓN ---
            const newNote = this._processNote(newNoteRaw); // 1. Procesa la nota y guárdala en una variable
            this.notes.set(newNote.id, newNote);           // 2. Usa la nueva variable para guardarla

            // 3. Ahora 'newNote' existe y se puede usar de forma segura
            if (newNote.notificaciones_activas && newNote.fecha_hora) {
                this.scheduleNotifications(newNote);
            }
            // --- FIN DE LA CORRECCIÓN ---

            this.renderNotes();
            
            const newNoteElement = document.querySelector(`.note[data-note-id='${newNote.id}']`);
            if (newNoteElement) {
                newNoteElement.classList.add('note-entering');
            }
            
            this._closeNewNoteModal();
        } catch (error) {
            console.error('❌ Error al crear nota desde el modal:', error);
            alert('Hubo un problema al guardar la nota.');
        }
    },

    _closeNewNoteModal() { document.getElementById('new-note-overlay').classList.add('overlay-hidden'); },
    
    async handleDateTimeChange(note, dateInput, timeInput) {
        if (this.debounceTimeout) clearTimeout(this.debounceTimeout);
        let new_fecha_hora = null;
        if (dateInput.value) {
            const localDateString = `${dateInput.value}T${timeInput.value || '00:00'}:00`;
            const localDate = new Date(localDateString);
            new_fecha_hora = localDate.toISOString();
        }
        if (note.fecha_hora !== new_fecha_hora) {
            note.fecha_hora = new_fecha_hora;
            await this.apiUpdate(note);
        }
    },

    async deletePastNotes() { const notesToDeleteIds = Array.from(this.notes.values()).filter(n => n.fecha_hora && new Date(n.fecha_hora) < new Date() && n.tipo === 'Entrega').map(n => n.id); if (notesToDeleteIds.length === 0) return alert("👍 No hay entregas antiguas para eliminar."); if (!confirm(`🧹 ¿Seguro que quieres borrar ${notesToDeleteIds.length} entrega(s) pasada(s)?`)) return; try { await Promise.all(notesToDeleteIds.map(id => this.fetchWithAuth(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' }))); await this.refreshAllData(); alert(`🧹 ${notesToDeleteIds.length} entregas antiguas fueron eliminadas.`); } catch (error) { console.error('❌ Error durante el borrado en lote:', error); } },

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
            animation: 150,
            handle: '.column-title-draggable',
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
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
        return a.id > b.id ? 1 : -1; // Fallback sort
    },

    groupNotesByColor() {
        const grouped = {};
        Array.from(this.notes.values()).forEach(note => {
            const color = note.color || "#f1e363ff";
            if (!grouped[color]) grouped[color] = [];
            grouped[color].push(note);
        });
        for (let color in grouped) {
            grouped[color].sort(this.sortNotes);
        }
        return grouped;
    },

    createColumnForColor(color, notesInGroup) {
        const column = document.createElement("div");
        column.className = "column";
        column.dataset.color = color;
        const titleContainer = this.createColumnTitle(color, notesInGroup.length);
        column.appendChild(titleContainer);
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
        if (note.tipo === 'Entrega') {
            div.style.borderLeft = '4px solid #d32f2f';
        } else {
            div.style.borderLeft = '4px solid transparent';
        }
    },

    createControls(n, l) {
        const controlsContainer = document.createElement("div");
        controlsContainer.className = "controls";
        const dateInput = document.createElement("input");
        dateInput.type = "date";
        dateInput.value = n.fecha || "";
        const timeInput = document.createElement("input");
        timeInput.type = "time";
        timeInput.value = n.hora || "";
        dateInput.onchange = () => this.handleDateTimeChange(n, dateInput, timeInput);
        timeInput.onchange = () => this.handleDateTimeChange(n, dateInput, timeInput);
        controlsContainer.append(dateInput, timeInput);
        const moreOptionsBtn = document.createElement("button");
        moreOptionsBtn.className = "more-options-btn";
        moreOptionsBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`;
        moreOptionsBtn.title = "Más opciones";
        const menu = document.createElement("div");
        menu.className = "note-menu";
        const editBtn = document.createElement("button");
        editBtn.innerHTML = "📝<span>Editar Avanzado</span>";
        editBtn.onclick = () => this.Editor.open(n.id);
        const uploadBtn = document.createElement("button");
        uploadBtn.innerHTML = "📎<span>Adjuntar Archivo</span>";
        uploadBtn.onclick = () => { const fI = document.createElement('input'); fI.type = 'file'; fI.accept = ".pdf,.jpg,.jpeg,.png,.txt"; fI.onchange = (e) => this.handleFileUpload(n.id, e.target.files[0]); fI.click(); };
        const pinBtn = this.createPinButton(n);
        const archiveBtn = document.createElement("button");
        archiveBtn.innerHTML = this.isViewingArchived ? "🔄<span>Restaurar</span>" : "🗄️<span>Archivar</span>";
        archiveBtn.onclick = (e) => { e.stopPropagation(); this.toggleArchiveNote(n); };
        const notificationBtn = document.createElement("button");
        const notificationText = n.notificaciones_activas ? "🔕<span>Desactivar Avisos</span>" : "🔔<span>Activar Avisos</span>";
        notificationBtn.innerHTML = notificationText;
        notificationBtn.onclick = (e) => { e.stopPropagation(); if (n.fecha_hora) { this.toggleNoteNotifications(n); } else { alert("Debes establecer una fecha y hora para activar las notificaciones."); } };
        const deleteBtn = this.createDeleteButton(n);
        const typeSelectLabel = document.createElement("label");
        typeSelectLabel.textContent = "🏷️ Tipo:";
        const typeSelect = this.createTypeSelect(n, l);
        const typeSelectContainer = document.createElement("div");
        typeSelectContainer.className = "menu-type-select";
        typeSelectContainer.append(typeSelectLabel, typeSelect);
        const colorSelectLabel = document.createElement("label");
        colorSelectLabel.textContent = "🎨 Color:";
        const colorSelect = this.createColorSelect(n);
        const colorSelectContainer = document.createElement("div");
        colorSelectContainer.className = "menu-color-select";
        colorSelectContainer.append(colorSelectLabel, colorSelect);
        menu.append(editBtn, uploadBtn, pinBtn, archiveBtn, notificationBtn, deleteBtn, typeSelectContainer, colorSelectContainer);
        moreOptionsBtn.onclick = (e) => {
            e.stopPropagation();
            const parentNote = moreOptionsBtn.closest('.note');
            document.querySelectorAll('.note-menu.show').forEach(m => {
                if (m !== menu) {
                    m.classList.remove('show');
                    m.closest('.note').classList.remove('note-menu-open');
                }
            });
            menu.classList.toggle('show');
            parentNote.classList.toggle('note-menu-open');
        };
        controlsContainer.append(moreOptionsBtn, menu);
        return controlsContainer;
    },

    createAttachmentLink(n) { const c = document.createElement('div'); if (n.attachment_url && n.attachment_filename) { c.style.marginTop = "0.5rem"; const l = document.createElement('a'); l.href = n.attachment_url; l.target = "_blank"; l.textContent = `📄 ${n.attachment_filename}`; l.style.color = this.getContrastColor(n.color); l.style.textDecoration = "underline"; l.style.fontSize = "0.85rem"; c.appendChild(l); } return c; },
    createTypeLabel(n) { const l = document.createElement("div"); l.className = "note-type-label"; l.textContent = n.tipo || "Clase"; Object.assign(l.style, { fontSize: "0.7em", fontWeight: "bold", marginBottom: "0.2em" }); return l; },
    createNameInput(n) { const i = document.createElement("input"); i.type = "text"; i.placeholder = "Título..."; i.value = n.nombre || ""; i.oninput = () => { n.nombre = i.value; this.debouncedSave(n.id); }; return i; },
    createContentArea(n) { const t = document.createElement("textarea"); t.value = n.contenido; t.oninput = () => { n.contenido = t.value; this.debouncedSave(n.id); }; return t; },
    
    createTypeSelect(n, l) {
        const s = document.createElement("select");
        ["Clase", "Entrega"].forEach(t => { const o = document.createElement("option"); o.value = t; o.textContent = t; if (t === n.tipo) o.selected = true; s.appendChild(o); });
        s.addEventListener("change", () => { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); n.tipo = s.value; l.textContent = s.value; this.styleNoteElement(s.closest('.note'), n); this.apiUpdate(n); });
        return s;
    },

    createColorSelect(n) {
        const s = document.createElement("select");
        this.COLORS.forEach(c => { const o = document.createElement("option"); o.value = c.value; o.textContent = c.name; if (c.value === n.color) o.selected = true; s.appendChild(o); });
        s.onchange = () => { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); n.color = s.value; this.apiUpdate(n); };
        return s;
    },

    createPinButton(n) {
        const b = document.createElement("button");
        const u = () => { b.innerHTML = n.fijada ? "📌<span>Desfijar Nota</span>" : "📍<span>Fijar Nota</span>"; };
        b.onclick = (e) => { if (this.debounceTimeout) clearTimeout(this.debounceTimeout); e.stopPropagation(); n.fijada = !n.fijada; u(); this.apiUpdate(n); };
        u();
        return b;
    },

    createDeleteButton(n) { const b = document.createElement("button"); b.innerHTML = "🗑️<span>Borrar Nota</span>"; b.onclick = (e) => { e.stopPropagation(); if (confirm("¿Seguro que quieres borrar esta nota?")) { const el = b.closest('.note'); el.classList.add('note-leaving'); setTimeout(async () => { await this.fetchWithAuth(`${API_BASE_URL}/api/notes/${n.id}`, { method: 'DELETE' }); this.notes.delete(n.id); this.renderNotes(); }, 300); } }; return b; },
    updateReminders() { const rL = document.getElementById("reminder-list"); const u = [...this.notes.values()].filter(n => n.fecha_hora && new Date(n.fecha_hora) >= new Date() && n.tipo === "Entrega").sort(this.sortNotes).slice(0, 5); rL.innerHTML = ""; u.forEach(n => { const li = document.createElement("li"); li.textContent = `${n.fecha}${n.hora ? ' ' + n.hora : ''} - ${n.nombre || "(sin título)"}`; rL.appendChild(li); }); this.renderLinks(); },
    renderLinks() { const l = document.getElementById("link-list"); if(!l) return; l.innerHTML = ""; this.links.forEach((u, i) => { const li = document.createElement("li"); const a = document.createElement("a"); a.href = u; a.target = "_blank"; a.textContent = u; const d = document.createElement("button"); d.textContent = "🗑️"; d.onclick = () => { this.links.splice(i, 1); this.renderLinks(); }; li.append(a, d); l.appendChild(li); }); },
    getContrastColor(h) { if(!h) return "#000"; const r=parseInt(h.substr(1,2),16),g=parseInt(h.substr(3,2),16),b=parseInt(h.substr(5,2),16); return ((.299*r+.587*g+.114*b)/255)>.6?"#000":"#fff"; },
    exportData() { const d = { notes: [...this.notes.values()].map(({ fecha, hora, ...rest }) => rest), quickNote: document.getElementById("quick-note")?.value||"", links: this.links, columnNames: this.columnNames }; const b = new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = "notas.json"; a.click(); URL.revokeObjectURL(u); },
    async importData(file) { if (!file) return; const reader = new FileReader(); reader.onload = async () => { if (!confirm("¿Estás seguro? Esto reemplazará TODAS las notas actuales.")) return; try { const data = JSON.parse(reader.result); if (data.quickNote) await this.saveQuickNoteToServer(data.quickNote); if (data.columnNames) { this.columnNames = data.columnNames; localStorage.setItem('columnNames', JSON.stringify(this.columnNames));} await Promise.all(Array.from(this.notes.keys()).map(id => this.fetchWithAuth(`${API_BASE_URL}/api/notes/${id}`, { method: 'DELETE' }))); const nTC = (data.notes || []).map(n => { let fN = {...n}; if (fN.fecha_hora) fN.fecha_hora = new Date(fN.fecha_hora).toISOString(); delete fN.id; return fN; }); if (nTC.length > 0) await Promise.all(nTC.map(note => this.fetchWithAuth(`${API_BASE_URL}/api/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(note) }))); await this.refreshAllData(); alert("✅ ¡Éxito! Los datos han sido importados."); } catch (error) { alert("❌ Error durante la importación."); console.error('❌ Error detallado:', error); } }; reader.readAsText(file); },
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
            if (response && response.ok) { 
                const data = await response.json();
                document.getElementById('quick-note').value = data.value || ''; 
            }
        } catch (e) { console.error('❌ No se pudo cargar la nota rápida:', e); }

        await this.refreshAllData();
        console.log('✅ Aplicación principal iniciada correctamente');
    },

    _toggleArchivedView() {
        this.isViewingArchived = !this.isViewingArchived;
        const btn = document.getElementById('view-archived-btn');
        const addNoteBtn = document.getElementById('add-note');
        const filterPanel = document.getElementById('color-filter-panel');

        if (this.isViewingArchived) {
            btn.textContent = '📋 Volver a Notas';
            btn.classList.add('active');
            addNoteBtn.style.display = 'none';
            if(filterPanel) filterPanel.style.display = 'none';
        } else {
            btn.textContent = '🗄️ Ver Archivadas';
            btn.classList.remove('active');
            addNoteBtn.style.display = '';
            if(filterPanel) filterPanel.style.display = '';
        }
        this.refreshAllData();
    },
    
    setupEventListeners() {
        document.getElementById("add-note").onclick = () => this.createNote();
        document.getElementById("view-archived-btn").onclick = () => this._toggleArchivedView();
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
    
    // Inicia el gestor de autenticación, que a su vez iniciará la app
    // cuando la sesión esté lista.
    AuthManager.init();

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => console.log('✅ Service Worker registrado con éxito:', registration))
                .catch(err => console.error('❌ Error al registrar el Service Worker:', err));
        });
    }
});

// Exponemos el objeto principal al scope global para que otros scripts (como calendar-view) puedan usarlo.
window.NotesApp = NotesApp;