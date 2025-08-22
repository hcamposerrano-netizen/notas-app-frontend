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
    // Función para actualizar el ícono del botón
    const updateIcon = () => {
      if (body.classList.contains('dark-mode')) {
        themeToggleBtn.textContent = '☀️'; // Sol si está en modo oscuro
      } else {
        themeToggleBtn.textContent = '🌙'; // Luna si está en modo claro
      }
    };

    // Evento de clic para cambiar el tema
    themeToggleBtn.addEventListener('click', () => {
      body.classList.toggle('dark-mode');
      // Guardar la preferencia del usuario en localStorage
      localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
      updateIcon();
    });

    // Cargar el tema y actualizar el ícono al iniciar
    const savedTheme = localStorage.getItem('theme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
        body.classList.add('dark-mode');
    }
    updateIcon();
  }
})();