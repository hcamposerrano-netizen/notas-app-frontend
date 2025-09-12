// ==============================================================
// 📱 APLICACIÓN DE NOTAS - VERSIÓN 10.0 (CON PUSH REAL)
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
            note.fecha = localDate.toISOString().split('T')[0];
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

    // ✨ CORRECCIÓN: Lógica de notificaciones simplificada. Solo actualiza el estado en el backend.
    async toggleNoteNotifications(note) {
        const newState = !note.notificaciones_activas;
        
        // La petición de permiso al usuario es necesaria la primera vez.
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
            
            // Actualizamos la nota localmente y volvemos a renderizar
            const updatedNote = await response.json();
            this.notes.set(note.id, this._processNote(updatedNote));
            this.renderNotes();
            
            alert(`Notificaciones ${newState ? 'activadas' : 'desactivadas'} para esta nota.`);

        } catch (error) {
            console.error("Error al cambiar estado de notificación:", error);
            alert("Hubo un problema al cambiar el estado de las notificaciones.");
        }
    },
    
    // ✨ CORRECCIÓN: Estas funciones ya no son necesarias, el backend se encarga de todo.
    // Se pueden eliminar por completo.
    _postMessageToSW(message) {},
    scheduleNotifications(note) {},
    cancelNotifications(note) {},

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
    
    // El resto de las funciones de renderizado (renderNotes, createNoteElement, etc.) no necesitan cambios.
    // Las he omitido por brevedad, pero debes mantenerlas tal como estaban.
    // ...
    // ... (Mantén aquí tus funciones: renderNotes, createColorFilterPanel, _initColumnDragAndDrop, sortNotes, etc.)
    // ...

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

        // ✨ CORRECCIÓN: Inicializar el gestor de notificaciones push
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

    // A CONTINUACIÓN, PEGA EL RESTO DE TUS FUNCIONES DE `NotesApp` QUE OMITÍ
    // (renderNotes, createColorFilterPanel, _initColumnDragAndDrop, etc.)
    // ...
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