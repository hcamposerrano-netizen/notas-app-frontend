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
      body.classList.remove(...themes);
      body.classList.add(theme);
      localStorage.setItem('theme', theme);
      themeToggleBtn.textContent = '🎨'; 
    };

    const cycleTheme = () => {
      let currentTheme = localStorage.getItem('theme') || 'theme-light';
      let currentIndex = themes.indexOf(currentTheme);
      let nextIndex = (currentIndex + 1) % themes.length;
      let nextTheme = themes[nextIndex];
      applyTheme(nextTheme);
    };

    themeToggleBtn.addEventListener('click', cycleTheme);
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

  // --- ✅ LÓGICA DEL PANEL LATERAL MEJORADA ---
  // Ahora se controla el estado añadiendo/quitando una clase al body
  function togglePanel() {
      body.classList.toggle('panel-open');
  }

  if (toggleBtn && panel) {
    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      togglePanel();
    });
  }

  // --- LÓGICA DEL ATENUADOR (DIMMER) ---
  let dimmer = document.getElementById('panel-dimmer');
  if (!dimmer) {
      dimmer = document.createElement('div');
      dimmer.id = 'panel-dimmer';
      body.appendChild(dimmer);
  }

  if (toggleBtn && panel) {
      dimmer.addEventListener('click', togglePanel); // El dimmer ahora también cierra el panel
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