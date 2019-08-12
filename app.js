const express = require("express");
const exphbs  = require('express-handlebars');
const expressws = require('express-ws');
const moment = require('moment-timezone');
const webPush = require('web-push');
const datastore = require('nedb');
const uuidv1 = require('uuid/v1');
const config = require('./config/fridgecop-config.json');

const packageJson = require('./package.json');

var app = express();
var ws = expressws(app);

const alarmMilliSecs = config.alarmMinutes * 60 * 1000;
const appStarted = moment();

// Application state
var fridgeOpen = false;
var alarmTimeout = undefined;
var lastAlarm = undefined;
var restCallCounter = 0;
var doorLastOpen = undefined;
var doorLastClosed = undefined;
var eventHistory = [];

app.use(express.urlencoded());
app.use(express.json());
app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

webPush.setVapidDetails("mailto:" + config.email,
    config.vapidPublicKey, config.vapidPrivateKey);

const db = {};
db.webPushSubscriptions = new datastore(config.dbPath + "/webpushsubs.db");
db.webPushSubscriptions.loadDatabase();
db.webPushSubscriptions.ensureIndex({ fieldName: 'uuid', unique: true }, function (err) {
    if(err != null) {
        logError(err.message);
    }
});

function addToHistory(eventTimestamp, isOpen) {
    let historyEvent = {
        "time": formatMoment(eventTimestamp),
        "isOpen": isOpen,
        "newStatus": getOpenStatusString()
    };
    if(eventHistory.length >= config.historySize) {
        eventHistory.shift();
    }
    eventHistory.push(historyEvent);
}

function setOpenStatus(nowOpen) {
    let eventTimeStamp = moment();
    restCallCounter = restCallCounter + 1;
    let wasOpen = fridgeOpen;
    fridgeOpen = nowOpen;

    let actionResponse = {
        "wasOpen": wasOpen,
        "isOpen": fridgeOpen,
        "currentStatus": getOpenStatusString(),
        "timestamp": formatMoment(eventTimeStamp)
    };

    addToHistory(eventTimeStamp, fridgeOpen);

    if(fridgeOpen) {
        doorLastOpen = eventTimeStamp;
    } else {
        doorLastClosed = eventTimeStamp;
    }

    sendBrowserUpdates();

    return actionResponse;
}

function log(message) {
    console.log(formatCurrentMoment() + " " + message);
}

function logError(message) {
    console.error(formatCurrentMoment() + " " + message);
}

function formatCurrentMoment() {
    return formatMoment(moment());
}

function formatMoment(momentValue) {
    return momentValue.tz(config.timeZone).format();
}

function createNotificationPayload() {
    let jsonObject = {
        title: config.deviceName + " is open!",
        body: "since " + doorLastOpen.format("LT"),
        icon: "images/fridgecop.png",
        tag: config.deviceName + "-" + formatMoment(doorLastOpen),
        requireInteraction: true
    };

    return JSON.stringify(jsonObject);
}

function sendBrowserUpdates() {
    ws.getWss().clients.forEach(ws => {
        log("Pushing refresh via WebSocket to client");
        ws.send("refresh");
    });
}

function sendAlarm() {
    lastAlarm = moment();
    log("Sending door open alarms...");
    alarmTimeout = undefined;
    pendingAlarm = false;

    const payload = createNotificationPayload();

    db.webPushSubscriptions.find({}, function (err, docs) {
        docs.forEach(entry => {
            webPush.sendNotification(entry.subscription, payload)
            .catch(error => {
                logError("Submitting alarm via webpush failed");
                logError(error);
            });
        });
    });
}

function hasPendingAlarm() {
    return typeof alarmTimeout !== "undefined";
}

function getOpenStatusString() {
    if(restCallCounter == 0) {
        return "undefined";
    } else if(fridgeOpen) {
        return "open";
    } else {
        return "closed";
    }
}

function getStatusObject() {
    let statusObj = {
        "device": config.deviceName,
        "currentStatus": getOpenStatusString(),
        "version": packageJson.version,
        "updateCounter": restCallCounter,
        "doorOpenNow": fridgeOpen,
        "pendingAlarm": hasPendingAlarm(),
        "alarmMinutes": config.alarmMinutes,
        "timeZone": config.timeZone
    }
    if(typeof appStarted !== "undefined") {
        statusObj.started = formatMoment(appStarted);
    }
    if(typeof doorLastOpen !== "undefined") {
        statusObj.doorLastOpen = formatMoment(doorLastOpen);
    }
    if(typeof doorLastClosed !== "undefined") {
        statusObj.doorLastClosed = formatMoment(doorLastClosed);
    }
    if(typeof lastAlarm !== "undefined") {
        statusObj.lastAlarm = formatMoment(lastAlarm);
    }
    return statusObj;
}

