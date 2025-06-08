import { app } from './app';
import http from 'http';
import { Server } from 'socket.io';
import { decodeToken } from './resources/utils';
import { TokenDecoded } from './types';
import {
  baseTaskSchema,
  editTaskSchema,
  TaskType,
} from './modules/relations/relations.schema';
import {
  editTaskBy,
  getRelationsById,
  postTaskToRelation,
  removeTaskFromRelation,
} from './modules/relations/relations.controller';

const server = http.createServer(app);
const io = new Server(server);
const wlog = '*************WEBSOCKET***********';

io.of('/user').on('connection', (socket) => {
  console.log(wlog, 'a user tries to connect');
  let user_id: string;
  const token = socket.handshake.auth.token;
  if (!token) {
    console.log(wlog + 'No token provided, disconnecting');
    socket.disconnect();
    return;
  }
  try {
    const decodedToken = decodeToken<TokenDecoded>(token);
    console.log(wlog + 'User token:', decodedToken);
    user_id = decodedToken.id;
  } catch (error) {
    console.error(wlog + 'Invalid token:', error);
    socket.disconnect();
    return;
  }
  socket.join(user_id);
  io.of('/user').adapter.on('join-room', (room, id) => {
    console.log(`socket ${id} has joined room ${room}`);
  });
  io.of('/user').adapter.on('leave-room', (room, id) => {
    console.log(`socket ${id} has joined room ${room}`);
  });
 
  socket.on('task:join', async (relation_id: string) => {
    console.log(wlog + 'User joining relation:', relation_id);
    console.log('clients', io.engine.clientsCount);
    const relation = await getRelationsById(user_id, relation_id);
    if (!relation) {
      throw new Error('Relation not found');
    }
    socket.join(relation.id);
    io.of('/user').to(user_id).emit('task:join:success', relation);
  });
  socket.on('task:create', async (data: TaskType) => {
    try {
      console.log(wlog + 'Create task:', data);
      const parsedTask = baseTaskSchema.omit({ id: true }).parse(data);
      const sql_data = await postTaskToRelation(user_id, parsedTask);
      console.log(wlog + 'Task created:', sql_data);

      io.of('/user').to(data.task_relations_id).emit('task:created', sql_data);
    } catch (error) {
      console.error(wlog + 'Error creating task:', error);
      socket.emit('error', { message: 'Failed to create task' });
    }
  });

  socket.on('task:edit', async (data: TaskType) => {
    try {
      console.log(wlog + 'Edit task:', JSON.stringify(data, null, 2));
      const parsedTask = editTaskSchema.parse(data);
      console.log(wlog + 'Parsed task:', parsedTask);
      const sql_data = await editTaskBy(
        user_id,
        parsedTask.task_relations_id,
        parsedTask.id,
        parsedTask
      );
      console.log(wlog + 'Task edited:', sql_data);
      io.of('/user').to(data.task_relations_id).emit('task:edited', sql_data);
    } catch (error) {
      console.error(wlog + 'Error editing task:', error);
      socket.emit('error', { message: 'Failed to edit task' });
    }
  });

  socket.on('task:remove', async (data: TaskType[]) => {
    try {
      console.log(wlog + 'Remove task:', data);
      const parsedTask = baseTaskSchema.array().parse(data);
      const sql_data = await Promise.all(parsedTask.map(t => (removeTaskFromRelation(
        user_id,
        t.task_relations_id,
        t.id,
      ))));
      console.log(data[0].task_relations_id, 'sql_data', sql_data);
      console.log(wlog + 'Task removed:', sql_data);
      io.of('/user').to(data[0].task_relations_id).emit('task:removed', sql_data);
    } catch (error) {
      console.error(wlog + 'Error toggling task:', error);
      socket.emit('error', { message: 'Failed to toggle task' });
    }
  });

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
