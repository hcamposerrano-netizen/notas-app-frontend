// ==============================================================
// 🎨 INTERACCIONES DE LA INTERFAZ DE USUARIO
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
})();


// --- LÓGICA PARA EL PANEL ATENUADO (DIMMER) Y CIERRE DE MENÚS ---
(function() {
    const body = document.body;
    const panel = document.getElementById('control-panel');
    const toggleBtn = document.querySelector('.panel-toggle');

    let dimmer = document.getElementById('panel-dimmer');
    if (!dimmer) {
        dimmer = document.createElement('div');
        dimmer.id = 'panel-dimmer';
        body.appendChild(dimmer);
    }

    const toggleDimmer = () => {
        dimmer.classList.toggle('show', panel.classList.contains('show'));
    };
    
    if (toggleBtn && panel) {
        // Corregimos el listener para que se active después de que la clase 'show' cambie
        toggleBtn.addEventListener('click', () => setTimeout(toggleDimmer, 0));
        dimmer.addEventListener('click', () => {
            panel.classList.remove('show');
            toggleDimmer();
        });
    }

    // Cierra menús de notas al hacer click en cualquier otro lugar
    window.addEventListener('click', () => {
        document.querySelectorAll('.note-menu.show').forEach(menu => {
            menu.classList.remove('show');
        });
    });
})();