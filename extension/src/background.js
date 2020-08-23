chrome.runtime.setUninstallURL('https://timer.digitilab.it/uninstall')

// Check whether new version is installed
chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
        chrome.tabs.create({ url: "https://timer.digitilab.it/download/GoogleMeetTimer_Manual_en.pdf" })
    }
});