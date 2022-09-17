/* global Meeting, configuration, Notify */

'use strict';

const args = new URLSearchParams(location.search);

let meeting;
// auto-fill
if (args.has('channel-id')) {
  document.querySelector('#join [name=channel-id]').value = args.get('channel-id');
  document.querySelector('#join [type=password]').focus();
}

chrome.storage.local.get({
  'signaling-server': '',
  'signaling-token': '',
  'media': configuration.media
}, prefs => {
  Object.assign(configuration.media, prefs.media);

  console.log(configuration.media);

  meeting = new Meeting(prefs['signaling-server'], prefs['signaling-token']);

  document.getElementById('join').addEventListener('submit', async e => {
    e.preventDefault();
    const join = e.target.querySelector('input[type=submit]');
    join.value = 'connecting...';
    document.title = 'Connecting to Server...';
    join.disabled = true;
    const cid = e.target.querySelector('input[type=number]').value;
    const password = e.target.querySelector('input[type=password]').value;
    await meeting.password(password);

    meeting.join(cid, { // extra info
      nickname: Math.random()
    }).then(() => {
      document.title = 'Joined on channel #' + cid;
      history.pushState({}, '', '?channel-id=' + cid);
      return navigator.mediaDevices.getUserMedia(configuration.media).then(stream => {
        console.log(stream);
        document.body.dataset.mode = 'joined';
        const me = document.getElementById('me');
        me.onloadedmetadata = () => me.play();
        me.srcObject = stream;
      }).catch(e => {
        throw Error('Cannot access to the user media: ' + e.message);
      });
    }).catch(e => {
      document.title = 'Meeting';
      join.value = 'Join';
      join.disabled = false;
      alert(e.message);
    });
  });

  // allow or block joining
  document.getElementById('socket').addEventListener('change', e => {
    meeting.socket[e.target.checked ? 'restart' : 'close']();
    if (e.target.checked) {
      meeting.send({
        method: 'socket-restart'
      });
    }
  });
  meeting.onConnectionStateChanged.addListener((type, state) => {
    if (type === 'socket') {
      const e = document.querySelector('#socket input');
      if (state === 'closed') {
        e.checked = false;
      }
      else {
        e.checked = true;
      }
    }
  });
  meeting.onCountChanged.addListener(count => {
    document.body.dataset.count = count;
  });
  meeting.onVideoRequest.addListener((video, peer) => {
    const view = document.createElement('video-view');
    view.setAttribute('controls', 'mute close');
    view.set(video);
    video.poster = 'assets/poster.png';
    document.getElementById('meeting').appendChild(view);
    view.onCloseRequested.addListener(() => {
      peer.close();
    });
  });

  const notify = new Notify();
  meeting.onMessage.addListener((guid, o) => {
    if ('message' in o) {
      notify.display(o.message, undefined, 5000);
    }
  });

  //
  document.getElementById('me').onCloseRequested.addListener(() => {
    location.reload();
  });
});

