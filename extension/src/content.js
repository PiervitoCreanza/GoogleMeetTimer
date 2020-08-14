// content.js
Sentry.init({ dsn: 'https://fa1f7bf7757b436fb5527a591a84ae38@o434279.ingest.sentry.io/5391085' }); // Init sentry

const socket = io.connect('https://timer.digitilab.it');
var connect_error = false
socket.io.on("connect_error", () => {    
    !connect_error && Sentry.captureMessage('socket.io connection error')
    connect_error = true
})
// Interval functions
const checkCallOn = () => {
    let menu = document.getElementsByClassName('Jrb8ue')
    if (menu.length > 0) { // If the menu exists we are in a call
        clearInterval(intervalId) // Stop the loop
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
        socket.close() // Close the websocket
        clearInterval(checkCallOffInterval)
        clearInterval(timerInterval)
        timerInterval = null
        displayTimer(false)
    }
}


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

var intervalId = setInterval(checkCallOn, 250) // Start a loop until a call is entered
var checkCallOffInterval = null
var timerInterval = null
var timeSet = null
var meetingId = null
const main = () => {
    console.log('[google-timer] Plugin started!')

    // Provide compability to Google Meet Attendance extension
    let styles = document.styleSheets    
    for (let i = 0; i < styles.length; i++) {
        if (styles[i].href === "https://cdnjs.cloudflare.com/ajax/libs/materialize/1.0.0/css/materialize.min.css") {
            console.log('[google-timer] Set compability mode to google meet attendance')
            styles[i].disabled=true;
            break; 
        }
    }

    document.body.insertAdjacentHTML('beforeend', style) // Inject css
    document.body.insertAdjacentHTML('beforeend', timerHtml) // Inject html 

    chrome.storage.local.get(['seconds'], (result) => { // Check if default time is set
        if (result.seconds) {
            timer(result.seconds)
        } else {
            document.getElementById('time').style.color = "#5f6368"
            document.getElementById('time').innerHTML = "00:00"
        }
        socket.connected && socket.emit('new_meet', {id: meetingId, endTime: Date.now() + result.seconds*1000});
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
    document.getElementById('timer-settings').addEventListener('mouseover', () => {
        displaySettings(true)
    })
    document.getElementById('google-timer').addEventListener('mouseleave', () => {
        displaySettings(false)
    })
    window.addEventListener('keyup', (e) => { // If keys are pressed
        if (e.target.offsetParent) {
            if (e.target.offsetParent.id === 'google-timer') { // If they are pressed in the plugin
                clearInterval(timerInterval)
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
        displaySettings(false)
        chrome.storage.local.get('seconds', (result) => { // Get previously saved data
            if (result.seconds) {
                clearInterval(timerInterval)
                timer(result.seconds)
                if (socket.connected) {
                    const dataScript = contains("script", "ds:7")
                    const userData = JSON.parse(dataScript[1].text.match(/\[[^\}]*/)[0])
                    let userName = userData[6] || "" 
                    let userImage = userData[5] || ""
                    socket.emit('sync_time', {id: meetingId, endTime: Date.now() + result.seconds*1000, senderName: userName, userImage})
                } else {
                    console.warn('[google-timer] Unable to sync time')
                    Sentry.captureMessage('Unable to sync time');
                }
            }            
          });
    })   
}



const timer = (seconds) => {    
    displayTimer(true)    
    setTimer(seconds)
    let msg = document.getElementById('timer-banner')
    msg && (msg.outerHTML = '') // Remove end message if present
    timerInterval = setInterval(function(){        
        seconds--;
        setTimer(seconds)
        if (seconds < 0) {
            clearInterval(timerInterval);
            timerInterval = null
            let parent = document.getElementsByClassName('o6gIdf zCbbgf')
            if (parent.length) {
                parent = parent[0]
                const messageNode = document.createElement('div')
                messageNode.setAttribute("style", "position: relative")
                messageNode.innerHTML = message
                parent.append(messageNode)
                document.getElementById('timer-banner-button').addEventListener("click", () => document.getElementById('timer-banner').outerHTML = "")
            } else {
                console.log('[google-timer] Error: unable to show the finish timer-confirm (no element by class)')
                Sentry.captureMessage('unable to show the finish timer-confirm (no element by class');
            }        
        }
    }, 1000);
}

const setTimer = (seconds) => {
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
        if (seconds <= 120 && textStyle == "rgb(95, 99, 104)") {
            document.getElementById('time').style.color = "#d93025"
        } else if (seconds >= 120 && textStyle !== "rgb(95, 99, 104)") {
            document.getElementById('time').style.color = "#5f6368"
        }
    }    
}

const zeroFill = (n) => {
    return ('0'+n).slice(-2)
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

const timerHtml = `
<div class="timer-app-container" id="timer-plugin">
    <div class="timer-body" id="google-timer">
        <div class="sub-container">
            <div class="timer-container" id="timer-container">
                <p class="timer-digits text" id="time"></p>
                <div class="qO3Z3c divider" id="timer-main-divider"></div>
                <span id="timer-settings" data-v-72ebea3c="" aria-hidden="true" class="DPvwYc sm8sCf SX67K">            
                    <svg data-v-72ebea3c="" width="24" height="24" viewBox="0 0 24 24" focusable="false" class="Hdh4hc cIGbvc NMm5M">
                        <path data-v-72ebea3c="" d="M13.85 22.25h-3.7c-.74 0-1.36-.54-1.45-1.27l-.27-1.89c-.27-.14-.53-.29-.79-.46l-1.8.72c-.7.26-1.47-.03-1.81-.65L2.2 15.53c-.35-.66-.2-1.44.36-1.88l1.53-1.19c-.01-.15-.02-.3-.02-.46 0-.15.01-.31.02-.46l-1.52-1.19c-.59-.45-.74-1.26-.37-1.88l1.85-3.19c.34-.62 1.11-.9 1.79-.63l1.81.73c.26-.17.52-.32.78-.46l.27-1.91c.09-.7.71-1.25 1.44-1.25h3.7c.74 0 1.36.54 1.45 1.27l.27 1.89c.27.14.53.29.79.46l1.8-.72c.71-.26 1.48.03 1.82.65l1.84 3.18c.36.66.2 1.44-.36 1.88l-1.52 1.19c.01.15.02.3.02.46s-.01.31-.02.46l1.52 1.19c.56.45.72 1.23.37 1.86l-1.86 3.22c-.34.62-1.11.9-1.8.63l-1.8-.72c-.26.17-.52.32-.78.46l-.27 1.91c-.1.68-.72 1.22-1.46 1.22zm-3.23-2h2.76l.37-2.55.53-.22c.44-.18.88-.44 1.34-.78l.45-.34 2.38.96 1.38-2.4-2.03-1.58.07-.56c.03-.26.06-.51.06-.78s-.03-.53-.06-.78l-.07-.56 2.03-1.58-1.39-2.4-2.39.96-.45-.35c-.42-.32-.87-.58-1.33-.77l-.52-.22-.37-2.55h-2.76l-.37 2.55-.53.21c-.44.19-.88.44-1.34.79l-.45.33-2.38-.95-1.39 2.39 2.03 1.58-.07.56a7 7 0 0 0-.06.79c0 .26.02.53.06.78l.07.56-2.03 1.58 1.38 2.4 2.39-.96.45.35c.43.33.86.58 1.33.77l.53.22.38 2.55z"></path><circle data-v-72ebea3c="" cx="12" cy="12" r="3.5"></circle>
                    </svg>
                </span>
            </div>
            <div class="timer-container-settings" id="timer-settings-container" style="display: none;">
                <input class="timer-input" placeholder="00" name="time" id="hh" autocomplete="off"><p class="timer-label">h</p>
                <div class="qO3Z3c timer-divider"></div>
                <input class="timer-input" placeholder="00" name="time" id="mm" autocomplete="off"><p class="timer-label">min</p>
                <div class="qO3Z3c timer-divider"></div>
                <input class="timer-input" placeholder="00" name="time" id="ss" autocomplete="off"><p class="timer-label">sec</p>
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
<style>
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
    z-index: 1;
    height: 48px;
    max-width: 120px;
    transition: height .5s ease-in-out, max-width .5s ease-in-out;
    overflow: hidden;
    flex-direction: column;
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
}
#timer-banner {
    left: -110px;
    top: -165px;
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
</style>
`

const message = `
<div class="MvD9Jd ncMv2e timer-banner" id="timer-banner">
    <div class="dj3AKc">
        <p class="McXdrf">${chrome.i18n.getMessage("timerElapsed")}</p>
    </div>
    <div id="timer-banner-button" class="uArJ5e Y5FYJe cjq2Db HZJnJ L8jh1" >
        <div class="PDXc1b MbhUzd"></div><span class="XuQwKc"><span class="GmuOkf"><span class="DPvwYc tEYUvc"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="CEJND cIGbvc NMm5M"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"></path></svg></span></span>
        </span>
    </div>
    <div class="QSW55" style="left: 125px;"></div>
</div>
`

const contains = (selector, text) => {
    var elements = document.querySelectorAll(selector);
    return [].filter.call(elements, function(element) {
      return RegExp(text).test(element.textContent);
    });
  };