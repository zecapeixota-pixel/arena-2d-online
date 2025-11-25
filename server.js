const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Sistema de salas (igual ao que mandei antes)
const rooms = new Map();
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = '';
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  } while (rooms.has(code));
  return code;
}

io.on('connection', socket => {
  console.log('Jogador conectado:', socket.id);

  socket.on('createRoom', () => {
    const code = generateCode();
    rooms.set(code, { players: [socket.id], p1: null, p2: null, gameData: null });
    socket.join(code);
    socket.emit('roomCreated', code);
  });

  socket.on('joinRoom', (code) => {
    code = code.toUpperCase();
    const room = rooms.get(code);
    if (!room) return socket.emit('error', 'Sala não existe');
    if (room.players.length >= 2) return socket.emit('error', 'Sala cheia');
    
    room.players.push(socket.id);
    socket.join(code);
    
    if (room.players.length === 1) {
      room.p1 = socket.id;
      socket.emit('waiting');
    } else {
      room.p2 = socket.id;
      io.to(code).emit('startGame', { p1: room.p1, p2: room.p2 });
    }
  });

  socket.on('playerInput', (data) => {
    socket.to(Array.from(socket.rooms)[1]).emit('opponentInput', data);
  });

  socket.on('disconnect', () => {
    for (const [code, room] of rooms) {
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(code).emit('opponentLeft');
        if (room.players.length === 0) rooms.delete(code);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
