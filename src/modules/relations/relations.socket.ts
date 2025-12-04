import { getAllRelations } from "./relations.service";
import { changeRelationName, create_and_share_relations, removeMultipleRelations, removeRelationFromServer } from "./relations.controller";
import {
  deleteRelationParamsSchema,
  postRelationAndShareWithUserRequestSchema,
  socketRelationChangeNamePayload,
  ServerType,
  SocketType
} from "@groceries/shared_types";
import { notifyCollaborators } from "../..";

export const relationsSocketHandler = (
  io: ServerType,
  socket: SocketType,
) => {
  const user_id = socket.data.id;

  socket.join(user_id);

  socket.on('relations:get_relations', async (callback) => {
    try {
      console.log('get Relations ', user_id);
      const relations = await getAllRelations({id:user_id});
      callback({ success: true, data:relations });
    } catch(e) {
      console.error('Error getting relations:', e);
      callback({ success: false, error: 'Error: '+e });
    }
  });
  socket.on('relations:change_name', async (payload, cb) => {
    try {
      const {id, name} = socketRelationChangeNamePayload.parse(payload);
      const response = await changeRelationName(id, name, user_id);
      cb({success:true, data:response});
      await notifyCollaborators(id,user_id,'relations:change_name', response);
    } catch(e) {
      console.error('Error changing relation name:', e);
      cb({ success: false, error: 'Failed to change relation name: '+ e });
    }
  });
  socket.on('relations:delete', async (payload, cb) => {
    
    try {
    const parsed = deleteRelationParamsSchema.parse(payload);
    if(Array.isArray(parsed)){
      const res = await removeMultipleRelations({id:user_id}, parsed)
      const ids = parsed.map(i => i.id);
      cb({ success: true, data: res });
      await Promise.all(
        ids.map(id => notifyCollaborators(id, user_id, 'relations:delete', res))
      );
    }else{
      const res = await removeRelationFromServer(user_id, parsed.id);

      cb({ success: true, data: [res] });
      await notifyCollaborators(parsed.id, user_id, 'relations:delete', [res]);
    }

  } catch (e) {
    console.error('Error deleting relation:', e);
    cb({ success: false, error: 'Failed to delete relation' });
  }});

  socket.on('relations:share', async (payload, cb) => 
  {
    try {
    const {task_relations, user_shared_with} = postRelationAndShareWithUserRequestSchema.parse(payload);
    const response = await create_and_share_relations(task_relations, user_shared_with, user_id);
    cb({ success: true, data: response });
    io.of('/user').to(user_shared_with).emit('relations:share', response);
  } catch(e) {
    console.error('Error sharing relation:', e);
    cb({ success: false, error: 'Failed to share relation' });
  }
});

  socket.on('disconnect', (reason) => {
    console.log(`User ${socket.data.email} disconnected:`, reason);
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

}