function validateSecretKey(req, res) {
    const receivedKey = req.query.secretKey;
    let errorObj;

    if(typeof receivedKey === "undefined") {
        errorObj = errorObject("Secret key missing from REST call");
    } else if(receivedKey !== config.secretKey) {
        errorObj = errorObject("Invalid secret key received!");
    } else {
        return true;
    }

    res.status(403);
    res.json(errorObj);
    return false;
}

function errorObject(message) {
    logError(message);
    let errorObj = {
        "error": message,
        "time": formatCurrentMoment() 
    }
    return errorObj;
}

function appConfigObjectForViews() {
    return {
        "publicVapidKey": config.vapidPublicKey,
        "serviceWorkerScope": config.serviceWorkerScope
    };
}

// For browser
app.get('/', function (req, res) {
    let renderDataObj = {};
    renderDataObj.status = getStatusObject();
    renderDataObj.history = eventHistory;
    renderDataObj.app = appConfigObjectForViews();
    
    res.render('home', renderDataObj);
});

// REST get status
app.get("/status", (req, res, next) => {
    let statusObj = getStatusObject();
    res.json(statusObj);
    });

// REST trigger door open
app.get("/open", (req, res, next) => {
    log("Open call received");
    if(!validateSecretKey(req, res)) {
        return;
    }
    let wasOpen = fridgeOpen;
    let resObj = setOpenStatus(true);
    res.json(resObj);
    if(!wasOpen) {
        if(hasPendingAlarm()) {
            clearTimeout(alarmTimeout);
        }
        log("Starting timeout for alarm...");
        alarmTimeout = setTimeout(sendAlarm, alarmMilliSecs);
    }
    });

// REST trigger door closed
app.get("/closed", (req, res, next) => {
    log("Closed call received");
    if(!validateSecretKey(req, res)) {
        return;
    }
    if(hasPendingAlarm()) {
        clearTimeout(alarmTimeout);
        alarmTimeout = undefined;
    }
    let resObj = setOpenStatus(false);
    res.json(resObj);
   });

// REST event history
app.get("/history", (req, res, next) => {
    res.json(eventHistory);
});

// REST check subscription status
app.post('/checkSubscription', (req, res) => {
    const subUuid = req.body.uuid;
    if(typeof subUuid === "undefined") {
        const errorMessage = "No uuid in checkSubscription call";
        res.status(403).json(errorObject(errorMessage));
        return;
    }

    db.webPushSubscriptions.findOne({ "uuid": subUuid }).exec(function (err, doc) {
        if(err !== null) {
            errorMessage = "Error while quering subscription";
            res.status(403).json(errorObject(errorMessage));
            return;
        }

        let found = (doc !== null);

        res.json({
            "found": found
        });
    });

});

// REST subscribe for push notifications
app.post('/subscribe', (req, res) => {
    const subscription = req.body;

    if(typeof subscription === "undefined") {
        const errorMessage = "No subscription in subscribe call";
        res.status(403).json(errorObject(errorMessage));
        return;
    }

    const dbEntry = {
        "uuid": uuidv1(),
        "subscription": subscription,
        "created": formatCurrentMoment()
    };

    db.webPushSubscriptions.insert(dbEntry, function(err, newDoc) {
        log("WebPush Subscription " + dbEntry.uuid + " added (" + newDoc._id + ")");
    });
    
    const responseObj = {
        "uuid": dbEntry.uuid
    };

    res.status(201).json(responseObj);
});

app.ws('/refresher', function(ws, req) {
    log("refresher called");

    ws.on('message', function(msg) {
        if(msg === "ping") {
            ws.send("pong");
        } else if(msg === "register") {
            log("Register call from websocket");
            ws.send("registered");
        } else {
            logError("Unknown message: " + msg);
        }
    });
});

app.use(express.static("public"));

app.listen(config.httpPort, () => {
    log("Started for device: " + config.deviceName);
    log("Server running on port " + config.httpPort);
});