const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({length:5}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

io.on('connection', (socket) => {
  console.log('Conectado:', socket.id);

  socket.on('createRoom', () => {
    const code = generateCode();
    rooms.set(code, {p1: socket.id, p2: null});
    socket.join(code);
    socket.emit('roomCreated', code);
    console.log(`Sala ${code} criada`);
  });

  socket.on('joinRoom', (code) => {
    code = code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('error', 'Sala não existe');
    if (room.p2) return socket.emit('error', 'Sala cheia');

    room.p2 = socket.id;
    socket.join(code);
    io.to(code).emit('startGame', {p1Id: room.p1, p2Id: room.p2});
    io.to(code).emit('startCountdown');
    console.log(`Jogo iniciado em ${code}`);
  });

  socket.on('playerState', (data) => {
    const roomName = Array.from(socket.rooms).find(r => r !== socket.id);
    if (roomName) socket.to(roomName).emit('opponentState', data);
  });

  socket.on('disconnect', () => {
    for (const [code, room] of rooms.entries()) {
      if (room.p1 === socket.id || room.p2 === socket.id) {
        io.to(code).emit('opponentLeft');
        rooms.delete(code);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor em ${PORT}`));
