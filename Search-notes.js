(function () {
  const panel = document.getElementById("control-panel");
  if (!panel) return;

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "🔍 Buscar por título o contenido...";
  searchInput.id = "search-input"; // Asignar un ID para CSS si se necesita
  
  // Insertar el campo de búsqueda antes de la nota rápida para mejor orden
  const quickNoteSection = document.querySelector(".panel-section h3:first-of-type").parentElement;
  if(quickNoteSection) {
    const searchSection = document.createElement("div");
    searchSection.className = "panel-section";
    searchSection.innerHTML = `<h3>Búsqueda</h3>`;
    searchSection.appendChild(searchInput);
    panel.insertBefore(searchSection, quickNoteSection);
  } else {
    panel.appendChild(searchInput); // Fallback si no encuentra la sección
  }


  searchInput.addEventListener("input", () => {
    const query = searchInput.value.toLowerCase().trim();
    filtrarNotas(query);
  });

  function filtrarNotas(query) {
    const notesOnScreen = document.querySelectorAll(".note");

    notesOnScreen.forEach(noteElement => {
      const noteId = noteElement.dataset.noteId;
      if (!noteId || !window.NotesApp || !window.NotesApp.notes) return;

      const noteData = window.NotesApp.notes.get(noteId);
      if (!noteData) return;

      // La nota se muestra si la búsqueda está vacía o si hay una coincidencia
      const isMatch = query === "" ||
        (noteData.nombre || "").toLowerCase().includes(query) ||
        (noteData.contenido || "").toLowerCase().includes(query);

      // Usamos 'flex' porque es el display por defecto de las notas en tu CSS
      noteElement.style.display = isMatch ? "flex" : "none";
    });
  }
})();