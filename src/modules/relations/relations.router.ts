import express from 'express';
import {
  editTaskByIdHandler,
  getRelationById,
  getRelations,
  postRelationAndShareWithUser,
  postTaskToRelationHandler,
  removeRelationFromServer,
  removeTaskFromRelationHandler,
} from './relations.controller';

export const router = express.Router();

//share relation with user
router.post('/share', postRelationAndShareWithUser);
//get all users relations by token
router.get('', getRelations);
//get relation by id
router.get('/:relation_id', getRelationById);
//create new task to relation
router.post('/:relation_id/tasks', postTaskToRelationHandler);
router.patch('/:relation_id/tasks/:task_id', editTaskByIdHandler);
router.delete('/:relation_id/tasks/:task_id', removeTaskFromRelationHandler);
router.delete('/:relation_id', removeRelationFromServer);
