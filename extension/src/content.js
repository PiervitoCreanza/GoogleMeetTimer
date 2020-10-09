// content.js
Sentry.init({ dsn: 'https://fa1f7bf7757b436fb5527a591a84ae38@o434279.ingest.sentry.io/5391085' }); // Init sentry

// Declare global variables
var checkCallOnInterval = null
var checkCallOffInterval = null
var timerInterval = null
var elapsedTimeInterval = null
var meetingId = null
var isRunning = false
var preferences = null
var ringtone = new Audio(chrome.extension.getURL('src/sounds/ringtone.mp3'))
var dialogTimeout = null
var isPaused = false
var elapsedTime = 0

var socket = io.connect('https://timer.digitilab.it'); // Connect to websocket

chrome.storage.sync.get(['enabled', 'sound', 'countdown', 'remember', 'private'], function(result) { // Load saved settings
    preferences = result // Load settings as global variable
    if (preferences.enabled !== false) {
        startPlugin()
    }
});

// -- Chrome message api listener -- //
chrome.runtime.onMessage.addListener(msg => { // Listen for messages from popup.html
    preferences[msg.key] = msg.value // Update loaded settings
    
    if (preferences.enabled && !isRunning) {
        startPlugin()
    } else if (!preferences.enabled && isRunning) { // We need to remove the timer
        let timer = document.getElementById('timer-plugin')
        let style = document.getElementById('timer-style')
        if (timer && style) {
            timer.remove()
            style.remove()
            closeDialog()
            clearInterval(timerInterval)
            timerInterval = null
            clearInterval(checkCallOffInterval)
            checkCallOffInterval = null
            clearInterval(checkCallOnInterval)
            checkCallOnInterval = null
            isRunning = false
            socket.disconnect()
        }
    } else if (msg.key === "private" && msg.value === true) {
        socket.disconnect()
    } else if (msg.key === "private" && msg.value === false) {
        socket.connect()
    }
});

// -- Main functions -- //
const startPlugin = () => {
    isRunning = true
    if (preferences.private === true) {
        socket.disconnect()
    }    
    checkCallOnInterval = setInterval(checkCallOn, 250) // Start a loop until a call is entered
}

