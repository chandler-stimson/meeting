'use strict';

const toast = document.getElementById('toast');

chrome.storage.local.get({
  'signaling-server': '',
  'signaling-token': ''
}, prefs => {
  document.getElementById('signaling-server').value = prefs['signaling-server'] || 'wss://connect.meetingserver.repl.co/[CHANNEL_ID]?apiKey=[API_KEY]';
  document.getElementById('signaling-token').value = prefs['signaling-token'];
});

document.getElementById('save').addEventListener('click', () => chrome.storage.local.set({
  'signaling-server': document.getElementById('signaling-server').value,
  'signaling-token': document.getElementById('signaling-token').value
}, () => {
  toast.textContent = 'Options saved';
  window.setTimeout(() => toast.textContent = '', 750);
}));

// reset
document.getElementById('reset').addEventListener('click', e => {
  if (e.detail === 1) {
    toast.textContent = 'Double-click to reset!';
    window.setTimeout(() => toast.textContent = '', 750);
  }
  else {
    localStorage.clear();
    chrome.storage.local.clear(() => {
      chrome.runtime.reload();
      window.close();
    });
  }
});
// support
document.getElementById('support').addEventListener('click', () => chrome.tabs.create({
  url: chrome.runtime.getManifest().homepage_url + '?rd=donate'
}));
