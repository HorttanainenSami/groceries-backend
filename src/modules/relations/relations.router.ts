import express from 'express';
import { editRelationsTaskById, getRelationById, getRelations, postRelationAndShareWithUser, postTaskToRelation, removeTaskFromRelation,  } from './relations.controller';

export const router = express.Router();

//share relation with user
router.post('/share', postRelationAndShareWithUser);
//get all users relations by token
router.get('', getRelations);
//get relation by id
router.get('/:id', getRelationById);
//create new task to relation
router.post(`/:relation_id/tasks`, postTaskToRelation);
router.patch(`/:relation_id/tasks/:id`, editRelationsTaskById);
router.delete(`/:relation_id/tasks/:id`, removeTaskFromRelation);