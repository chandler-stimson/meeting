/* global Peer, Socket, safe */
'use strict';

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
  },
  timeout: {
    peer: 10000,
    resize: 1000
  }
};

const COMMON = Symbol('common');
const INCLUDE = Symbol('include');

class Meeting {
  constructor(orign, key) {
    const socket = this.socket = new class extends Socket {
      encrypt(msg) {
        return safe.encrypt(msg);
      }
      decrypt(msg) {
        return safe.decrypt(msg);
      }
    }(orign, key);
    socket.onMessage.addListener(msg => {
      if (msg.method === 'whoami') {
        this.client(msg.sender).then(peer => {
          peer.extra = msg.extra;
          this[INCLUDE](msg.sender, peer);
          socket.send({
            method: 'whoami-reply',
            extra: this.exta
          }, msg.sender);
        });
      }
      else if (msg.method === 'whoami-reply') {
        this.server(msg.sender).then(peer => {
          peer.extra = msg.extra;
          this[INCLUDE](msg.sender, peer);
          peer.offer();
        });
      }
    });

    this.videos = {};
    this.onVideoRequest = new Event();

    this.peers = {};
    this.onMessage = new Event();

    this.onConnectionStateChanged = new Event();
    socket.onConnectionStateChanged.addListener((type, state) => {
      this.onConnectionStateChanged.emit(type, state);
    });

    // count
    this.onCountChanged = new Event();
  }
  get count() {
    return this._count || 1;
  }
  set count(v) {
    this._count = v;
    this.onCountChanged.emit(v);
  }
  [COMMON](stream, recipient) {
    const p = new Peer(this.socket, configuration.server, recipient);

    let video;
    // add track
    p.onTrack.addListener(stream => {
      if (!video) {
        const tid = setTimeout(() => {
          console.warn('no signal is received from the peer', 'closing peer connection');
          this.onMessage.emit(recipient, {
            message: 'No signal is received'
          });
          p.close();
        }, configuration.timeout.peer);
        video = document.createElement('video');
        video.onloadedmetadata = () => {
          video.play();
          clearTimeout(tid);
        };
        this.onVideoRequest.emit(video, p);
        this.videos[recipient] = video;
        this.count += 1;

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
          send.id = setTimeout(send, configuration.timeout.resize, e);
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
      this.onMessage.emit(recipient, request);

      if (request.method === 'video-constrain') {
        const [vst] = stream.getVideoTracks();
        vst.applyConstraints(request.value);
      }
      else if (request.method === 'socket-restart') {
        this.socket.restart();
      }
    });

    return p;
  }

  async server(recipient) {
    const stream = await navigator.mediaDevices.getUserMedia(configuration.media);
    const p = this[COMMON](stream, recipient);
    p.channel();

    return p;
  }
  async client(recipient) {
    const stream = await navigator.mediaDevices.getUserMedia(configuration.media);
    return this[COMMON](stream, recipient);
  }
  password(v) {
    return safe.password(v);
  }

  /* include new peer */
  [INCLUDE](guid, p) {
    this.peers[guid] = p;
    p.onConnectionStateChanged.addListener((type, state) => {
      if (
        (type === 'channel' && state === 'closed') ||
        (type === 'peer' && (state === 'disconnected' || state === 'failed'))
      ) {
        const v = this.videos[guid];
        if (v) {
          v.remove();
          delete this.videos[guid];
          this.count -= 1;
        }
        delete this.peers[guid];
      }
      this.onConnectionStateChanged.emit(type, state);
    });
  }

  join(cid, extra = {}) {
    this.exta = extra;
    return this.socket.create(cid).then(() => this.socket.send({
      method: 'whoami',
      extra
    }));
  }

  send(o) {
    for (const peer of Object.values(this.peers)) {
      peer.send(o);
    }
  }
}
