# Fridge Cop

<img src="https://github.com/alump/fridgecop/raw/master/public/images/fridgecop.png" width="128" height="128">

<img src="https://github.com/alump/fridgecop/raw/master/docs/notification-demo.png">

## What Is It?

Me just trying to do simple REST service to call via IFTTT when it receives on/off signals from my IOT door open sensor. Idea is to use this to trigger alarm if fridge door is left open for more than N minutes. This is just fastly written PoC, free free to steal and adapt if useful.

## Usage

### Pull code and dependencies
To run app you need to have git, node and npm available on your machine.
> git clone https://github.com/alump/fridgecop.git

> cd fridgecop

> npm install

### Configuration

To define configuration, make actual config file from example file.

> cp config/fridgecop-config-example.json config/fridgecop-config.json

 In file there are values `` and ``, generate those values with command:

>`./node_modules/.bin/web-push generate-vapid-keys`

After you have updated `config/fridgecop-config.json`, you can simply start application with:

### Run

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


### Configuration

You can get initial configuration copying example file to your config:
> cp config/fridgecop-config-example.json config/fridgecop-config.json

#### Configuration Values in config/fridgecop-config.json
| Key | Example Value | Description |
|---|---|---|
| "alarmMinutes"  | 3  | How long door has to be open to cause alarm  |
| "dbPath" | "./data" | Path were app's db files are stored |
| "deviceName"  |  "Fridge Door" |  Name of your device |
| "email"  |  "john.doe@example.com" |  Your email address |
| "historySize"  | 10  | Amount of latest history events given by API  |
| "httpPort"  | 3000 | Which TCP port app will listen  |
| "secretKey"  | "password"  | Secret key needed in open and closed calls  |
| "timeZone" | "America/Los_Angeles"  | Time zone used with times |
| "vapidPublicKey" | | Generate value with `./node_modules/.bin/web-push generate-vapid-keys` |
| "vapidPrivateKey" | | Generate value with `./node_modules/.bin/web-push generate-vapid-keys` |

## Version History

### 0.0.1 Initialial Release (TBD)
- Still under development

## Dependencies

| Library | Used for |
|---|---|
| express | To offer HTTP services outside |
| express-handlebars | To template browser pages |
| moment-timezone | To modify and present dates and times |
| nedb | To store information over restarts |
| web-push | To push notifications to users |