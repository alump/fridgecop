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
        const scope = serviceWorkerScope;
        if(typeof scope === "undefined") {
            console.error("Scope not defined");
            return;
        }

        serviceWorkerRegister = await navigator.serviceWorker.register('sw.js', {
            scope: scope
        });
    } else {
        console.error('Service workers are not supported in this browser');
    }
}

registerServiceWorker();

function getCurrentPushSubscription() {
    return window.localStorage.getItem('pushSubscription');
}

function hasPushSubscription() {
    let currentSub = getCurrentPushSubscription();
    if(currentSub !== null && typeof currentSub !== "undefined") {
        return true;
    } else {
        return false;
    }
}

function verifySubscription(uuid, invalidCallback) {
    const queryObj = {
        "uuid": uuid
    };

    console.log("Verify current push subscription...");
    fetch("checkSubscription", {
        method: 'POST',
        body: JSON.stringify(queryObj),
        headers: {
            'Content-Type': 'application/json',
        },
    })
    .then(response => response.json())
    .then(data => {
        let found = data.found;
        if(!found) {
            console.warn("Push subscription is invalid");
            invalidCallback();
        } else {
            console.log("Push subscription is valid");
            document.getElementById("push-status").innerHTML = "Push Notifications: ON";
        }
    })
    .catch(error => console.error(error.message));
}

async function triggerPushNotification() {

    if(hasPushSubscription()) {
        return;
    }

    if (typeof serviceWorkerRegister !== "undefined") {
        const subscription = await serviceWorkerRegister.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
        });

        fetch("subscribe", {
            method: 'POST',
            body: JSON.stringify(subscription),
            headers: {
                'Content-Type': 'application/json',
            },
        })
        .then(response => response.json())
        .then(data => {
            let uuid = data.uuid;
            if(typeof uuid !== "undefined") {
                window.localStorage.setItem('pushSubscription', uuid);
                checkIfSubscribeShouldBeHidden();
            } else {
                console.error("Invalid response to subscribe call :(");
            }
        })
        .catch(error => console.error(error.message));

    } else {
        console.error('Service workers are not supported in this browser');
    }
}

triggerPush.addEventListener('click', () => {
    triggerPushNotification().catch(error => console.error(error));
});

function checkIfSubscribeShouldBeHidden() {
    // Hide subscribe button if not chrome, or if already subscribed 
    if(typeof window.chrome === "undefined" || hasPushSubscription()) {
        triggerPush.style.visibility = "hidden";
    } else {
        triggerPush.style.visibility = "visible";
    }
}

function initialSubscriptionCheck() {
    checkIfSubscribeShouldBeHidden();
    if(hasPushSubscription()) {
        verifySubscription(getCurrentPushSubscription(), () => {
            window.localStorage.removeItem("pushSubscription");
            checkIfSubscribeShouldBeHidden();
        });
    }
}

initialSubscriptionCheck();

function getWebSocketUrl() {
    let browserUrl = window.location;
    let wsUrl;
    if (browserUrl.protocol === "https:") {
        wsUrl = "wss:";
    } else {
        wsUrl = "ws:";
    }
    wsUrl += "//" + browserUrl.host;
    wsUrl += browserUrl.pathname;
    if(!wsUrl.endsWith("/")) {
        wsUrl += "/";
    }
    wsUrl += "refresher";
    console.log("WebSocket URL to use: " + wsUrl);
    return wsUrl;
}

function keepWebSockerAlive(ws) {
    // TODO: check if still alive
    console.log("websocket: sending ping");
    ws.send("ping");
}

if ("WebSocket" in window) {
    var ws = new WebSocket(getWebSocketUrl());
    ws.onopen = function() {
        console.log("WebSocket connection openned");
        ws.send("register");
    };
    ws.onmessage = function (evt) {
        let msg = evt.data;
        console.log(msg);
        if(msg === "refresh") {
            //TODO refresh data part
            window.location.reload();
        } else if(msg === "pong") {
            console.log("websocket: pong received");
            setTimeout(() => keepWebSockerAlive(ws), (2 * 60 * 1000));
        } else if(msg === "registered") {
            console.log("Initial handshake done via websocket");
            setTimeout(() => keepWebSockerAlive(ws), (2 * 60 * 1000));
            document.getElementById("autorefresh-status").innerHTML = "Auto Refresh: ON";
        } else {
            console.warn("Unknown websocket message: " + msg);
        }
    };
    ws.onclose = function() { 
        console.warn("Websocket connection closed. No auto reconnecting");
        document.getElementById("autorefresh-status").innerHTML = "Auto Refresh: OFF";
    };
}