/* global Peer, Socket, safe */
'use strict';

const args = new URLSearchParams(location.search);

const configuration = {
  server: {
    iceServers: [{
      'urls': [
        'stun:stun.services.mozilla.com',
        'stun:stun.l.google.com:19302',
        'stun:stun.mit.de:3478',
        'stun:stun.gmx.net:3478'
      ]
    }]
  },
  media: {
    audio: true,
    video: true
  }
};

const videos = {};

const peer = {
  _count: 1,
  get count() {
    return peer._count;
  },
  set count(v) {
    peer._count = v;
    document.body.dataset.count = v;
  },
  common(stream, socket, recipient) {
    const p = new Peer(socket, configuration.server, recipient);

    let video;
    // add track
    p.onTrack.addListener(stream => {
      if (!video) {
        const tid = setTimeout(() => {
          console.warn('no signal is sent from the peer', 'closing peer connection');
          p.close();
        }, 5000);
        video = document.createElement('video');
        video.onloadedmetadata = () => {
          video.play();
          clearTimeout(tid);
        };
        document.getElementById('meeting').appendChild(video);
        peer.count += 1;
        videos[recipient] = video;

        // monitor video element size changes
        const send = e => {
          const width = Math.min(600, e.contentRect.width);
          const height = width * (e.contentRect.height / e.contentRect.width);
          p.send({
            method: 'video-constrain',
            value: {
              width: {
                max: width
              },
              height: {
                max: height
              },
              frameRate: {
                max: 30
              }
            }
          });
        };
        const resizeObserver = new ResizeObserver(([e]) => {
          clearTimeout(send.id);
          send.id = setTimeout(send, 1000, e);
        });
        resizeObserver.observe(video);
      }

      // don't set srcObject again if it is already set.
      if (video.srcObject) {
        return;
      }
      video.srcObject = stream;
    });
    stream.getTracks().forEach(track => p.pc.addTrack(track, stream));

    p.onMessage.addListener(request => {
      console.log(request);
      if (request.method === 'video-constrain') {
        const [vst] = stream.getVideoTracks();
        vst.applyConstraints(request.value);
      }
      else if (request.method === 'socket-restart') {
        socket.restart();
      }
      else if (request.method === 'socket-close') {
        socket.close();
      }
    });

    return p;
  },
  client(...args) {
    const peer = this.common(...args);

    return peer;
  },
  server(...args) {
    const peer = this.common(...args);
    peer.channel();

    return peer;
  },
  async start(mode = 'server', socket, configuration, recipient) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia(configuration);
      if (mode === 'server') {
        return peer.server(stream, socket, recipient);
      }
      else {
        return peer.client(stream, socket, recipient);
      }
    }
    catch (e) {
      console.error(e);
    }
  }
};

const socket = new class extends Socket {
  encrypt(msg) {
    return safe.encrypt(msg);
  }
  decrypt(msg) {
    return safe.decrypt(msg);
  }
};
const peers = {};
const add = (guid, p) => {
  peers[guid] = p;
  p.onConnectionStateChanged.addListener((type, state) => {
    console.log(type, state);
    if ((type === 'channel' && state === 'closed') || (type === 'peer' && (state === 'disconnected' || state === 'failed'))) {
      const v = videos[guid];
      if (v) {
        v.remove();
        delete videos[guid];
        peer.count -= 1;
      }
      delete peers[guid];
    }
  });
};

socket.onMessage.addListener(msg => {
  if (msg.method === 'whoami') {
    peer.start('client', socket, configuration.media, msg.sender).then(peer => {
      add(msg.sender, peer);

      socket.send({
        method: 'whoami-reply'
      }, msg.sender);
    });
  }
  else if (msg.method === 'whoami-reply') {
    peer.start('server', socket, configuration.media, msg.sender).then(peer => {
      add(msg.sender, peer);
      peer.offer();
    });
  }
});

document.getElementById('join').addEventListener('submit', async e => {
  e.preventDefault();
  const join = e.target.querySelector('input[type=submit]');
  join.value = 'connecting...';
  document.title = 'Connecting to Server...';
  join.disabled = true;
  const cid = e.target.querySelector('input[type=number]').value;
  const password = e.target.querySelector('input[type=password]').value;
  await safe.password(password);

  socket.create(cid).then(async () => {
    socket.send({
      method: 'whoami'
    });
    document.title = 'Joined to the Meeting';
    return navigator.mediaDevices.getUserMedia(configuration.media).then(stream => {
      document.body.dataset.mode = 'joined';
      const me = document.getElementById('me');
      me.onloadedmetadata = () => me.play();
      me.srcObject = stream;
    });
  }).catch(e => {
    document.title = 'Meeting';
    join.value = 'Join';
    join.disabled = false;
    alert(e.message);
  });
});

// auto-fill
if (args.has('channel-id')) {
  document.querySelector('#join [name=channel-id]').value = args.get('channel-id');
  document.querySelector('#join [type=password]').focus();
}

// allow or block joining
document.getElementById('socket').addEventListener('change', e => {
  socket[e.target.checked ? 'restart' : 'close']();
  console.log(e.target.checked);
  if (e.target.checked) {
    for (const peer of Object.values(peers)) {
      console.log(peer);
      peer.send({
        method: 'socket-restart'
      });
    }
  }
});
socket.onConnectionStateChanged.addListener((name, state) => {
  console.log(name, state);
  const e = document.querySelector('#socket input');
  if (state === 'closed') {
    e.checked = false;
  }
  else {
    e.checked = true;
  }
});
