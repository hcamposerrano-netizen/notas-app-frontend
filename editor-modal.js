// ================================
// 📝 MÓDULO DEL EDITOR AVANZADO (VERSIÓN MEJORADA)
// ================================

NotesApp.Editor = {
  
  // Guardamos una referencia a la app principal
  app: null,
  
  init(appInstance) {
    this.app = appInstance;
  },

  open(noteId) {
    const note = this.app.notes.get(noteId);
    if (!note) return;

    // --- 1. CREACIÓN DEL MODAL Y SUS ELEMENTOS ---
    const overlay = document.createElement("div");
    overlay.className = "editor-overlay";

    const modal = document.createElement("div");
    modal.className = "editor-modal";
    
    // Contenido del Modal (Header, Toolbar, Editor)
    modal.innerHTML = `
      <div class="editor-header">
        <h2 id="editor-title">Editando: ${note.nombre || '(Sin título)'}</h2>
        <div>
          <button class="editor-save-btn">Guardar y Cerrar</button>
          <button class="editor-close-btn">&times;</button>
        </div>
      </div>
      <div class="editor-toolbar">
        <button data-action="heading" title="Encabezado (##)"><b>H</b></button>
        <button data-action="bold" title="Negrita (Ctrl+B)"><b>B</b></button>
        <button data-action="italic" title="Cursiva (Ctrl+I)"><i>I</i></button>
        <button data-action="strikethrough" title="Tachado"><s>S</s></button>
        <span class="toolbar-divider"></span>
        <button data-action="quote" title="Cita (>)">&gt;</button>
        <button data-action="link" title="Insertar Enlace (Ctrl+K)">🔗</button>
        <button data-action="image" title="Insertar Imagen">🖼️</button>
        <span class="toolbar-divider"></span>
        <button data-action="ulist" title="Lista Viñetas (•)">•</button>
        <button data-action="olist" title="Lista Numerada (1.)">1.</button>
        <button data-action="checklist" title="Lista de Tareas (- [ ])">☑</button>
        <span class="toolbar-divider"></span>
        <button data-action="code" title="Bloque de Código">{}</button>
        <button data-action="hr" title="Línea Horizontal">---</button>
      </div>
      <div class="editor-container">
        <textarea class="editor-textarea" placeholder="Escribe aquí... Usa Markdown para dar formato."></textarea>
        <div class="editor-preview">
          <h4>Vista Previa</h4>
          <div class="preview-content"></div>
        </div>
      </div>
    `;

    // --- 2. OBTENER REFERENCIAS Y ASIGNAR VALORES ---
    const textarea = modal.querySelector('.editor-textarea');
    const previewContent = modal.querySelector('.preview-content');
    textarea.value = note.contenido || "";

    // --- 3. LÓGICA DE FUNCIONAMIENTO ---
    const renderPreview = () => {
      const markdownText = textarea.value;
      previewContent.innerHTML = window.marked.parse(markdownText, { breaks: true });
      this.handleChecklistInteraction(textarea, previewContent, renderPreview);
    };
    
    const closeModal = () => {
      document.body.removeChild(overlay);
      document.body.style.overflow = "auto";
    };

    // --- 4. ASIGNAR EVENTOS (VERSIÓN MEJORADA) ---
    modal.querySelector('.editor-save-btn').onclick = async () => {
      note.contenido = textarea.value;
      await this.app.apiUpdate(note);
      closeModal();
    };
    modal.querySelector('.editor-close-btn').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
    
    const previewArea = modal.querySelector('.editor-preview');
    textarea.addEventListener("input", renderPreview);

    // Sincronización de Scroll
    textarea.addEventListener('scroll', () => {
        const percentage = textarea.scrollTop / (textarea.scrollHeight - textarea.clientHeight);
        previewArea.scrollTop = percentage * (previewArea.scrollHeight - previewArea.clientHeight);
    });

    // Lógica de la barra de herramientas
    modal.querySelector('.editor-toolbar').addEventListener('click', (e) => {
        const button = e.target.closest('button');
        if (button && button.dataset.action) {
            this.handleToolbarAction(button.dataset.action, textarea, renderPreview);
        }
    });
    
    // Atajos de Teclado y Funcionalidades de Comodidad
    textarea.addEventListener('keydown', (e) => {
        // Atajos básicos
        if (e.ctrlKey) {
            let handled = true;
            switch (e.key.toLowerCase()) {
                case 'b': this.handleToolbarAction('bold', textarea, renderPreview); break;
                case 'i': this.handleToolbarAction('italic', textarea, renderPreview); break;
                case 'k': this.handleToolbarAction('link', textarea, renderPreview); break;
                default: handled = false;
            }
            if (handled) e.preventDefault();
        }

        // Manejo inteligente de Enter en listas
        if (e.key === 'Enter') {
            const start = textarea.selectionStart;
            const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
            const currentLine = textarea.value.substring(lineStart, start);
            const listMatch = currentLine.match(/^(\s*)(\* |[0-9]+\. |- \[.\] )/);

            if (listMatch && currentLine.trim() === listMatch[2].trim()) {
                // Si la línea está vacía (solo el marcador de lista), borra el marcador y sale de la lista
                e.preventDefault();
                textarea.setRangeText('', lineStart, start, 'end');
            } else if (listMatch) {
                // Si la línea tiene contenido, crea un nuevo elemento de lista
                e.preventDefault();
                let newItem = listMatch[2];
                if (newItem.match(/[0-9]+\. /)) {
                    const num = parseInt(newItem, 10);
                    newItem = `${num + 1}. `;
                }
                const newText = `\n${listMatch[1]}${newItem}`;
                textarea.setRangeText(newText, start, start, 'end');
            }
        }
        
        // Auto-completado de símbolos
        const pairs = { '(': ')', '[': ']', '{': '}' };
        if (pairs[e.key]) {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selected = textarea.value.substring(start, end);
            textarea.setRangeText(`${e.key}${selected}${pairs[e.key]}`, start, end, 'select');
            if (start === end) {
                 textarea.selectionStart = textarea.selectionEnd = start + 1;
            }
        }
    });

    // --- 5. ENSAMBLAJE Y MOSTRAR ---
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
    textarea.focus();
    renderPreview();
  },
  
  handleChecklistInteraction(textarea, previewContent, renderCallback) {
    previewContent.querySelectorAll('input[type="checkbox"]').forEach((checkbox, index) => {
      checkbox.disabled = false;
      checkbox.onclick = () => {
        const lines = textarea.value.split('\n');
        let checklistItemCounter = 0;
        const updatedLines = lines.map(line => {
          if (line.trim().startsWith('- [ ]') || line.trim().startsWith('- [x]')) {
            if (checklistItemCounter === index) {
              return line.includes('[ ]') ? line.replace('[ ]', '[x]') : line.replace('[x]', '[ ]');
            }
            checklistItemCounter++;
          }
          return line;
        });
        textarea.value = updatedLines.join('\n');
        renderCallback();
      };
    });
  },

  handleToolbarAction(action, textarea, renderCallback) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    const applyFormat = (prefix, suffix = prefix) => {
        textarea.focus();
        document.execCommand('insertText', false, `${prefix}${selectedText}${suffix}`);
        if (selectedText) {
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = end + prefix.length;
        } else {
            textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
        }
    };
    
    const applyLineFormat = (prefix) => {
        const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = textarea.value.indexOf('\n', start);
        const finalLineEnd = lineEnd === -1 ? textarea.value.length : lineEnd;
        const line = textarea.value.substring(lineStart, finalLineEnd);
        
        if (line.startsWith(prefix)) {
            // Quitar prefijo si ya existe
            textarea.setSelectionRange(lineStart, finalLineEnd);
            document.execCommand('insertText', false, line.substring(prefix.length));
            textarea.selectionStart = start - prefix.length;
            textarea.selectionEnd = end - prefix.length;
        } else {
            // Añadir prefijo
            textarea.setSelectionRange(lineStart, lineStart);
            document.execCommand('insertText', false, prefix);
            textarea.selectionStart = start + prefix.length;
            textarea.selectionEnd = end + prefix.length;
        }
    };

    switch(action) {
        case 'bold': applyFormat('**'); break;
        case 'italic': applyFormat('*'); break;
        case 'strikethrough': applyFormat('~~'); break;
        case 'heading': applyLineFormat('## '); break;
        case 'quote': applyLineFormat('> '); break;
        case 'ulist': applyLineFormat('* '); break;
        case 'olist': applyLineFormat('1. '); break;
        case 'checklist': applyLineFormat('- [ ] '); break;
        case 'hr':
            const hrText = (textarea.value ? '\n\n' : '') + '---\n';
            document.execCommand('insertText', false, hrText);
            break;
        case 'code':
            applyFormat('\n```\n', '\n```\n');
            break;
        case 'link':
            const url = prompt("Introduce la URL del enlace:");
            if (url) {
                const linkText = selectedText || 'texto del enlace';
                textarea.focus();
                document.execCommand('insertText', false, `[${linkText}](${url})`);
            }
            break;
        case 'image':
            const imageUrl = prompt("Introduce la URL de la imagen:");
            if (imageUrl) {
                const altText = selectedText || 'descripción';
                textarea.focus();
                document.execCommand('insertText', false, `![${altText}](${imageUrl})`);
            }
            break;
    }
    textarea.focus();
    renderCallback();
  }
};