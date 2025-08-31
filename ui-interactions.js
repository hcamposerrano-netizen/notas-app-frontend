// ==============================================================
// 🎨 INTERACCIONES DE LA INTERFAZ DE USUARIO (VERSIÓN UNIFICADA)
// ==============================================================

(function() {
  // --- LÓGICA DEL MENÚ DESLIZABLE ---
  const toggleBtn = document.querySelector('.panel-toggle');
  const panel = document.getElementById('control-panel');
  const mainContent = document.getElementById('main-container');

  if (toggleBtn && panel && mainContent) {
    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.classList.toggle('show');
    });
    mainContent.addEventListener('click', () => {
      panel.classList.remove('show');
    });
  }

  // --- LÓGICA DEL MODO OSCURO ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  const body = document.body;

  if (themeToggleBtn) {
    const updateIcon = () => {
      themeToggleBtn.textContent = body.classList.contains('dark-mode') ? '☀️' : '🌙';
    };

    themeToggleBtn.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
      updateIcon();
    });

    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-mode');
    }
    updateIcon();
  }

  // --- LÓGICA PARA EL PANEL ATENUADO (DIMMER) ---
  let dimmer = document.getElementById('panel-dimmer');
  if (!dimmer) {
      dimmer = document.createElement('div');
      dimmer.id = 'panel-dimmer';
      body.appendChild(dimmer);
  }

  const toggleDimmer = () => {
      if(panel) { // Solo ejecuta si el panel existe
        dimmer.classList.toggle('show', panel.classList.contains('show'));
      }
  };
  
  if (toggleBtn && panel) {
      toggleBtn.addEventListener('click', () => setTimeout(toggleDimmer, 0));
      dimmer.addEventListener('click', () => {
          panel.classList.remove('show');
          toggleDimmer();
      });
  }

  // --- CIERRE GLOBAL DE MENÚS DE NOTAS ---
  window.addEventListener('click', () => {
      document.querySelectorAll('.note-menu.show').forEach(menu => {
          menu.classList.remove('show');
          // También quitamos la clase activa de la nota padre
          const parentNote = menu.closest('.note');
          if (parentNote) {
            parentNote.classList.remove('note-menu-open');
          }
      });
  });

})(); // Fin del bloque de función autoejecutable