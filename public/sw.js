self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("push", event => {
  const data = event.data ? event.data.json() : { title: "DMS Connect", body: "You have a new notification" };
  event.waitUntil(self.registration.showNotification(data.title || "DMS Connect", {
    body: data.body || "", icon: "/icon-192.png", data: { url: data.url || "/" }
  }));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/"));
});
