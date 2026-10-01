// Aplica o tema antes do primeiro desenho para evitar o piscar entre claro e escuro.
// Ficheiro externo (e não inline) para a política CSP poder proibir scripts inline.
(function () {
  var theme;
  try {
    theme = localStorage.getItem('tento:tema');
  } catch (e) {}
  if (theme !== 'light' && theme !== 'dark') {
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  document.documentElement.dataset.theme = theme;
})();
