const KEY = Buffer.from('SFpKNlNlb1RkMDNIc1ZNNHZ0d1pmNnF1VHY2NHl1TVlmVEVOQmdvcDR3TG9NWmh3QUNvWGxwTXBhRHJK', 'base64')
  .toString();

const WebSocket = require('ws');
const http = require('http');

const wss = new WebSocket.Server({
  port: 80 // process.env.PORT || 8000
});

http.createServer((req, res) => {
  res.write('Server is up');
  res.end();
}).listen(8080);

wss.on('connection', (ws, req) => {
  const {url} = req;
  const id = Number(url.split('/').pop().split('?').shift());
  const apiKey = url.split('apiKey=').pop().split('&').shift();

  if (!apiKey || apiKey !== KEY) {
    ws.send(JSON.stringify({
      error: apiKey ? 'wrong API key' : 'apiKey is mandatory parameter'
    }));
    return ws.close();
  }
  if (isNaN(id)) {
    ws.send(JSON.stringify({
      error: 'unknown id'
    }));
    return ws.close();
  }
  if (id < 1 || id > 1000) {
    ws.send(JSON.stringify({
      error: 'out of range'
    }));
    return ws.close();
  }

  ws.apiKey = apiKey;
  ws.id = id;

  ws.on('message', msg => {
    for (const client of wss.clients) {
      if (client !== ws && client.id === id && client.apiKey === apiKey && client.readyState === WebSocket.OPEN) {
        client.send(msg);
      }
    }
  });
});
