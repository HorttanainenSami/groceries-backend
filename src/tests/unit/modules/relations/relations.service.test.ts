import * as relationsService from '../../../../modules/relations/relations.service';
import { query } from '../../../../database/connection';
import { TaskType } from '@groceries/shared-types';
jest.mock('../../../../database/connection');
describe('Relation Service', () => {
  const mock_data_of_2: Omit<TaskType, 'id'>[] = [
    {
      task: 'Mock Task 1',
      created_at: new Date().toISOString(),
      completed_by: null,
      completed_at: null,
      task_relations_id: '4517bec7-6672-443a-b6f1-be1697d67398',
    },
    {
      task: 'Mock Task 2',
      created_at: new Date().toISOString(),
      completed_by: 'f7e6d5c4-b3a2-1f0e-9d8c-7b6a5e4d3c2b',
      completed_at: new Date().toISOString(),
      task_relations_id: '4517bec7-6672-443a-b6f1-be1697d67398',
    },
  ];
  const mock_data_of_1 = [
    {
      task: 'Mock Task 1',
      created_at: new Date().toISOString(),
      completed_by: null,
      completed_at: null,
      task_relations_id: '4517bec7-6672-443a-b6f1-be1697d67398',
    },
  ];
  describe('createTaskForRelation', () => {
    let spy_1: jest.SpyInstance;
    let spy_2: jest.SpyInstance;
    beforeAll(() => {
      spy_1 = jest
        .spyOn(relationsService, 'createMultipleTaskForRelation')
        .mockResolvedValue([
          {
            id: 'some-id',
            task: 'Mock Task',
            created_at: new Date().toISOString(),
            completed_by: null,
            completed_at: null,
            task_relations_id: 'some-relation-id',
          },
        ]);
      spy_2 = jest
        .spyOn(relationsService, 'createSingleTaskForRelation')
        .mockResolvedValue({
          id: 'some-id',
          task: 'Mock Task',
          created_at: new Date().toISOString(),
          completed_by: null,
          completed_at: null,
          task_relations_id: 'some-relation-id',
        });
    });
    beforeEach(() => {
      spy_1.mockClear();
      spy_2.mockClear();
    });
    afterAll(() => {
      spy_1.mockRestore();
      spy_2.mockRestore();
    });
    it('should call MultipleTaskFroRelation if provieded list with 1 items', async () => {
      await relationsService.createTaskForRelation(mock_data_of_1);
      expect(
        relationsService.createMultipleTaskForRelation
      ).toHaveBeenCalledTimes(1);
      expect(
        relationsService.createSingleTaskForRelation
      ).toHaveBeenCalledTimes(0);
    });
    it('should call MultipleTaskFroRelation if provieded list with >2 items', async () => {
      await relationsService.createTaskForRelation(mock_data_of_2);
      expect(
        relationsService.createMultipleTaskForRelation
      ).toHaveBeenCalledTimes(1);
      expect(
        relationsService.createSingleTaskForRelation
      ).toHaveBeenCalledTimes(0);
    });
  });
  describe('createMultipleTaskForRelation', () => {
    (query as jest.Mock).mockResolvedValue({ rows: ['test'] });
    beforeEach(() => {
      jest.clearAllMocks();
    });
    it('Should call correctly with 2 tasks', async () => {
      await relationsService.createMultipleTaskForRelation(mock_data_of_2);
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        `INSERT INTO Task (task, created_at, completed_at, completed_by, task_relations_id)
    values ($1, $2, $3, $4, $5), ($6, $7, $8, $9, $10) RETURNING *;`,
        mock_data_of_2.flatMap((data) => [
          data.task,
          data.created_at,
          data.completed_at,
          data.completed_by,
          data.task_relations_id,
        ])
      );
    });
    it('Should call correctly with 1 tasks', async () => {
      await relationsService.createMultipleTaskForRelation(mock_data_of_1);
      expect(query).toHaveBeenCalledTimes(1);
      expect(query).toHaveBeenCalledWith(
        `INSERT INTO Task (task, created_at, completed_at, completed_by, task_relations_id)
    values ($1, $2, $3, $4, $5) RETURNING *;`,
        mock_data_of_1.flatMap((data) => [
          data.task,
          data.created_at,
          data.completed_at,
          data.completed_by,
          data.task_relations_id,
        ])
      );
    });
  });
});
