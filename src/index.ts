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
  UserType,
} from '@groceries/shared_types';
import { taskSocketHandlers } from './modules/tasks/tasks.socket';
import { relationsSocketHandler } from './modules/relations/relations.socket';
import { getCollaborators } from './modules/relations/relations.service';
import { JsonWebTokenError } from './middleware/Error.types';

const server = http.createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
  server
);
const wlog = '*************WEBSOCKET***********';

//auth middleware
io.of('/user').use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log(wlog, 'Middleware: No token provided.');
    return next(new JsonWebTokenError('Invalid token: No token provided'));
  }
  try {
    if (!process.env.SECRET) {
      throw new Error('No SECRET property in .env file');
    }
    jwt.verify(token, process.env.SECRET);
    const decodedToken = decodeToken<TokenDecoded>(token);
    socket.data.id = decodedToken.id;
    socket.data.email = decodedToken.email;
    next();
  } catch (error) {
    console.error(wlog, 'Middleware: Invalid token.', error);
    socket.disconnect(true);
    return next(new Error('Invalid token'));
  }
});

const onConnection = (socket: SocketType) => {
  taskSocketHandlers(io, socket);
  relationsSocketHandler(io, socket);
};

io.of('/user').on('connection', onConnection);

export const notifyCollaborators = async <E extends keyof ServerToClientEvents>(
  relationId: string,
  currentUserId: string,
  eventName: E,
  data: Parameters<ServerToClientEvents[E]>[0],
  providedCollaborators?: Omit<UserType, 'password'>[]
) => {
  const collaborators =
    providedCollaborators ?? (await getCollaborators({ id: currentUserId }, { id: relationId }));
  collaborators.forEach(({ id }) => {
    (io.of('/user').to(id).emit as (ev: string, ...args: unknown[]) => void)(eventName, data);
  });
};

const port = 3003;
if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => {
    return console.log(`Express is listening at http://localhost:${port}`);
  });
}
