// Page html. We inject it through javascript to use Chrome translation api
const html = `
<h1 class="main-title">${chrome.i18n.getMessage("settings")}</h1>
<h2>${chrome.i18n.getMessage("pluginStatus")}</h2>
<p>${chrome.i18n.getMessage("ps_Description")}</p>
<label class="form-switch">
    <input type="checkbox" id="enabled">
    <i></i> 
    <h3>${chrome.i18n.getMessage("ps_1")}</h3>
</label>
<h2>${chrome.i18n.getMessage("additionalSettings")}</h1>
<p>${chrome.i18n.getMessage("as_description")}</p>
<label class="form-switch">
    <input type="checkbox" id="sound">
    <i></i>
    <h3>${chrome.i18n.getMessage("as_1")}</h3>
</label><br/>
<label class="form-switch">
    <input type="checkbox" id="countdown">
    <i></i> 
    <h3>${chrome.i18n.getMessage("as_2")}</h3>
</label><br/>
<label class="form-switch">
    <input type="checkbox" id="remember">
    <i></i>
    <h3>${chrome.i18n.getMessage("as_3")}</h3>
</label><br/>
    <label class="form-switch">
    <input type="checkbox" id="private">
    <i></i>
    <h3>${chrome.i18n.getMessage("as_4")}</h3>
</label>      
<h2>${chrome.i18n.getMessage("support")}</h2>
<p>${chrome.i18n.getMessage("s_description")}</p>
<button class="box" id="donate">
    <h1 class="text-box">${chrome.i18n.getMessage("s_button")}</h1>
</button>`

document.getElementById('root').insertAdjacentHTML('beforeend', html) // Inject html

chrome.storage.sync.get(['enabled', 'sound', 'countdown', 'remember', 'private'], function(result) { // Get saved settings
    if (Object.keys(result).length < 5) { // If there are no settings saved we set defaults
        chrome.storage.sync.set({
            enabled: true,
            sound: true,
            countdown: true,
            remember: false,
            private: false
        })
    }

    Object.keys(result).forEach(delayLoop(key => { // Cycle through keys array
        document.querySelector(`#${key}`).checked = result[key] // Display saved settings
    }, 100)) // Delay to archieve animation
});

// -- LISTENERS -- //
document.querySelectorAll('input[type=checkbox]').forEach(item => {
    item.addEventListener('change', () => {
        chrome.storage.sync.set({[item.id]: item.checked}); // Save setting
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, {key: item.id, value: item.checked}); // Send new setting to Google Meet Tab
        });
    })
})

document.getElementById('donate').addEventListener('click', () => { // Open link on button click
    chrome.tabs.create({ url: "https://www.buymeacoffee.com/GoogleMeetTimer" })
})

const delayLoop = (fn, delay) => { // Delay function
    return (x, i) => {
      setTimeout(() => {
        fn(x);
      }, i * delay);
    }
  };