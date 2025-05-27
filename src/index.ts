import { app } from './app';
import http from 'http';
import { Server } from 'socket.io';
import { decodeToken } from './resources/utils';
import { TokenDecoded } from './types';
import { baseTaskSchema, TaskType } from './modules/relations/relations.schema';
import {
  editTaskBy,
  postTaskToRelation,
  removeTaskFromRelation,
} from './modules/relations/relations.controller';
import { create } from 'domain';

const server = http.createServer(app);
let user_id: string;
const io = new Server(server);
const wlog = '*************WEBSOCKET***********';
io.of('/relation').on('connection', (socket) => {
  console.log(wlog, 'a user connected');
  const token = socket.handshake.auth.token;
  const relation_id = socket.handshake.auth.relation_id;
  if (!token || !relation_id) {
    console.log(wlog + 'No token/relation_id provided, disconnecting');
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
  //here we determine what relation user subscribes to
  console.log(wlog + 'Relation ID:', relation_id);
  socket.join(relation_id);

  socket.on('createTask', async (data: TaskType) => {
    try {
      console.log(wlog + 'Create task:', data);
      const parsedTask = baseTaskSchema.omit({ id: true }).parse(data);
      const sql_data = await postTaskToRelation(user_id, parsedTask);
      console.log(wlog + 'Task created:', sql_data);

      io.of('/relation').to(relation_id).emit('taskCreated', sql_data);
    } catch (error) {
      console.error(wlog + 'Error creating task:', error);
      socket.emit('error', { message: 'Failed to create task' });
    }
  });
  socket.on('editTask', async (data: any) => {
    try {
      console.log(wlog + 'Edit task:', JSON.stringify(data, null, 2));
      const parsedTask = baseTaskSchema.parse(data);
      const sql_data = await editTaskBy(
        user_id,
        parsedTask.task_relations_id,
        data.id,
        data
      );
      console.log(wlog + 'Task edited:', sql_data);
      io.of('/relation').to(relation_id).emit('taskEdited', sql_data);
    } catch (error) {
      console.error(wlog + 'Error editing task:', error);
      socket.emit('error', { message: 'Failed to edit task' });
    }
  });
  socket.on('removeTask', async (data: TaskType[]) => {
    try {
      console.log(wlog + 'Remove task:', data);
      const parsedTask = baseTaskSchema.array().parse(data);
      const sql_data = await Promise.all(parsedTask.map(t => (removeTaskFromRelation(
        user_id,
        t.task_relations_id,
        t.id,
      ))));
      console.log(wlog + 'Task removed:', sql_data);
      io.of('/relation').to(relation_id).emit('tasksRemoved', sql_data);
    } catch (error) {
      console.error(wlog + 'Error toggling task:', error);
      socket.emit('error', { message: 'Failed to toggle task' });
    }
  });

  socket.on('disconnect', () => {
    console.log(wlog + 'user disconnected');
  });
});

const port = 3003;

server.listen(port, () => {
  return console.log(`Express is listening at http://localhost:${port}`);
});