const main = () => {
    console.log('[google-timer] Plugin started!')
    elapsedTimeInterval = setInterval(() => elapsedTime ++, 1000); // Start counting time

    document.body.insertAdjacentHTML('beforeend', style) // Inject css
    document.body.insertAdjacentHTML('beforeend', timerHtml) // Inject html 
    
    chrome.storage.local.get(['seconds'], (result) => { // Check if default time is set
        if (result.seconds && preferences.remember) { // If remember is true in settings
            timer(result.seconds)
        } else { // Set timer to 00:00
            document.getElementById('time').style.color = "#5f6368"
            document.getElementById('time').innerHTML = "00:00"
            result.seconds = 0
        }
        socket.connected && socket.emit('new_meet', {id: meetingId, endTime: Date.now() + result.seconds*1000}); // Join the socket.io room
    });

    socket.on('update_time', ({endTime, senderName, userImage}) => {
        let timeRemaining = Math.round((endTime - Date.now()) /1000) // Get the remaining seconds
        if (timeRemaining > 0) { // If it is not too late
            clearInterval(timerInterval) // Reset the timer
            timerInterval = null
            timer(timeRemaining) // Start the new timer
            notification(senderName, userImage) // Notify the user
        }
    })

    // ----- LISTENERS ----- //
    document.getElementById('google-timer').addEventListener('mouseover', () => {
        timerInterval === null && displaySettings(true) // If timer is not set open settings 
    }) 
    document.getElementById('google-timer').addEventListener('mouseleave', () => {
        displaySettings(false)
    })
    document.getElementById('timer-stop').addEventListener('click', () => {
        if (timerInterval !== null || timerInterval !== undefined) {
            clearInterval(timerInterval) 
            timerInterval = null
            closeDialog() 
            document.getElementById('time').style.color = "#5f6368"
            document.getElementById('time').innerHTML = "00:00"
            displaySettings(true)
            displayStopButton(false)
        }
    })
    window.addEventListener('keyup', (e) => { // If keys are pressed
        if (e.target.offsetParent) {
            if (e.target.offsetParent.id === 'google-timer') { // If they are pressed in the plugin
                clearInterval(timerInterval)
                timerInterval = null
                let hh = document.getElementById('hh').value || 0// get hh, mm, ss
                let mm = document.getElementById('mm').value || 0
                let ss = document.getElementById('ss').value || 0
                let seconds = parseInt(hh)*3600 + parseInt(mm)*60 + parseInt(ss) // Get seconds
                setTimer(seconds) // Display the new timer
                chrome.storage.local.set({seconds}); //Save the new value in the storage
            }
        }                
    })
    document.getElementById('timer-confirm').addEventListener('click', () => {
        chrome.storage.local.get('seconds', (result) => { // Get previously saved data
            if (result.seconds) {
                clearInterval(timerInterval)
                timerInterval = null
                timer(result.seconds)
                displaySettings(false)
                if (socket.connected && !preferences.private) {
                    const dataScript = contains("script", "ds:8")
                    const userData = JSON.parse(dataScript[1].text.match(/(?<=data:).*(?:])/)[0])
                    let userName = userData[6] || "" 
                    let userImage = userData[5] || ""
                    socket.emit('sync_time', {id: meetingId, endTime: Date.now() + result.seconds*1000, senderName: userName, userImage})
                } else if (!preferences.private){
                    console.warn(`[google-timer] Unable to sync time`)
                    Sentry.captureMessage('Unable to sync time');
                }
            }            
          });
    })/* TODO: Add in next update, update server backend to handle pause sync
    document.getElementById('time').addEventListener('click', () => {
        isPaused = !isPaused
    })  */
}

const timer = (seconds) => {
    clearInterval(timerInterval)
    timerInterval = null
    closeDialog()
    displayStopButton(true)
    setTimer(preferences.countdown ? seconds : 0) // If countdown show totalTime else show 0
    var totalTime = seconds 
    var isTimeUp = false
    timerInterval = setInterval(function(){
        if (!isPaused) {
            seconds--
            setTimer(preferences.countdown ? seconds : totalTime - seconds, totalTime)
    
            if (seconds <= 0 && !isTimeUp) {
                isTimeUp = true
    
                if (preferences.countdown !== false) {
                    clearInterval(timerInterval)
                    timerInterval = null
                    displayStopButton(false)
                }
    
                document.body.insertAdjacentHTML('beforeend', dialog) // Show dialog
                document.getElementById('sound').checked = preferences.sound // Show the updated setting
    
                dialogTimeout = setTimeout(()=> { // Autoclose the dialog after 30 secs
                    closeDialog()
                }, 30000)
    
                if (preferences.sound !== false) {               
                    ringtone.play()
                    ringtone.loop = true
                }
                
                document.getElementById('timer-dialog-button').addEventListener("click", () => { // Set listener to close dialog
                    closeDialog()
                })
    
                let attempts = 0 // Count how many times user presses checkbox
                document.getElementById('sound').addEventListener('change', () => {
                    let status = document.getElementById('sound').checked
                    chrome.storage.sync.set({"sound": status});
                    preferences.sound = status
                    if (!preferences.sound) {
                        ringtone.pause()
                    }
                    attempts ++
                    if (attempts >= 4) { // If the user clicks too many times it is probably because he doesn't know how to close the dialog
                        setTimeout(() => { // Close the dialog and end the sound after 500 milliseconds
                            closeDialog()
                        }, 500)                    
                    }
                })  
            }                           
        }        
    }, 1000);
}

