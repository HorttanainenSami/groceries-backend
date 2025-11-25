import express from 'express';
import {
  editTaskByIdHandler,
  postTaskToRelationHandler,
  removeTaskFromRelationHandler,
} from './tasks.controller';

export const router = express.Router();

//create new task to relation
router.post('/', postTaskToRelationHandler);
router.patch('/:task_id', editTaskByIdHandler);
router.delete('/:task_id', removeTaskFromRelationHandler);
