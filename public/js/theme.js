// CineSync Theme Switcher: Claymorphism vs. Editorial Noir
(function() {
  const THEME_KEY = 'cinesync_theme';
  
  // Default to 'noir' for immersive cinematic social lounge
  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return saved;
    return 'noir'; // Default to Cinematic Noir Lounge
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);

    // Update all theme toggle buttons on the page
    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      const textSpan = btn.querySelector('.theme-text') || btn;
      const iconSpan = btn.querySelector('.theme-icon');
      if (theme === 'clay') {
        if (textSpan && textSpan !== btn) textSpan.textContent = 'NOIR';
        else btn.innerHTML = 'NOIR';
        btn.setAttribute('title', 'Switch to Editorial Noir theme');
      } else {
        if (textSpan && textSpan !== btn) textSpan.textContent = 'CLAY';
        else btn.innerHTML = 'CLAY';
        btn.setAttribute('title', 'Switch to 3D Claymorphism theme');
      }
    });
  }

  window.toggleTheme = function() {
    const current = document.documentElement.getAttribute('data-theme') || 'noir';
    const next = current === 'clay' ? 'noir' : 'clay';
    applyTheme(next);
  };

  // Immediate execution before DOM ready to prevent flash of unstyled content
  const initialTheme = getPreferredTheme();
  document.documentElement.setAttribute('data-theme', initialTheme);

  // Bind to buttons when DOM is loaded
  document.addEventListener('DOMContentLoaded', () => {
    applyTheme(initialTheme);

    document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        window.toggleTheme();
      });
    });
  });
})();