const setTimer = (seconds, totalTime) => {
    if (seconds >= 0) {
        let hh = zeroFill(Math.floor(seconds / 3600))
        let mm = zeroFill(Math.floor(seconds / 60) % 60)
        let ss = zeroFill(Math.floor((seconds % 60)))
    
        if (hh > 0) {
            document.getElementById('time').innerHTML = `${hh}:${mm}`
        } else {
            document.getElementById('time').innerHTML = `${mm}:${ss}`
        }

        let textStyle = getComputedStyle(document.getElementById('time')).color 

        if (preferences.countdown !== false) {
            seconds = totalTime - seconds            
        }

        if (seconds/totalTime >= 0.8 && textStyle == "rgb(95, 99, 104)") {
            document.getElementById('time').style.color = "#d93025"
        } else if (seconds/totalTime < 0.8 && textStyle !== "rgb(95, 99, 104)") {
            document.getElementById('time').style.color = "#5f6368"
        }
    }   
}

// -- Interval functions -- //
const checkCallOn = () => {
    let menu = document.getElementsByClassName('Jrb8ue')
    if (menu.length > 0) { // If the menu exists we are in a call
        clearInterval(checkCallOnInterval) // Stop the loop
        checkCallOffInterval = setInterval(checkCallOff, 1000)        
        let meetingIdNode = document.getElementsByClassName('SSPGKf p2ZbV')
        if (meetingIdNode.length) {
            meetingId = meetingIdNode[0].getAttribute('data-unresolved-meeting-id')
            
            if (meetingId) {             
                main()
            } else {
                console.log('[google-timer] Error: Unable to get meeting id')
                Sentry.captureMessage('Unable to get meeting id');
            }
        } else {
            console.log('[google-timer] Error: Unable to get meeting id')
            Sentry.captureMessage('Unable to get meeting id');
        }        
    }    
}

const checkCallOff = () => {
    let menu = document.getElementsByClassName('Jrb8ue')
    if (!menu.length) {
        console.log('[google-timer] Call off')
        let hh = zeroFill(Math.floor(elapsedTime / 3600))
        let mm = zeroFill(Math.floor(elapsedTime / 60) % 60)
        let ss = zeroFill(Math.floor((elapsedTime % 60)))
        console.log(hh, mm, ss)
        socket.close() // Close the websocket
        clearInterval(checkCallOffInterval)
        checkCallOffInterval = null
        clearInterval(timerInterval)
        timerInterval = null
        clearInterval(elapsedTimeInterval)
        elapsedTimeInterval = null
        displayTimer(false)
    }
}

// -- Switches -- //
const displayTimer = (bool) => {   
    if (bool) {
        document.getElementById('timer-container').style.display = 'flex'
    } else {
        document.getElementById('timer-container').style.display = 'none'
    }    
}

const displaySettings = (bool) => {
    if (bool) {
        document.getElementById('timer-settings-container').style.display = 'flex'
        document.getElementById('timer-settings').style.display = 'none'
        document.getElementById('timer-main-divider').classList.add('settings-open')        
        document.getElementById('google-timer').classList.add('settings-open')
    } else {
        document.getElementById('timer-settings-container').style.display = 'none'
        document.getElementById('timer-settings').style.display = 'block'
        document.getElementById('timer-main-divider').classList.remove('settings-open')
        document.getElementById('google-timer').classList.remove('settings-open')
    }
}

const closeDialog = () => {
    let dialog = document.getElementById('timer-dialog')
    if (dialog) {
        dialog.outerHTML = "";
        ringtone.pause()
        clearTimeout(dialogTimeout)
    }
}

const displayStopButton = (bool) => {
    if (bool) {
        document.getElementById('timer-stop').style.display = ""
        document.getElementById('timer-settings-icon').style.display = "none"
    } else {
        document.getElementById('timer-stop').style.display = "none"
        document.getElementById('timer-settings-icon').style.display = ""
    }
    
}

const notification = (userName, userImage) => {
    if (userName) {
        document.getElementById('timer-message-description').innerHTML = `<b>${userName}</b> ${chrome.i18n.getMessage("timerUpdate")}`
        document.getElementById('timer-notification-image').src = userImage || ""
    } else {
        document.getElementById('timer-message-description').innerHTML = chrome.i18n.getMessage("timerSet")
    }
    document.getElementById('timer-notification').style.opacity = 1
    setTimeout(() => document.getElementById('timer-notification').style.opacity = 0, 20000)
}

