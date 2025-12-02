import express from 'express';
import {
  changeRelationNameHandler,
  getRelations,
  postRelationAndShareWithUser,
  removeRelationFromServerHandler,
} from './relations.controller';

export const router = express.Router();

//share relation with user
router.post('/share', postRelationAndShareWithUser);
//get all users relations by token
router.get('', getRelations);
router.patch('/:relation_id', changeRelationNameHandler);
//create new task to relation
router.delete('/:id', removeRelationFromServerHandler);
