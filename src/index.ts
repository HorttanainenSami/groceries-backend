import { app } from './app';
import http from 'http';
import { Server } from 'socket.io';
import { decodeToken } from './resources/utils';
import jwt from 'jsonwebtoken';
import {
  SocketType,
  ClientToServerEvents, 
  ServerToClientEvents, 
  InterServerEvents, 
  SocketData,
  TokenDecoded,
  UserType
} from '@groceries/shared_types';
import {taskSocketHandlers} from './modules/tasks/tasks.socket';
import { relationsSocketHandler } from './modules/relations/relations.socket';
import { getCollaborators } from './modules/relations/relations.service';

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(server);
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
    socket.data.id= decodedToken.id;
    socket.data.email = decodedToken.email;
    next();
  } catch (error) {
    console.error(wlog, 'Middleware: Invalid token.', error);
    socket.emit('error', { message: 'Invalid token' });
    socket.disconnect(true);

  }
});

const onConnection = (socket: SocketType) => {
  taskSocketHandlers(io, socket);
  relationsSocketHandler(io, socket);
}

io.of('/user').on('connection', onConnection);

const port = 3003;

server.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});

export const notifyCollaborators = async (
  relationId: string,
  currentUserId: string,
  eventName: keyof ServerToClientEvents,
  data: any
) => {
  const collaborators = await getCollaborators({id: relationId});

  collaborators
    .filter(({id}) => id !== currentUserId)
    .forEach(({id}) => {
      io.of('/user').to(id).emit(eventName, data);
    });
};