// -- Utility functions -- //
const contains = (selector, text) => {
    var elements = document.querySelectorAll(selector);
    return [].filter.call(elements, function(element) {
      return RegExp(text).test(element.textContent);
    });
};

const zeroFill = (n) => {
    return ('0'+n).slice(-2)
}

// -- HTML and CSS elements -- //
const timerHtml = `
<div class="timer-app-container" id="timer-plugin">
    <div class="timer-body" id="google-timer">
        <div class="sub-container">
            <div class="timer-container" id="timer-container">
                <p class="timer-digits text" id="time"></p>
                <div class="qO3Z3c divider" id="timer-main-divider"></div>
                <span id="timer-settings" data-v-72ebea3c="" aria-hidden="true" class="DPvwYc sm8sCf SX67K">            
                    <svg id="timer-settings-icon" data-v-72ebea3c="" width="24" height="24" viewBox="0 0 24 24" focusable="false" class="Hdh4hc cIGbvc NMm5M">
                        <path data-v-72ebea3c="" d="M13.85 22.25h-3.7c-.74 0-1.36-.54-1.45-1.27l-.27-1.89c-.27-.14-.53-.29-.79-.46l-1.8.72c-.7.26-1.47-.03-1.81-.65L2.2 15.53c-.35-.66-.2-1.44.36-1.88l1.53-1.19c-.01-.15-.02-.3-.02-.46 0-.15.01-.31.02-.46l-1.52-1.19c-.59-.45-.74-1.26-.37-1.88l1.85-3.19c.34-.62 1.11-.9 1.79-.63l1.81.73c.26-.17.52-.32.78-.46l.27-1.91c.09-.7.71-1.25 1.44-1.25h3.7c.74 0 1.36.54 1.45 1.27l.27 1.89c.27.14.53.29.79.46l1.8-.72c.71-.26 1.48.03 1.82.65l1.84 3.18c.36.66.2 1.44-.36 1.88l-1.52 1.19c.01.15.02.3.02.46s-.01.31-.02.46l1.52 1.19c.56.45.72 1.23.37 1.86l-1.86 3.22c-.34.62-1.11.9-1.8.63l-1.8-.72c-.26.17-.52.32-.78.46l-.27 1.91c-.1.68-.72 1.22-1.46 1.22zm-3.23-2h2.76l.37-2.55.53-.22c.44-.18.88-.44 1.34-.78l.45-.34 2.38.96 1.38-2.4-2.03-1.58.07-.56c.03-.26.06-.51.06-.78s-.03-.53-.06-.78l-.07-.56 2.03-1.58-1.39-2.4-2.39.96-.45-.35c-.42-.32-.87-.58-1.33-.77l-.52-.22-.37-2.55h-2.76l-.37 2.55-.53.21c-.44.19-.88.44-1.34.79l-.45.33-2.38-.95-1.39 2.39 2.03 1.58-.07.56a7 7 0 0 0-.06.79c0 .26.02.53.06.78l.07.56-2.03 1.58 1.38 2.4 2.39-.96.45.35c.43.33.86.58 1.33.77l.53.22.38 2.55z"></path><circle data-v-72ebea3c="" cx="12" cy="12" r="3.5"></circle>
                    </svg>
                    <svg style="display: none;" fill="#5f6368" id="timer-stop" height="24" viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V9c0-1.1-.9-2-2-2H8c-1.1 0-2 .9-2 2v10zM18 4h-2.5l-.71-.71c-.18-.18-.44-.29-.7-.29H9.91c-.26 0-.52.11-.7.29L8.5 4H6c-.55 0-1 .45-1 1s.45 1 1 1h12c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
                    <svg width="26" height="26" viewBox="0 0 24 24" id="timer-cancel" style="display: none;">
                        <path fill="red" d="M18.3 5.71c-.39-.39-1.02-.39-1.41 0L12 10.59 7.11 5.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41L10.59 12 5.7 16.89c-.39.39-.39 1.02 0 1.41.39.39 1.02.39 1.41 0L12 13.41l4.89 4.89c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/>
                    </svg>
                </span>
            </div>
            <div class="timer-container-settings" id="timer-settings-container" style="display: none;">
                <input class="timer-input browser-default" placeholder="00" name="time" id="hh" autocomplete="off" type="custom"><p class="timer-label">h</p>
                <div class="qO3Z3c timer-divider"></div>
                <input class="timer-input browser-default" placeholder="00" name="time" id="mm" autocomplete="off" type="custom"><p class="timer-label">min</p>
                <div class="qO3Z3c timer-divider"></div>
                <input class="timer-input browser-default" placeholder="00" name="time" id="ss" autocomplete="off" type="custom"><p class="timer-label">sec</p>
                <div class="qO3Z3c timer-divider"></div>
                <div class="center">
                    <svg width="24" height="24" id="timer-confirm">
                        <path fill="green" d="M9 16.17L5.53 12.7c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0L9 16.17z"></path>
                    </svg>
                </div>
            </div>
        </div>
    </div>
    <div class="timer-notification-body" id="timer-notification">
        <img class="timer-notification-image" id="timer-notification-image" src=""/>
        <p class="timer-message-description" id="timer-message-description"></p>
    </div>
</div>
`
const style = `
<style id="timer-style">
    .timer-divider {
        margin-right: 10px;
        margin-left: 10px;
        height: 20px;
    }
    .divider {
        margin-right: 10px;
        margin-left: 10px;
        height: 20px;
    }
    .timer-body {
        display: flex;
        background-color: white; 
        width: fit-content;
        border-radius: 0 0 8px 8px;
        padding: 0 20px 0 20px;
        text-align: center;
        /*height: fit-content;*/
        top: 0;
        /*left: 0;*/
        position: absolute;
        z-index: 99999;
        height: 48px;
        max-width: 120px;
        transition: height .5s ease-in-out, max-width .5s ease-in-out;
        overflow: hidden;
        flex-direction: column;
        box-sizing: content-box;
    }
    .text {
        color: white;
    }
    .timer-title {
        font-size: 15px;
        margin: 0;
        opacity: 80%;
    }
    .timer-digits {
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
        font-size: 30px;
        color: #5f6368;
        margin: 0;
        user-select: none;
    }
    .timer-app-container {
        display: flex;
        justify-content: center;
    }
    .timer-container {
        display: flex;
        align-items: center;
        height: 48px;
    }
    .timer-container-settings {
        display: flex;
        align-items: center;
    }
    .timer-input {
        color: #5f6368;
        font-weight: 600;
        text-align: center;
        width: 38px;
        border: none;
        height: 40px;
        border-radius: 5px;
        font-size: 30px;
        padding: 0;
        background-color: transparent;
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
        margin-right: 5px;
    }
    .timer-label {
        font-weight: 300;
        font-size: 20px;
        margin: 0;
    }
    .timer-input::placeholder {
        color: #5f6368;
        opacity: .5;
    }
    .timer-input:focus::placeholder { 
        color: transparent;
    }
    .timer-body.settings-open {
        max-width: 400px;
    }
    .sub-container {
        display: flex; 
        flex-wrap: wrap; 
        width: 400px;
    }
    .timer-notification-body {
        position: fixed;
        bottom: 100px;
        left: 20px;
        z-index: 10000;
        display: flex;
        background-color: white;
        padding: 0 30px;
        border-radius: 30px;
        font-size: 15px;
        display: flex;
        align-items: center;
        transition: opacity .5s ease-in-out;
        opacity: 0;
    }
    .timer-notification-image {
        max-height: 30px;
        margin-right: 10px;
        margin-left: -15px;
    }
    @media only screen and (max-width: 1080px) {
        .timer-body.settings-open {
            width: 120px;
            height: 207px;
        }
        .timer-container-settings {
            justify-content: flex-start;  
            flex-wrap: wrap;      
        }
        .timer-input {
            width: 50%;
        }
        .divider.settings-open, .timer-divider {
            display: none;
        }
        #timer-confirm {
            margin-bottom: 10px;
            margin-top: 5px;
        }
        .center {
            display: flex;
            justify-content: center;
            width: 100%;
        }
        .sub-container {
            justify-content: center;
            width: inherit;
        }
    }
    .form-switch {
        display: inline-block;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        margin-bottom: 10px;
        display: flex;
        margin-bottom: 0;
        align-items: center;
    }

    .form-switch i {
        position: relative;
        display: inline-block;
        margin-right: .5rem;
        width: 46px;
        height: 26px;
        background-color: #e6e6e6;
        border-radius: 23px;
        vertical-align: text-bottom;
        transition: all 0.3s linear;
    }

    .form-switch i::before {
        content: "";
        position: absolute;
        left: 0;
        width: 42px;
        height: 22px;
        background-color: #fff;
        border-radius: 11px;
        transform: translate3d(2px, 2px, 0) scale3d(1, 1, 1);
        transition: all 0.25s linear;
    }

    .form-switch i::after {
        content: "";
        position: absolute;
        left: 0;
        width: 22px;
        height: 22px;
        background-color: #fff;
        border-radius: 11px;
        box-shadow: 0 2px 2px rgba(0, 0, 0, 0.24);
        transform: translate3d(2px, 2px, 0);
        transition: all 0.2s ease-in-out;
    }

    .form-switch:active i::after {
        width: 28px;
        transform: translate3d(2px, 2px, 0);
    }

    .form-switch:active input:checked + i::after { transform: translate3d(16px, 2px, 0); }

    .form-switch input { display: none; }

    .form-switch input:checked + i { background: rgb(204,43,94);
    background: linear-gradient(90deg, rgba(204,43,94,1) 35%, rgba(117,58,136,1) 100%); }

    .form-switch input:checked + i::before { transform: translate3d(18px, 2px, 0) scale3d(0, 0, 0); }

    .form-switch input:checked + i::after { transform: translate3d(22px, 2px, 0); }
</style>`
const dialog = `
<div id="timer-dialog" style="display: flex; justify-content: center; align-items: center; height: 100%;"> 
    <div style="position: relative; background-color: white; border-radius: 15px; padding: 25px; width: 350px; text-align: center; z-index: 9999; height: fit-content;">
    <svg version="1.1" id="timer-dialog-button" style="cursor: pointer; position: absolute; right: 15px; top: 15px;" width="24" height="24" focusable="false" viewBox="0 0 34 34" enable-background="new 0 0 34 34">
        <linearGradient id="SVGID_1_" gradientUnits="userSpaceOnUse" x1="0" y1="17" x2="34" y2="17"><stop  offset="0" style="stop-color:#CC2B5E"/><stop  offset="1" style="stop-color:#753A88"/></linearGradient>
        <path fill="url(#SVGID_1_)" d="M34,3.4L30.6,0L17,13.6L3.4,0L0,3.4L13.6,17L0,30.6L3.4,34L17,20.4L30.6,34l3.4-3.4L20.4,17L34,3.4z"/>
    </svg>
        <h1 style="font-family: Roboto; margin: 15px; color: #3a3a3a; font-weight: 700; font-size: 55px; margin-bottom: 0;">${chrome.i18n.getMessage("timerElapsed")}</h1>
        <label class="form-switch" style="display: flex; align-items: center; justify-content: center; margin-top: 0;">
            <input type="checkbox" id="sound">    
            <i></i>
            <h3 style="font-family: Roboto; color: #3a3a3a; font-weight: 300; font-size: 17px;">${chrome.i18n.getMessage("as_1")}</h3>
            </label>        
    </div>
</div>`