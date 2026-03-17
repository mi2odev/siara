self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch (_error) {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || "SIARA alert";
  const options = {
    body: payload.body || "A new watched-zone alert is available.",
    icon: payload.icon || "/siara-push-icon.svg",
    badge: payload.badge || "/siara-push-badge.svg",
    tag: payload.notificationId || payload.tag || `siara-${Date.now()}`,
    renotify: false,
    requireInteraction: Number(payload.priority || 2) <= 1,
    data: {
      notificationId: payload.notificationId || null,
      url: payload.url || "/notifications",
      eventType: payload.eventType || null,
      reportId: payload.data?.reportId || null,
      zoneName: payload.zoneName || payload.data?.zoneName || null,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const destination = new URL(
    event.notification.data?.url || "/notifications",
    self.location.origin,
  ).href;

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });

    const exactClient = clientList.find((client) => client.url === destination);
    if (exactClient) {
      await exactClient.focus();
      return exactClient;
    }

    const sameOriginClient = clientList.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch (_error) {
        return false;
      }
    });

    if (sameOriginClient) {
      await sameOriginClient.focus();
      if ("navigate" in sameOriginClient) {
        return sameOriginClient.navigate(destination);
      }
      return sameOriginClient;
    }

    if (self.clients.openWindow) {
      return self.clients.openWindow(destination);
    }

    return null;
  })());
});
