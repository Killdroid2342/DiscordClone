(function () {
  const runtimeConfig = window.myDiscordRuntimeConfig || {};
  window.MYDISCORD_CONFIG = {
    apiBase: runtimeConfig.apiBase || 'http://localhost:5018',
    cdnBase: runtimeConfig.cdnBase || '',
  };
})();
