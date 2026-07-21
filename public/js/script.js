(function () {
  var STORAGE_KEY = 'chaiponjp-lang';
  var buttons = document.querySelectorAll('.lang-btn');

  function setLang(lang) {
    document.body.classList.remove('is-ru', 'is-uz');
    document.body.classList.add('is-' + lang);
    document.documentElement.setAttribute('lang', lang);
    buttons.forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.dataset.lang === lang ? 'true' : 'false');
    });
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) {}
  }

  buttons.forEach(function (btn) {
    btn.addEventListener('click', function () {
      setLang(btn.dataset.lang);
    });
  });

  var saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  setLang(saved === 'uz' ? 'uz' : 'ru');
})();
