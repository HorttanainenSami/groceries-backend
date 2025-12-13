import { getAllRelations } from './relations.service';
import {
  changeRelationName,
  create_and_share_relations,
  removeMultipleRelations,
  removeRelationFromServer,
} from './relations.controller';
import {
  deleteRelationParamsSchema,
  postRelationAndShareWithUserRequestSchema,
  socketRelationChangeNamePayload,
  ServerType,
  SocketType,
} from '@groceries/shared_types';
import { notifyCollaborators } from '../..';
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
  socket.on('relations:change_name', async (payload, callback) => {
    try {
      const { id, name } = socketRelationChangeNamePayload.parse(payload);
      const response = await changeRelationName(id, name, user_id);
      callback({ success: true, data: response });
      await notifyCollaborators(id, user_id, 'relations:change_name', response);
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const response = handleSocketError(error);
      callback(response);
    }
  });
  socket.on('relations:delete', async (payload, callback) => {
    try {
      const parsed = deleteRelationParamsSchema.parse(payload);
      if (Array.isArray(parsed)) {
        const res = await removeMultipleRelations({ id: user_id }, parsed);
        const ids = parsed.map((i) => i.id);
        callback({ success: true, data: res });
        await Promise.all(
          ids.map((id) => notifyCollaborators(id, user_id, 'relations:delete', res))
        );
      } else {
        const res = await removeRelationFromServer(user_id, parsed.id);

        callback({ success: true, data: [res] });
        await notifyCollaborators(parsed.id, user_id, 'relations:delete', [res]);
      }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e));
      const response = handleSocketError(error);
      callback(response);
    }
  });

  socket.on('relations:share', async (payload, callback) => {
    try {
      const { task_relations, user_shared_with } =
        postRelationAndShareWithUserRequestSchema.parse(payload);
      const response = await create_and_share_relations({
        relationsWithTasks: task_relations,
        userSharedWith: user_shared_with,
        id: user_id,
      });
      callback({ success: true, data: response });
      io.of('/user').to(user_shared_with).emit('relations:share', response);
    } catch (e) {
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
