import express from 'express';
import {
  changeRelationNameHandler,
  getRelationByIdHandler,
  getRelations,
  postRelationAndShareWithUser,
  removeRelationFromServerHandler,
} from './relations.controller';

export const router = express.Router();

//share relation with user
router.post('/share', postRelationAndShareWithUser);
//get all users relations by token
router.get('', getRelations);
//get relation by id
router.get('/:relation_id', getRelationByIdHandler);
router.patch('/:relation_id', changeRelationNameHandler);
//create new task to relation
router.delete('/:relation_id', removeRelationFromServerHandler);
