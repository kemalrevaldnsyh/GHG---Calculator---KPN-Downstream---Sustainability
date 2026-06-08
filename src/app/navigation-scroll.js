/** Scroll to top when switching menus/tabs (does not touch formula modules). */
export function installScrollToTopOnNavigation() {
  function scrollToTop() {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  const names = [
    'openCalculatorMode',
    'goToOverview',
    'openGHGSavingsMode',
    'openRawDataMode',
    'openETDMode',
    'openETDGGLMode',
    'switchTab',
    'etdResetForm',
  ];

  names.forEach((name) => {
    const original = window[name];
    if (typeof original !== 'function') return;
    window[name] = function (...args) {
      const result = original.apply(this, args);
      scrollToTop();
      return result;
    };
  });
}
