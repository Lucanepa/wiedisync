if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .catch(function(err) { console.warn('[SW] Registration failed:', err); });
}
