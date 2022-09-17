'use strict';

{
  const once = () => chrome.storage.local.get({
    media: {
      audio: true,
      video: true
    }
  }, prefs => {
    chrome.contextMenus.create({
      id: 'media',
      title: 'Media',
      contexts: ['action']
    });
    chrome.contextMenus.create({
      id: 'media.video.audio',
      title: 'Use Camera and Microphone',
      parentId: 'media',
      contexts: ['action'],
      type: 'radio',
      checked: prefs.media.video && prefs.media.audio
    });
    chrome.contextMenus.create({
      id: 'media.video',
      title: 'Use Camera Only',
      parentId: 'media',
      contexts: ['action'],
      type: 'radio',
      checked: prefs.media.video && prefs.media.audio === false
    });
    chrome.contextMenus.create({
      id: 'media.audio',
      title: 'Use Microphone Only',
      parentId: 'media',
      contexts: ['action'],
      type: 'radio',
      checked: prefs.media.audio && prefs.media.video === false
    });
  });

  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}
chrome.contextMenus.onClicked.addListener(info => chrome.storage.local.set({
  media: {
    video: info.menuItemId.includes('video'),
    audio: info.menuItemId.includes('audio')
  }
}));

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({
    url: 'data/window/index.html'
  });
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install'
            });
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
