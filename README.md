# Fridge Cop

## What Is It?

Me just trying to do simple REST service to call via IFTTT when it receives on/off signals from my IOT door open sensor. Idea is to use this to trigger alarm if fridge door is left open for more than N minutes. This is just fastly written PoC, free free to steal and adapt if useful.

## Version History

### 0.0.1 Initialial Release (TBD)
- Still under development

## Usage

### Pull and Run Locally...
To run app you need to have git, node and npm available on your machine.
> git clone https://github.com/alump/fridgecop.git

> cd fridgecop

> npm install

> node app.js

After this you should see "Service started" message.

### Calling Service

#### REST/JSON Calls

To get current status call (GET): http://localhost:3000/status

To send "open" update call (GET): http://localhost:3000/open?secretKey=XXX

To send "closed" update call (GET): http://localhost:3000/closed?secretKey=XXX

To read the latest events (GET): http://localhost:3000/history

#### Browser

There is also page for browser: http://localhost:3000