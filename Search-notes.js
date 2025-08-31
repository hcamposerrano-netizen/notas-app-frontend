// ✅ CÓDIGO ENVUELTO PARA EJECUTARSE CUANDO LA APP ESTÉ LISTA
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById("control-panel");
  if (!panel) return;

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "🔍 Buscar por título o contenido...";
  searchInput.id = "search-input";
  
  const quickNoteSection = document.querySelector(".panel-section h3:first-of-type").parentElement;
  if(quickNoteSection) {
    const searchSection = document.createElement("div");
    searchSection.className = "panel-section";
    searchSection.innerHTML = `<h3>Búsqueda</h3>`;
    searchSection.appendChild(searchInput);
    panel.insertBefore(searchSection, quickNoteSection);
  } else {
    panel.appendChild(searchInput);
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

      const isMatch = query === "" ||
        (noteData.nombre || "").toLowerCase().includes(query) ||
        (noteData.contenido || "").toLowerCase().includes(query);

      noteElement.style.display = isMatch ? "flex" : "none";
    });
  }
});