// ==============================================================
// 🎨 INTERACCIONES DE LA INTERFAZ DE USUARIO (CON TEMAS MÚLTIPLES)
// ==============================================================

(function() {
  const body = document.body;
  const panel = document.getElementById('control-panel');
  const toggleBtn = document.querySelector('.panel-toggle');
  
  // --- LÓGICA DE TEMAS MÚLTIPLES ---
  const themeToggleBtn = document.getElementById('theme-toggle');
  if (themeToggleBtn) {
    // ✅ ARRAY ACTUALIZADO CON TODOS LOS TEMAS
    const themes = [
         'theme-light', 
        'theme-dark', 
        'theme-terracotta',
        'theme-forest-floor',
        'theme-neon-night',
        'theme-mint-breeze',
        'theme-cosmic-dusk',
        'theme-desert-canyon'
    ];
    
    const applyTheme = (theme) => {
      // 1. Limpiar temas antiguos
      body.classList.remove(...themes);
      // 2. Añadir el nuevo tema
      body.classList.add(theme);
      // 3. Guardar la elección
      localStorage.setItem('theme', theme);
      // 4. Actualizar el ícono
      themeToggleBtn.textContent = '🎨'; 
    };

    const cycleTheme = () => {
      let currentTheme = localStorage.getItem('theme') || 'theme-light';
      let currentIndex = themes.indexOf(currentTheme);
      let nextIndex = (currentIndex + 1) % themes.length;
      let nextTheme = themes[nextIndex];
      applyTheme(nextTheme);
    };

    // Asignar el evento al botón
    themeToggleBtn.addEventListener('click', cycleTheme);

    // Cargar el tema guardado al iniciar la app
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme && themes.includes(savedTheme)) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('theme-dark');
    } else {
        applyTheme('theme-light');
    }
  }

  // --- LÓGICA DEL MENÚ DESLIZABLE ---
  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      panel.classList.toggle('show');
    });
  }

  // --- LÓGICA PARA EL PANEL ATENUADO (DIMMER) ---
  let dimmer = document.getElementById('panel-dimmer');
  if (!dimmer) {
      dimmer = document.createElement('div');
      dimmer.id = 'panel-dimmer';
      body.appendChild(dimmer);
  }

  const toggleDimmer = () => {
      if (panel) {
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
          const parentNote = menu.closest('.note');
          if (parentNote) {
            parentNote.classList.remove('note-menu-open');
          }
      });
  });

  // --- LÓGICA DE LA BARRA DE RECORDATORIOS DESPLEGABLE ---
  const reminderBar = document.getElementById('reminder-bar');
  const reminderHeader = document.getElementById('reminder-header');

  if (reminderBar && reminderHeader) {
      reminderBar.classList.add('collapsed');
      reminderHeader.addEventListener('click', () => {
          reminderBar.classList.toggle('collapsed');
      });
  }

})();