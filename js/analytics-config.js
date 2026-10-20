/* Настройки аналитики для самостоятельной установки.
   По умолчанию отправка данных выключена. Не помещайте сюда секреты. */
var localAnalyticsTest = window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';

window.BOYGAME_ANALYTICS_CONFIG = {
  enabled: localAnalyticsTest,
  endpoint: localAnalyticsTest ? 'http://localhost:8766/api/v1' : '',
  privacyUrl: localAnalyticsTest ? '/ANALYTICS.md' : ''
};
