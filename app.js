const express = require("express");
const exphbs  = require('express-handlebars');
const moment = require('moment-timezone');

var app = express();

const alarmMinutes = 3;
const timeZone = "America/Los_Angeles";

const alarmMilliSecs = alarmMinutes * 60 * 1000;

var appStarted = moment();
var fridgeOpen = false;
var alarmTimeout = undefined;
var lastAlarm = undefined;
var restCallCounter = 0;
var doorLastOpen = undefined;

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');

function setOpenStatus(nowOpen) {
    let response = {
        "oldStatus": fridgeOpen,
        "newStatus": nowOpen
    };
    fridgeOpen = nowOpen;
    return response;
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

function getStatusObject() {
    let statusObj = {
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
    if(typeof lastAlarm !== "undefined") {
        statusObj.lastAlarm = formatMoment(lastAlarm);
    }
    return statusObj;
}

app.get('/', function (req, res) {
    res.render('home', { 'status': getStatusObject() });
});

app.get("/status", (req, res, next) => {
    let statusObj = getStatusObject();
    res.json(statusObj);
    });

app.get("/open", (req, res, next) => {
    log("Open call received");
    restCallCounter = restCallCounter + 1;
    doorLastOpen = moment();
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

app.get("/close", (req, res, next) => {
    log("Close call received");
    restCallCounter = restCallCounter + 1;
    if(hasPendingAlarm()) {
        clearTimeout(alarmTimeout);
        alarmTimeout = undefined;
    }
    let resObj = setOpenStatus(false);
    res.json(resObj);
   });

app.listen(3000, () => {
 log("Server running on port 3000");
});