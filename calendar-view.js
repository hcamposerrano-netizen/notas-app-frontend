(function () {
  const panel = document.getElementById("control-panel");
  const container = document.getElementById("columns-container");

  if (!panel || !container || document.getElementById("toggle-calendar-btn")) return;

  const toggleBtn = document.createElement("button");
  toggleBtn.id = "toggle-calendar-btn";
  toggleBtn.textContent = "🗓️ Vista Calendario";
  
const actionsContainer = document.querySelector('#actions-section .action-buttons');
if (actionsContainer) {
    // Lo insertamos como el segundo elemento, después de "Nueva Nota"
    actionsContainer.insertBefore(toggleBtn, actionsContainer.children[1]);
} else {
    // Si no encuentra el contenedor, lo pone al final como antes (medida de seguridad)
    panel.appendChild(toggleBtn);
}

  let calendarMode = false;

  function parseDate(fechaStr) {
    if (!fechaStr) return null;
    const parts = fechaStr.split("-");
    if (parts.length !== 3) return null;
    const [a, m, d] = parts;
    return new Date(`${a}-${m}-${d}T00:00:00`);
  }

  function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day + 6) % 7;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split("T")[0];
  }

  function agruparPorSemanas(notas) {
    const semanas = {};
    for (const nota of notas) {
      if (!nota.fecha) continue; // Si no tiene fecha, la saltamos
      const fecha = parseDate(nota.fecha);
      if (!fecha || isNaN(fecha.getTime())) continue;
      const inicioSemana = getWeekStart(fecha);
      if (!semanas[inicioSemana]) semanas[inicioSemana] = {};
      if (!semanas[inicioSemana][nota.fecha]) semanas[inicioSemana][nota.fecha] = [];
      semanas[inicioSemana][nota.fecha].push(nota);
    }
    return semanas;
  }

  function mostrarNotaEmergente(nota) {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(3px);";
    const modal = document.createElement("div");
    modal.style.cssText = "background: var(--color-surface); color: var(--color-text-primary); border: 2px solid #8b7355; padding: 2rem; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.3); max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto; position: relative;";
    const closeX = document.createElement("button");
    closeX.textContent = "×";
    closeX.style.cssText = "position: absolute; top: 10px; right: 15px; background: none; border: none; font-size: 2rem; cursor: pointer; color: #8b7355; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: background 0.2s ease;";
    closeX.onmouseover = () => { closeX.style.background = "rgba(0,0,0,0.1)"; };
    closeX.onmouseout = () => { closeX.style.background = "none"; };
    const title = document.createElement("h2");
    title.textContent = `📝 ${nota.nombre || "(Sin título)"}`;
    title.style.cssText = "margin-top: 0; margin-bottom: 1rem; color: var(--color-primary-accent); font-size: 1.4rem; padding-right: 40px;";
    const tipoLabel = document.createElement("span");
    tipoLabel.textContent = nota.tipo || "Clase";
    tipoLabel.style.cssText = `display: inline-block; background: ${nota.tipo === "Entrega" ? "#d32f2f" : "#1976d2"}; color: white; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.8rem; font-weight: bold; margin-bottom: 1rem;`;
    const contenido = document.createElement("div");
    contenido.innerHTML = `<strong>📄 Contenido:</strong><br><div style="background: var(--color-background); padding: 1rem; border-radius: 6px; margin-top: 0.5rem; white-space: pre-wrap; font-family: 'Courier New', monospace; max-height: 200px; overflow-y: auto;">${nota.contenido || "(Sin contenido)"}</div>`;
    contenido.style.marginBottom = "1rem";
    const fecha = document.createElement("p");
    const fechaFormateada = nota.fecha ? new Date(nota.fecha_hora).toLocaleDateString("es-CR", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Sin fecha";
    const horaFormateada = nota.hora ? ` a las ${nota.hora}` : '';
    fecha.innerHTML = `<strong>📅 Fecha:</strong> ${fechaFormateada}${horaFormateada}`;
    fecha.style.marginBottom = "1.5rem";
    
    const cerrarModal = () => { document.body.removeChild(overlay); document.body.style.overflow = ""; };
    closeX.onclick = cerrarModal;
    overlay.onclick = (e) => { if (e.target === overlay) cerrarModal(); };
    document.onkeydown = (e) => { if (e.key === "Escape") { cerrarModal(); document.onkeydown = null; } };
    
    modal.append(closeX, title, tipoLabel, contenido, fecha);
    overlay.appendChild(modal);
    document.body.style.overflow = "hidden";
    document.body.appendChild(overlay);
  }

  // ---- NUEVA FUNCIÓN PRINCIPAL DE RENDERIZADO ----
  function renderCalendarView() {
    if (!window.NotesApp || !window.NotesApp.notes || window.NotesApp.notes.size === 0) {
      container.innerHTML = `<div style="padding:2rem; text-align:center; color: var(--color-text-secondary);"><h2>📭 No hay notas disponibles</h2><p>Agrega algunas notas para ver el calendario</p></div>`;
      return;
    }

    // BUG FIX: Filtramos por 'fecha', que siempre existe si hay fecha_hora.
    const notas = Array.from(window.NotesApp.notes.values()).filter(n => n.fecha);
    if (notas.length === 0) {
      container.innerHTML = `<div style="padding:2rem; text-align:center; color: var(--color-text-secondary);"><h2>📅 Sin notas con fecha</h2><p>Las notas necesitan fechas para mostrarse en el calendario</p></div>`;
      return;
    }

    const semanas = agruparPorSemanas(notas);
    container.innerHTML = "";
    container.classList.add("calendar-mode");

    const semanasOrdenadas = Object.entries(semanas).sort(([a], [b]) => new Date(a) - new Date(b));

    for (const [semana, dias] of semanasOrdenadas) {
      const section = document.createElement("section");
      const fechaSemana = new Date(semana + "T00:00:00"); const fechaFin = new Date(fechaSemana); fechaFin.setDate(fechaFin.getDate() + 6);
      const semanaBonita = `${fechaSemana.toLocaleDateString("es-CR", { day: "2-digit", month: "long" })} - ${fechaFin.toLocaleDateString("es-CR", { day: "2-digit", month: "long", year: "numeric" })}`;
      const header = document.createElement("h3"); header.innerHTML = `📅 Semana: ${semanaBonita}`;
      section.appendChild(header);

      const diasOrdenados = Object.entries(dias).sort(([a], [b]) => new Date(a) - new Date(b));
      
      for (const [fecha, notasDia] of diasOrdenados) {
        const date = parseDate(fecha); const diaNombre = date.toLocaleDateString("es-CR", { weekday: "long", day: "2-digit", month: "2-digit" });
        
        // Contenedor principal para el día con el nuevo layout
        const dayLayoutContainer = document.createElement("div");
        dayLayoutContainer.className = "day-layout";

        const mainNotesArea = document.createElement("div");
        mainNotesArea.className = "main-notes-area";
        
        const dayTitle = document.createElement("strong");
        dayTitle.textContent = diaNombre;
        dayTitle.style.cssText = `color: var(--color-primary-accent); font-size: 1.1rem; display: block; margin-bottom: 0.8rem; text-transform: capitalize;`;
        mainNotesArea.appendChild(dayTitle);

        const filaNotas = document.createElement("div");
        filaNotas.className = "calendar-row";
        
        // Mostramos TODAS las notas del día, ordenadas por tipo
        const notasDelDiaOrdenadas = [...notasDia].sort((a,b) => (a.tipo === "Entrega" && b.tipo !== "Entrega") ? -1 : 1);

        for (const nota of notasDelDiaOrdenadas) {
          const notaDiv = document.createElement("div");
          notaDiv.innerHTML = `<div style="font-weight: bold; font-size: 1.1rem; margin-bottom: 0.3rem;">${nota.nombre?.trim() || "(Sin título)"}</div><div style="font-size: 0.9rem; color: #666; line-height: 1.4;">${(nota.contenido?.trim() || "").substring(0,80)}...</div>`;
          notaDiv.style.cssText = `background: ${nota.color || "#ffff88"}; color: #000; padding: 1rem; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; position: relative; overflow: hidden;`;
          if (nota.tipo === "Entrega") { notaDiv.style.borderLeft = "5px solid #d32f2f"; } else { notaDiv.style.borderLeft = "5px solid #1976d2"; }
          const tipoBadge = document.createElement("div");
          tipoBadge.textContent = nota.tipo || "Clase";
          tipoBadge.style.cssText = `position: absolute; top: 8px; right: 8px; background: ${nota.tipo === "Entrega" ? "#d32f2f" : "#1976d2"}; color: white; padding: 0.2rem 0.5rem; border-radius: 12px; font-size: 0.7rem; font-weight: bold;`;
          notaDiv.appendChild(tipoBadge);
          notaDiv.onclick = () => mostrarNotaEmergente(nota);
          filaNotas.appendChild(notaDiv);
        }
        mainNotesArea.appendChild(filaNotas);
        dayLayoutContainer.appendChild(mainNotesArea);

        // ---- NUEVA AGENDA DEL DÍA ----
        const timedNotes = notasDia.filter(n => n.hora).sort((a,b) => a.hora.localeCompare(b.hora));
        if (timedNotes.length > 0) {
          const timelineSidebar = document.createElement("aside");
          timelineSidebar.className = "timeline-sidebar";
          timelineSidebar.innerHTML = `<h4>Agenda del Día</h4>`;
          const timelineList = document.createElement("ul");
          
          for (const nota of timedNotes) {
            const item = document.createElement("li");
            item.className = "timeline-item";
            item.innerHTML = `<strong>${nota.hora}</strong> - ${nota.nombre || "(Sin título)"}`;
            item.onclick = () => mostrarNotaEmergente(nota);
            timelineList.appendChild(item);
          }
          timelineSidebar.appendChild(timelineList);
          dayLayoutContainer.appendChild(timelineSidebar);
        }
        
        section.appendChild(dayLayoutContainer);
      }
      container.appendChild(section);
    }
  }

  function renderNormalView() {
    container.classList.remove("calendar-mode");
    if (window.NotesApp && window.NotesApp.renderNotes) { 
        window.NotesApp.renderNotes(); 
    } else { 
        location.reload(); 
    }
  }

  toggleBtn.addEventListener("click", () => {
    calendarMode = !calendarMode;
    if (calendarMode) {
      toggleBtn.textContent = "📋 Vista Normal";
      renderCalendarView();
    } else {
      toggleBtn.textContent = "🗓️ Vista Calendario";
      renderNormalView();
    }
  });

  // Sobrescribimos el método renderNotes de la app para que se actualice la vista de calendario
  const originalRenderNotes = window.NotesApp?.renderNotes;
  if (originalRenderNotes) {
    window.NotesApp.renderNotes = function() {
      originalRenderNotes.apply(this, arguments);
      if (calendarMode) {
        renderCalendarView();
      }
    };
  }
})();