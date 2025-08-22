(function(){
  const TIPOS_VALIDOS = ["Ambas", "Clase", "Entrega"];

  function crearFiltro() {
    const panel = document.getElementById("control-panel");
    if(!panel || document.getElementById('filter-type-select')) return; // Evita duplicados

    const section = document.createElement("section");
    section.style.marginTop = "1rem";

    const label = document.createElement("label");
    label.textContent = "Filtrar por tipo: ";
    label.htmlFor = "filter-type-select";

    const select = document.createElement("select");
    select.id = "filter-type-select";

    TIPOS_VALIDOS.forEach(tipo => {
      const opt = document.createElement("option");
      opt.value = tipo;
      opt.textContent = tipo;
      select.appendChild(opt);
    });

    section.appendChild(label);
    section.appendChild(select);
    panel.appendChild(section);

    select.addEventListener("change", () => {
      filtrarNotas(select.value);
    });
  }

  function filtrarNotas(filtro) {
    // En lugar de modificar las notas, vamos a ocultar/mostrar las columnas enteras
    // Esto es más eficiente y funciona mejor con el renderizado de la app.
    const notas = document.querySelectorAll(".note");
    
    notas.forEach(notaEl => {
      const noteId = notaEl.dataset.noteId;
      if (!noteId || !window.notes) return;

      const nota = window.notes.get(noteId);
      if (!nota) return;

      // La lógica de filtrado: si el filtro es "Ambas" o coincide con el tipo de la nota, se muestra.
      if (filtro === "Ambas" || nota.tipo === filtro) {
        notaEl.style.display = "flex"; // Usamos 'flex' porque es el display por defecto de .note
      } else {
        notaEl.style.display = "none";
      }
    });
  }

  // Esperamos a que la app principal cargue todo
  window.addEventListener("load", () => {
    crearFiltro();
  });

})();