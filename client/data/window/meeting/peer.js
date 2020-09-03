'use strict';

const KEY = 'SFpKNlNlb1RkMDNIc1ZNNHZ0d1pmNnF1VHY2NHl1TVlmVEVOQmdvcDR3TG9NWmh3QUNvWGxwTXBhRHJK';
// const ORIGIN = 'wss://connect.websocket.in/v3/[CHANNEL_ID]?apiKey=[API_KEY]';
// const ORIGIN = 'wss://meeting-server.herokuapp.com/[CHANNEL_ID]?apiKey=[API_KEY]';
// const ORIGIN = 'ws://127.0.0.1:8000/[CHANNEL_ID]?apiKey=[API_KEY]';
const ORIGIN = 'wss://meetingserver.eu.openode.io/[CHANNEL_ID]?apiKey=[API_KEY]';
const GUID = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
  (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
);

class Socket {
  constructor(origin, key) {
    this.key = key || atob(KEY);
    this.server = (origin || ORIGIN).replace('[API_KEY]', this.key);
    this.onConnectionStateChanged = new Event();
    this.onMessage = new Event();
  }
  create(cid = 1) {
    if (cid < 1 || cid > 10000) {
      throw Error('range limit');
    }
    this.cid = cid;

    return new Promise((resolve, reject) => {
      const socket = this.socket = new WebSocket(this.server.replace('[CHANNEL_ID]', cid));
      socket.onopen = () => {
        setTimeout(() => {
          if (socket.readyState === 1) {
            resolve();
            this.onConnectionStateChanged.emit('socket', 'ready');
          }
          else {
            reject(Error('connection closed'));
            this.onConnectionStateChanged.emit('socket', 'closed');
          }
        }, 500);
      };
      socket.onclose = () => {
        reject(Error('connection closed'));
        this.onConnectionStateChanged.emit('socket', 'closed');
      };
      socket.onmessage = e => {
        this.decrypt(e.data).then(msg => {
          msg = JSON.parse(msg);
          if ('recipient' in msg) {
            if (msg.recipient === GUID) {
              this.onMessage.emit(msg);
            }
          }
          else {
            this.onMessage.emit(msg);
          }
        }).catch(() => {
          try {
            const j = JSON.parse(e.data);
            if (j.error) {
              alert(j.error);
            }
            else {
              throw Error('message is not encrypted');
            }
          }
          catch (e) {
            console.warn('cannot decrypt the encrypted message');
          }
        });
      };
    });
  }
  encrypt(msg) {
    return Promise.resolve(msg);
  }
  decrypt(msg) {
    return Promise.resolve(msg);
  }
  send(msg, recipient) {
    const o = {
      ...msg,
      sender: GUID
    };
    if (recipient) {
      o.recipient = recipient;
    }
    this.encrypt(JSON.stringify(o)).then(e => this.socket.send(e));
  }
  close() {
    try {
      this.socket.close();
    }
    catch (e) {}
  }
  restart() {
    this.close();
    this.create(this.cid);
  }
}

class Peer {
  constructor(socket, configuration, recipient) {
    const pc = this.pc = new RTCPeerConnection(configuration);

    this.recipient = recipient;

    this.onConnectionStateChanged = new Event();
    pc.onconnectionstatechange = () => this.onConnectionStateChanged.emit('peer', pc.connectionState);

    let cid; // send multiple candidates in one request
    const candidates = [];
    pc.onicecandidate = ({candidate}) => {
      if (candidate) {
        this.onConnectionStateChanged.emit('candidate', 'generated');
        clearTimeout(cid);
        cid = setTimeout(() => {
          socket.send({candidates}, recipient);
        }, 500);
        candidates.push(candidate);
      }
    };
    this.socket = socket;
    socket.onMessage.addListener(msg => this.parse(msg));

    // track
    this.onTrack = new Event();
    pc.ontrack = e => this.onTrack.emit(e.streams[0]);

    // channel
    this.onMessage = new Event();
    this.channels = {};
    pc.ondatachannel = e => {
      const ch = e.channel;
      this.channel(ch.label, ch);
    };
  }
  // process messages from the other end
  async parse(msg) {
    // all new client peers receive messages from any recipient. Only accept from recipient
    if (msg.sender !== this.recipient) {
      // console.log('ignored', msg, msg.sender, this.recipient);
      return;
    }
    const {desc, candidates} = msg;
    const {socket, pc} = this;
    if (candidates) {
      for (const candidate of candidates) {
        pc.addIceCandidate(candidate);
      }
    }
    else if (desc && desc.type === 'answer') { // server-side
      this.onConnectionStateChanged.emit('desc', 'received');
      pc.setRemoteDescription(desc);
    }
    else if (desc && desc.type === 'offer') { // client-side
      this.onConnectionStateChanged.emit('desc', 'received');
      await pc.setRemoteDescription(desc);
      const answer = await pc.createAnswer();

      await pc.setLocalDescription(answer);
      socket.send({desc: answer}, this.recipient);
    }
  }
  send(msg, name = 'json') {
    try {
      this.channels[name].send(JSON.stringify(msg));
    }
    catch (e) {}
  }
  // create offer (server-side)
  async offer() {
    const {socket, pc} = this;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    socket.send({desc: pc.localDescription}, this.recipient);
  }
  // channel
  channel(name = 'json', ch) {
    ch = ch || this.pc.createDataChannel(name);
    ch.onmessage = e => this.onMessage.emit(JSON.parse(e.data));
    ch.onopen = () => this.onConnectionStateChanged.emit('channel', 'ready');
    ch.onclose = () => this.onConnectionStateChanged.emit('channel', 'closed');
    this.channels[ch.label] = ch;
  }
  // close
  close() {
    const {pc} = this;
    pc.close();
    this.onConnectionStateChanged.emit('channel', 'closed');
  }
}
