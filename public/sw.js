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
    icon: '/kscw_blau.png',
    badge: '/kscw_blau.png',
    tag: data.tag || 'kscw-notification',
    renotify: true,
    data: {
      url: data.url || 'https://kscw.lucanepa.com',
    },
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'KSC Wiedikon', options)
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()

  var url = (event.notification.data && event.notification.data.url) || 'https://kscw.lucanepa.com'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      // Focus existing tab if open
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i]
        if (client.url.indexOf('kscw.lucanepa.com') !== -1 && 'focus' in client) {
          client.focus()
          if (url !== 'https://kscw.lucanepa.com') {
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
