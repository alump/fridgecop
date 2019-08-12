const express = require("express");
const exphbs  = require('express-handlebars');
const moment = require('moment-timezone');

const packageJson = require('./package.json');

var app = express();

// TODO: Move following to properties when ready
const alarmMinutes = 3;
const timeZone = "America/Los_Angeles";
const deviceName = "Fridge Door";
const historySize = 10;
const secretKey = "todoTODOtodo";

const alarmMilliSecs = alarmMinutes * 60 * 1000;

var appStarted = moment();
var fridgeOpen = false;
var alarmTimeout = undefined;
var lastAlarm = undefined;
var restCallCounter = 0;
var doorLastOpen = undefined;
var doorLastClosed = undefined;
var eventHistory = [];

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

function addToHistory(eventTimestamp, isOpen) {
    let historyEvent = {
        "time": formatMoment(eventTimestamp),
        "isOpen": isOpen,
        "newStatus": getOpenStatusString()
    };
    if(eventHistory.length >= historySize) {
        eventHistory.shift();
    }
    eventHistory.push(historyEvent);
}

function setOpenStatus(nowOpen) {
    let eventTimeStamp = moment();
    restCallCounter = restCallCounter + 1;
    let actionResponse = {
        "wasOpen": fridgeOpen,
        "isOpen": nowOpen,
        "currentStatus": getOpenStatusString(),
        "timestamp": formatMoment(eventTimeStamp)
    };
    fridgeOpen = nowOpen;

    addToHistory(eventTimeStamp, fridgeOpen);

    if(fridgeOpen) {
        doorLastOpen = eventTimeStamp;
    } else {
        doorLastClosed = eventTimeStamp;
    }
    return actionResponse;
}

function log(message) {
    console.log(formatCurrentMoment() + " " + message);
}

function formatCurrentMoment() {
    return formatMoment(moment());
}

function formatMoment(momentValue) {
    return momentValue.tz(timeZone).format();
}

function sendAlarm() {
    lastAlarm = moment();
    log("Sending door open alarm");
    pendingAlarm = false;
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
        "device": deviceName,
        "currentStatus": getOpenStatusString(),
        "version": packageJson.version,
        "updateCounter": restCallCounter,
        "doorOpenNow": fridgeOpen,
        "pendingAlarm": hasPendingAlarm(),
        "alarmMinutes": alarmMinutes,
        "timeZone": timeZone
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

    console.log(req.params);

    if(typeof receivedKey === "undefined") {
        errorObj = errorObject("Secret key missing from REST call");
    } else if(receivedKey !== secretKey) {
        errorObj = errorObject("Invalid secret key received!");
    } else {
        return true;
    }

    log(errorObj.error);
    res.status(403);
    res.json(errorObj);
    return false;
}

function errorObject(message) {
    let errorObj = {
        "error": message,
        "time": formatCurrentMoment() 
    }
    return errorObj;
}

app.get('/', function (req, res) {
    let renderDataObj = {};
    renderDataObj.status = getStatusObject();
    renderDataObj.history = eventHistory;
    res.render('home', renderDataObj);
});

app.get("/status", (req, res, next) => {
    let statusObj = getStatusObject();
    res.json(statusObj);
    });

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

app.get("/history", (req, res, next) => {
    res.json(eventHistory);
});

app.use(express.static("public"));

app.listen(3000, () => {
 log("Server running on port 3000");
});