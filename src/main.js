import './styles/main.css';
import { mountViews } from './app/mount-views.js';
import { bootCalculatorScripts } from './app/load-scripts.js';
import { installScrollToTopOnNavigation } from './app/navigation-scroll.js';

mountViews(document.getElementById('app-root'));

bootCalculatorScripts()
  .then(() => {
    installScrollToTopOnNavigation();
  })
  .catch((err) => {
    console.error(err);
    const toast = document.getElementById('toast');
    if (toast) {
      toast.textContent = 'Gagal memuat modul kalkulator. Lihat console.';
      toast.className = 'toast show error';
    }
  });
