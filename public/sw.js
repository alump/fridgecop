self.addEventListener('push', event => {
    try {
        const data = event.data.json();

        console.log("Incoming fridgecop notification!");

        const title = data.title;
        const body = data.body;
        const requireInteraction = data.requireInteraction;
        const tag = data.tag;
        const icon = data.icon;

        event.waitUntil(self.registration.showNotification(title, {
            body: body,
            requireInteraction: requireInteraction,
            tag: tag,
            icon: icon
        }));
    } catch(SyntaxError) {
        console.error("Invalid push message received");
        debugger;
    }
});

self.addEventListener('notificationclick', function(event) {
    console.log("Notification clicked");
});