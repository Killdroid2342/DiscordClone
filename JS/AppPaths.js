(function () {
  const isFileProtocol = window.location.protocol === 'file:';
  const configuredApiBase = String(window.MYDISCORD_CONFIG?.apiBase || '').replace(/\/+$/, '');
  const configuredCdnBase = String(window.MYDISCORD_CONFIG?.cdnBase || '').replace(/\/+$/, '');

  function normalizePath(path) {
    return String(path || '').replace(/^\/+/, '');
  }

  window.APP_PATHS = {
    apiBase: configuredApiBase || 'http://localhost:5018',
    cdnBase: configuredCdnBase,
    isFileProtocol,
    assetUrl(path) {
      const normalizedPath = normalizePath(path);
      return isFileProtocol ? `../${normalizedPath}` : `/${normalizedPath}`;
    },
    dependencyUrl(path) {
      const normalizedPath = normalizePath(path);
      return isFileProtocol ? `../${normalizedPath}` : `/${normalizedPath}`;
    },
    pageUrl(pageName) {
      return isFileProtocol ? `./${pageName}` : `/Pages/${pageName}`;
    },
  };
})();
