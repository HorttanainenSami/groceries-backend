import { app } from './app';
import http from 'http';
import { Server } from 'socket.io';
import { decodeToken } from './resources/utils';
import jwt from 'jsonwebtoken';
import {
  TokenDecoded
} from '@groceries/shared_types';
import {taskHandlers} from './modules/tasks/tasks.socket';
const server = http.createServer(app);
const io = new Server(server);
const wlog = '*************WEBSOCKET***********';

//auth middleware
io.of('/user').use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log(wlog, 'Middleware: No token provided.');
    return next(new Error('Invalid token: No token provided'));
  }
  try {
    jwt.verify(token, process.env.SECRET || '');
    const decodedToken= decodeToken<TokenDecoded>(token);
    socket.data.user_id= decodedToken.id;
    socket.data.email = decodedToken.email;
    next();
  } catch (error) {
    console.error(wlog, 'Middleware: Invalid token.', error);
    socket.disconnect(true);
    socket.emit('error', { message: 'Invalid token' });

  }
});


io.of('/user').on('connection', (socket) => {
  socket.join(socket.data.user_id);
  io.of('/user').adapter.on('join-room', (room, id) => {
    console.log(`socket ${id} has joined room ${room}`);
  });
  io.of('/user').adapter.on('leave-room', (room, id) => {
    console.log(`socket ${id} has left room ${room}`);
  });
  taskHandlers(io, socket);
  
  socket.on('disconnect', (reason) => {
    console.log(wlog + 'user disconnected', reason);
  });
  socket.on('error', (error) => {
    console.error(wlog + 'Socket error:', error);
  });
});

const port = 3003;

server.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
