function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const triggerPush = document.querySelector('#trigger-push');
let serviceWorkerRegister = undefined;

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        serviceWorkerRegister = await navigator.serviceWorker.register('sw.js', {
            scope: '/'
        });
    } else {
        console.error('Service workers are not supported in this browser');
    }
}

registerServiceWorker();

async function triggerPushNotification() {
    if (typeof serviceWorkerRegister !== "undefined") {
        const subscription = await serviceWorkerRegister.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });

        await fetch('/subscribe', {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } else {
        console.error('Service workers are not supported in this browser');
    }
}

triggerPush.addEventListener('click', () => {
    triggerPushNotification().catch(error => console.error(error));
});

if(typeof window.chrome === "undefined") {
    triggerPush.style.display = "none";
}