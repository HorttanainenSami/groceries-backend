import { getAllRelations, getRelationWithTasks } from './relations.service';
import { create_and_share_relations } from './relations.controller';
import {
  postRelationAndShareWithUserRequestSchema,
  ServerType,
  SocketType,
} from '@groceries/shared_types';
import { handleSocketError } from '../../middleware/ErrorHandler';

export const relationsSocketHandler = (io: ServerType, socket: SocketType) => {
  const user_id = socket.data.id;

  socket.join(user_id);

  socket.on('relations:get_relations', async (callback) => {
    try {
      const relations = await getAllRelations({ id: user_id });
      callback({ success: true, data: relations });
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const response = handleSocketError(error);
      callback(response);
    }
  });

  socket.on('relations:share', async (payload, callback) => {
    try {
      console.log(JSON.stringify(payload, null, 2));
      const { task_relations, user_shared_with } =
        postRelationAndShareWithUserRequestSchema.parse(payload);
      const response = await create_and_share_relations({
        relationsWithTasks: task_relations,
        userSharedWith: user_shared_with,
        id: user_id,
      });
      callback({ success: true, data: response });
      const returnToShared = await Promise.all(
        response.map((r) => getRelationWithTasks({ id: r.id }, { id: user_shared_with }))
      );
      io.of('/user').to(user_shared_with).emit('relations:share', returnToShared);
    } catch (e) {
      console.log(e);
      const error = e instanceof Error ? e : new Error(String(e));
      const response = handleSocketError(error);
      callback(response);
    }
  });

  socket.on('disconnect', (reason) => {
    console.error(`User ${socket.data.email} disconnected:`, reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
};
