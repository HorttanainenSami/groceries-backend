import {
  postRelationAndShareWithUser,
  postTaskToRelation,
  shareRelationWithUser,
  getRelationById,
  editTaskById,
  removeTaskFromRelation,
} from '../../../../modules/relations/relations.controller';
import * as relationsService from '../../../../modules/relations/relations.service';
import { decodeToken } from '../../../../resources/utils';
import { AuthenticationError } from '../../../../middleware/Error.types';
import { Request, Response, NextFunction } from 'express';
import { createFixture } from 'zod-fixture';
import {
  baseTaskSchema,
  editRelationsTaskByIdReqBodySchema,
  editRelationsTaskByIdReqParamsSchema,
  TaskRelationSchema,
} from '../../../../modules/relations/relations.schema';
import { userSchema } from '../../../../modules/auth/auth.schema';
import z from 'zod';
jest.mock('../../../../modules/relations/relations.service');
jest.mock('../../../../resources/utils');
const testBaseTaskSchema = baseTaskSchema.extend({
  completed_by: z.string().uuid(), // Make required for testing
  completed_at: z.date(), // Make required for testing
});

const fakeTime = '2023-01-01T00:00:00Z';
jest.useFakeTimers().setSystemTime(new Date(fakeTime));

describe('Relations Controller', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock;
  const owner_id = createFixture(userSchema.pick({ id: true }));
  const authError = new AuthenticationError(
    'User does not have permission to edit this list'
  );
  beforeEach(() => {
    (decodeToken as jest.Mock).mockReturnValue(owner_id);
    req = {};
    res = {
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('postRelationAndShareWithUser', () => {
    it('should call next with an error if something goes wrong', async () => {
      await postRelationAndShareWithUser(
        req as Request,
        res as Response,
        next as NextFunction
      );
      expect(next).toHaveBeenCalled();
    });
  });
  describe('postTaskToRelation', () => {
    const { id, ...new_task } = createFixture(testBaseTaskSchema);
    beforeEach(() => {
      req.body = {
        task: new_task,
      };
    });
    afterEach(() => {
      jest.clearAllMocks();
    });
    it('should add a task to a relation', async () => {
      const response_task = new_task;
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.createTaskForRelation as jest.Mock).mockResolvedValue({
        ...response_task,
        id,
      });

      await postTaskToRelation(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        owner_id,
        { id: new_task.task_relations_id }
      );
      expect(relationsService.createTaskForRelation).toHaveBeenCalledWith(
        response_task
      );

      expect(res.send).toHaveBeenCalledWith({ ...response_task, id });
    });

    it('should throw AuthenticationError if the user does not have permission', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(
        false
      );
      await postTaskToRelation(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(next).toHaveBeenCalledWith(
        new AuthenticationError(
          'User does not have permission to edit this relation'
        )
      );
    });
  });

  describe('shareRelationWithUser', () => {
    const relations_id = createFixture(
      TaskRelationSchema.pick({ id: true })
    ).id;
    const user_id = createFixture(userSchema.pick({ id: true })).id;
    beforeEach(() => {
      req.body = {
        task_relations_id: relations_id,
        user_id,
      };
    });
    it('should share a relation with a user', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue({
        permission: 'owner',
      });
      (relationsService.grantRelationPermission as jest.Mock).mockResolvedValue(
        {}
      );

      await shareRelationWithUser(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        { id: owner_id.id },
        { id: relations_id }
      );
      expect(relationsService.grantRelationPermission).toHaveBeenCalledWith(
        { id: user_id },
        { id: relations_id },
        { permission: 'edit' }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Relation shared successfully',
      });
    });

    it('should throw AuthenticationError if the user is not the owner', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue({
        permission: 'edit',
      });

      await shareRelationWithUser(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(next).toHaveBeenCalledWith(authError);
    });
  });

  describe('getRelationById', () => {
    const relation = createFixture(TaskRelationSchema.omit({ tasks: true }));
    beforeEach(() => {
      req.params = {
        relation_id: relation.id,
      };
    });
    it('should return a relation by ID', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.getRelationWithTasks as jest.Mock).mockResolvedValue(
        relation
      );

      await getRelationById(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        { id: owner_id.id },
        { id: relation.id }
      );
      expect(relationsService.getRelationWithTasks).toHaveBeenCalledWith({
        id: relation.id,
      });
      expect(res.send).toHaveBeenCalledWith(relation);
    });
    it('should call next() if user doenst have permission for relation', async () => {
      (relationsService.getUserPermission as jest.Mock).mockRejectedValue(
        authError
      );
      await getRelationById(
        req as Request,
        res as Response,
        next as NextFunction
      );

      expect(next).toHaveBeenCalledWith(authError);
    });
  });
  describe('editRelationsTaskById', () => {
    const mockBody = createFixture(editRelationsTaskByIdReqBodySchema);
    const mockParams = createFixture(editRelationsTaskByIdReqParamsSchema);
    beforeEach(() => {
      req.body = mockBody;
      req.params = mockParams;
    });

    it('should return edited task', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.editTask as jest.Mock).mockResolvedValue({
        test: 'changed',
      });
      await editTaskById(req as Request, res as Response, next as NextFunction);
      expect(res.send).toHaveBeenCalled();
    });
    it('should throw AuthenticationError if user doesnt have permission for relation', async () => {
      (relationsService.getUserPermission as jest.Mock).mockRejectedValue(
        authError
      );
      await editTaskById(req as Request, res as Response, next as NextFunction);

      expect(next).toHaveBeenCalledWith(authError);
    });
  });
  describe('removeTaskFromRelation', () => {
    const relation_id = createFixture(TaskRelationSchema.pick({ id: true })).id;
    const task_id = createFixture(testBaseTaskSchema.pick({ id: true })).id;
    beforeEach(() => {
      req.params = {
        relation_id,
        task_id,
      };
    });
    it('on success should return removed task to send', async () => {
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.removeTask as jest.Mock).mockResolvedValue({
        id: 'response',
      });
      await removeTaskFromRelation(
        req as Request,
        res as Response,
        next as NextFunction
      );
      expect(res.send).toHaveBeenCalledWith({ id: 'response' });
    });
    it('should throw AuthorizationError when no permission to relation', async () => {
      (relationsService.getUserPermission as jest.Mock).mockRejectedValue(
        authError
      );
      await removeTaskFromRelation(
        req as Request,
        res as Response,
        next as NextFunction
      );
      expect(next).toHaveBeenCalledWith(authError);
    });
  });
});
