const WebSocket = require('ws')
const fs = require('fs');
let trackIndex = 0
let trackArray

let timerDefault = 600
let warningTimerDefault = 20

let timer = timerDefault
let warningTimer = warningTimerDefault

const wss = new WebSocket.Server({ port: 8080 })
let ws
let players = []
let currentID = 1

fs.readdir('./tracks/', (err, files) => {
  trackArray = files
  shuffle(trackArray);
});

wss.on('connection', (socket, req) => {
  ws = socket
  ws.binaryType = 'arraybuffer'
  ws.on('message', function message(data, isBinary) {
    if (isBinary == true) {
      // Nothing to see here...
    } else {
      const message = isBinary ? data : data.toString();
      var responseJSON = JSON.parse(message)
      // if (responseJSON.hasOwnProperty('username')) {
      if (Object.keys(responseJSON)[0] == 'username') {
        responseJSON.username = responseJSON.username.replaceAll('"', '')
        responseJSON.username = responseJSON.username.replaceAll('{', '')
        responseJSON.username = responseJSON.username.replaceAll('}', '')
        responseJSON.username = responseJSON.username.replaceAll('`', '')
        responseJSON.username = responseJSON.username.replaceAll(`'`, '')
        if (responseJSON.username.length > 32 || responseJSON.username.length < 1) {
          ws.close()
          return
        }
        ws.send(`{ "ID" : "${currentID}"}`)
        players.push({username : responseJSON.username, time : 999999, IP : req.socket.remoteAddress, ID : currentID})
        currentID = currentID + 1
        sendTrack(ws)
        updateLeaderboard()
        console.log(`User ${responseJSON.username} has connected`)
      }
      if (Object.keys(responseJSON)[0] == 'replay') {
        if (warningInterval) return
        /* var buffer = Buffer.from(responseJSON.replay, 'base64'); // Ta-da
        var view = new Uint8Array(buffer)
        var dec1 = view[25]
        var dec2 = view[24]
        var timeWord = `${("00000000"+dec1.toString(2)).slice(-8)}${("00000000"+dec2.toString(2)).slice(-8)}`
        var time = parseInt(timeWord, 2);
        var matches = players.filter(obj => {
          return obj.username === responseJSON.username
        })
        matches.forEach(function (currentValue, index, arr){
          if (currentValue.IP == req.socket.remoteAddress) {
            if (currentValue.ID == responseJSON.ID) {
              if (currentValue.time > time) {
                currentValue.time = time
              }
            }
          }
        }) */
        var buffer = Buffer.from(responseJSON.replay, 'base64'); // Ta-da
        var view = new Uint8Array(buffer)
        var dec1 = view[51]
        var dec2 = view[50]
        let timeHundredths = dec1 * 1280 + dec2 * 5
        let time = timeHundredths * 10
        var matches = players.filter(obj => {
          return obj.username === responseJSON.username
        })
        matches.forEach(function (currentValue, index, arr){
          if (currentValue.IP == req.socket.remoteAddress) {
            if (currentValue.ID == responseJSON.ID) {
              if (currentValue.time > time) {
                currentValue.time = time
                console.log(`User ${responseJSON.username}'s new best time is ${time}`)
              }
            }
          }
        })
        updateLeaderboard()
      }
      if (Object.keys(responseJSON)[0] == 'disconnect') {
        var matches = players.filter(obj => {
          return obj.username === responseJSON.username
        })
        matches.forEach(function (currentValue, index, arr){
          if (currentValue.IP == req.socket.remoteAddress) {
            if (currentValue.ID == responseJSON.ID) {
              players.splice(players.indexOf(currentValue), 1)
              console.log(`User ${responseJSON.username} has disconnected`)
            }
          }
        })
        updateLeaderboard()
      }
    }
    // Continue as before.
  });

  ws.on('close', function() {
    // Code here
  })
})

wss.broadcast = function(broadcastMessage) {
  wss.clients.forEach(client => client.send(broadcastMessage));
};

function str2ab(str) {
    var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
    var bufView = new Uint16Array(buf);
    for (var i=0, strLen=str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

function updateLeaderboard() {
  players.sort(function (a, b) {
    return a.time - b.time;
  });
  var playersForClient = players.map(({ IP, ...item }) => item);
  wss.broadcast(`{"leaderboard" : ${JSON.stringify(playersForClient)}}`)
}

function dec2bin(dec) {
  return (dec >>> 0).toString(2);
}

function _base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}

// Sends current track as Uint8Array ArrayBuffer to client
function sendTrack() {
  let trackBase64 = fs.readFileSync(`./tracks/${trackArray[trackIndex]}`, null).toString('base64');
  ws.send(`{ "track" : "${trackBase64}", "name" : "${trackArray[trackIndex]}" }`)
  console.log(`Sent track "${trackArray[trackIndex]}"`)
}

function broadcastTrack() {
  let trackBase64 = fs.readFileSync(`./tracks/${trackArray[trackIndex]}`, null).toString('base64');
  wss.broadcast(`{ "track" : "${trackBase64}", "name" : "${trackArray[trackIndex]}" }`)
  console.log(`Broadcasted track "${trackArray[trackIndex]}"`)
}

function sendWarning() {
  wss.broadcast(`{ "warning" : "when the imposter is sus!" }`)
}

/* function intervalFunction() {
  wss.clients.forEach(client => client.send(`{ "timer" : ${timer} }`));
  timer--
  if (timer === 0) {
    trackIndex++
    if (typeof trackArray[trackIndex] == 'undefined') {
      trackIndex = 0
    }
    sendTrack()
    players.forEach(function (element, index) {
      element.time = 999999
    })
    updateLeaderboard()
    timer = 420
  }
} */

function intervalFunction() {
  if (timer < 0) {
    if (warningTimer < 0) {
      clearInterval(warningInterval)
      warningInterval = null
      warningTimer = warningTimerDefault
      trackIndex++
      if (typeof trackArray[trackIndex] == 'undefined') {
        trackIndex = 0
      }
      broadcastTrack()
      players.forEach(function (element, index) {
        element.time = 999999
      })
      updateLeaderboard()
      timer = timerDefault
    } else {
      if (!warningInterval) {
        sendWarning()
        warningInterval = setInterval(warningIntervalFunction, 1000)
      }
    }
  }
  if (!warningInterval) {
    wss.clients.forEach(client => client.send(`{ "timer" : ${timer} }`));
    timer--
  }
}

function warningIntervalFunction() {
  wss.clients.forEach(client => client.send(`{ "timer" : ${warningTimer} }`));
  warningTimer--
}

let interval = setInterval(intervalFunction, 1000)
let warningInterval