(function(){
  const TIPOS_VALIDOS = ["Clase", "Entrega"];
  const originalCreateNote = window.createNote;

  window.createNote = function(data = null){
    if(!data){
      data = { tipo: "Clase" }; // Asignar por defecto sin prompt
    }
    if(!data.tipo || !TIPOS_VALIDOS.includes(data.tipo)) {
      data.tipo = "Clase";
    }

    originalCreateNote(data);

    setTimeout(() => {
      const allNotes = document.querySelectorAll('.note textarea');
      allNotes.forEach(textarea => {
        if(!textarea.dataset.id){
          const id = textarea.closest('.note').querySelector('textarea')?.value ? 
            [...window.notes.values()].find(n => n.contenido === textarea.value)?.id : null;
          if(id) textarea.dataset.id = id;
        }
      });
    }, 10);
  }

  const originalRenderNotes = window.renderNotes;

  window.renderNotes = function(){
    originalRenderNotes();

    document.querySelectorAll('.note').forEach(noteEl => {
      const id = noteEl.querySelector('textarea')?.dataset.id || null;
      if(!id) return;

      const nota = window.notes.get(id);
      if(!nota) return;

      let etiqueta = noteEl.querySelector('.note-type-label');
      if(!etiqueta){
        etiqueta = document.createElement('div');
        etiqueta.className = 'note-type-label';
        etiqueta.style.fontSize = '0.7em';
        etiqueta.style.fontWeight = 'bold';
        etiqueta.style.marginBottom = '0.2em';
        noteEl.prepend(etiqueta);
      }
      etiqueta.textContent = nota.tipo || "Clase";
    });
  }

  const originalImportData = window.importData;
  const originalExportData = window.exportData;

  window.importData = function(e){
    originalImportData(e);
  }

  window.exportData = function(){
    const data = {
      notes: [...window.notes.values()],
      quickNote: document.getElementById("quick-note").value,
      links: window.links
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notas.json";
    a.click();
    URL.revokeObjectURL(url);
  }

})();
