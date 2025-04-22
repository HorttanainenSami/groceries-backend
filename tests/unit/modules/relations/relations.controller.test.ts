import {
  postRelationAndShareWithUser,
  postTaskToRelation,
  shareRelationWithUser,
  getRelationById,
  getRelations,
  editRelationsTaskById,
  removeTaskFromRelation,
} from '../../../../src/modules/relations/relations.controller';
import * as relationsService from '../../../../src/modules/relations/relations.service';
import { decodeToken } from '../../../../src/resources/utils';
import { AuthenticationError } from '../../../../src/middleware/Error.types';

jest.mock('../../../../src/modules/relations/relations.service');
jest.mock('../../../../src/resources/utils');

describe('Relations Controller', () => {
  let req: any;
  let res: any;
  let next: jest.Mock;

  beforeEach(() => {
    req = {
      body: {},
      params: {},
      query: {},
    };
    res = {
      send: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('postRelationAndShareWithUser', () => {
    it('should create relations and share them with a user', async () => {
      req.body = {
        task_relations: [{ name: 'Test Relation' }],
        user_shared_with: { id: 'user-id' },
      };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'owner-id' });
      (relationsService.createTaskRelationWithTasks as jest.Mock).mockResolvedValue({ id: 'relation-id' });
      (relationsService.addRelationCollaborator as jest.Mock).mockResolvedValue({});

      await postRelationAndShareWithUser(req, res, next);

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.createTaskRelationWithTasks).toHaveBeenCalledWith(
        { name: 'Test Relation' },
        { id: 'owner-id' }
      );
      expect(relationsService.addRelationCollaborator).toHaveBeenCalledWith(
        { id: 'user-id' },
        { id: 'relation-id' },
        { permission: 'edit' }
      );
      expect(res.send).toHaveBeenCalledWith([{ id: 'relation-id' }]);
    });

    it('should call next with an error if something goes wrong', async () => {
      const mockError = new Error('Something went wrong');
      (relationsService.createTaskRelationWithTasks as jest.Mock).mockRejectedValue(mockError);

      await postRelationAndShareWithUser(req, res, next);

      expect(next).toHaveBeenCalledWith(mockError);
    });
  });

  describe('postTaskToRelation', () => {
    it('should add a task to a relation', async () => {
      req.body = {
        task_relations_id: 'relation-id',
        name: 'Test Task',
      };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'user-id' });
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.createTaskForRelation as jest.Mock).mockResolvedValue({ id: 'task-id' });

      await postTaskToRelation(req, res, next);

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        { id: 'user-id' },
        { id: 'relation-id' }
      );
      expect(relationsService.createTaskForRelation).toHaveBeenCalledWith({
        task_relations_id: 'relation-id',
        name: 'Test Task',
      });
      expect(res.send).toHaveBeenCalledWith({ id: 'task-id' });
    });

    it('should throw AuthenticationError if the user does not have permission', async () => {
      req.body = {
        task_relations_id: 'relation-id',
        name: 'Test Task',
      };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'user-id' });
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(false);

      await postTaskToRelation(req, res, next);

      expect(next).toHaveBeenCalledWith(
        new AuthenticationError('User does not have permission to edit this relation')
      );
    });
  });

  describe('shareRelationWithUser', () => {
    it('should share a relation with a user', async () => {
      req.body = {
        task_relations_id: 'relation-id',
        user_id: 'user-id',
      };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'owner-id' });
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue({ permission: 'owner' });
      (relationsService.addRelationCollaborator as jest.Mock).mockResolvedValue({});

      await shareRelationWithUser(req, res, next);

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        { id: 'owner-id' },
        { id: 'user-id' }
      );
      expect(relationsService.addRelationCollaborator).toHaveBeenCalledWith(
        { id: 'owner-id' },
        { id: 'relation-id' },
        { permission: 'edit' }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Relation shared successfully' });
    });

    it('should throw AuthenticationError if the user is not the owner', async () => {
      req.body = {
        task_relations_id: 'relation-id',
        user_id: 'user-id',
      };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'owner-id' });
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue({ permission: 'edit' });

      await shareRelationWithUser(req, res, next);

      expect(next).toHaveBeenCalledWith(
        new AuthenticationError('User does not have permission to edit this list')
      );
    });
  });

  describe('getRelationById', () => {
    it('should return a relation by ID', async () => {
      req.params = { id: 'relation-id' };
      (decodeToken as jest.Mock).mockReturnValue({ id: 'user-id' });
      (relationsService.getUserPermission as jest.Mock).mockResolvedValue(true);
      (relationsService.getRelationWithTasks as jest.Mock).mockResolvedValue({ id: 'relation-id' });

      await getRelationById(req, res, next);

      expect(decodeToken).toHaveBeenCalledWith(req);
      expect(relationsService.getUserPermission).toHaveBeenCalledWith(
        { id: 'user-id' },
        { id: 'relation-id' }
      );
      expect(relationsService.getRelationWithTasks).toHaveBeenCalledWith({ id: 'relation-id' });
      expect(res.send).toHaveBeenCalledWith({ id: 'relation-id' });
    });
  });

  // Add similar tests for `getRelations`, `editRelationsTaskById`, and `removeTaskFromRelation`
});