// KSC Wiedikon — Service Worker for Web Push Notifications
// This SW only handles push events. No caching/offline support.

self.addEventListener('push', function(event) {
  if (!event.data) return

  var data
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: 'KSC Wiedikon', body: event.data.text() }
  }

  var options = {
    body: data.body || '',
    icon: '/wiedisync_blau.png',
    badge: '/wiedisync_blau.png',
    tag: data.tag || 'wiedisync-notification',
    renotify: true,
    data: {
      url: data.url || 'https://wiedisync.kscw.ch',
    },
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'KSC Wiedikon', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  var url = (event.notification.data && event.notification.data.url) || 'https://wiedisync.kscw.ch'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing tab if open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url.indexOf('wiedisync.kscw.ch') !== -1 && 'focus' in client) {
          client.focus()
          if (url !== 'https://wiedisync.kscw.ch') {
            client.navigate(url)
          }
          return
        }
      }
      // Otherwise open new tab
      return clients.openWindow(url)
    })
  )
})
