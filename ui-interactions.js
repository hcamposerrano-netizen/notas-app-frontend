// ==============================================================
// 🎨 INTERACCIONES DE LA INTERFAZ DE USUARIO (CON TEMAS MÚLTIPLES Y ENLACES CORREGIDOS)
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
      dimmer.addEventListener('click', togglePanel);
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

  // --- ✨ CORRECCIÓN: LÓGICA PARA ENLACES RÁPIDOS ---
  const linkInput = document.getElementById('link-input');
  const addLinkBtn = document.getElementById('add-link');
  const linkList = document.getElementById('link-list');
  let quickLinks = JSON.parse(localStorage.getItem('quickLinks')) || [];

  const renderLinks = () => {
    linkList.innerHTML = '';
    quickLinks.forEach((link, index) => {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = link;
      a.textContent = link;
      a.target = '_blank';
      
      const deleteBtn = document.createElement('button');
      deleteBtn.textContent = '✖';
      deleteBtn.style.cssText = `
        margin-left: 8px;
        background: transparent;
        border: none;
        color: var(--color-text-secondary);
        cursor: pointer;
        font-size: 0.8em;
      `;
      deleteBtn.onclick = (e) => {
        e.stopPropagation();
        removeLink(index);
      };
      
      li.appendChild(a);
      li.appendChild(deleteBtn);
      linkList.appendChild(li);
    });
  };

  const saveLinks = () => {
    localStorage.setItem('quickLinks', JSON.stringify(quickLinks));
    renderLinks();
  };
  
  const removeLink = (index) => {
      quickLinks.splice(index, 1);
      saveLinks();
  };

  const addLink = () => {
    let url = linkInput.value.trim();
    if (!url) return;
    
    // Añade http:// si no está presente para que el enlace sea válido
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    
    try {
      new URL(url); // Valida si la URL es correcta
      quickLinks.push(url);
      linkInput.value = '';
      saveLinks();
    } catch (e) {
      alert("Por favor, introduce una URL válida.");
    }
  };

  if(addLinkBtn && linkInput) {
      addLinkBtn.addEventListener('click', addLink);
      linkInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
              e.preventDefault();
              addLink();
          }
      });
  }

  // Renderizar enlaces al cargar la página
  renderLinks();

})();