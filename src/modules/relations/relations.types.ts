import { permissionEnum, BasicRelationSchema } from '@groceries/shared_types';
import { z } from 'zod';

export const getRelationByIdQueryResponseSchema = z.object({
  relation_id: z.string().uuid(),
  relation_name: z.string(),
  relation_created_at: z.date(),
  relation_location: z.literal('Server'),
  task_id: z.string().uuid(),
  task_task: z.string(),
  task_created_at: z.date(),
  task_completed_by: z.string().uuid().nullable(),
  task_completed_at: z.date().nullable(),
  task_relations_id: z.string().uuid(),
  task_order_idx: z.number(),
});
export type GetRelationByIdQueryResponseType = z.infer<typeof getRelationByIdQueryResponseSchema>;

export const GetAllServerRelationsQuerySchema = BasicRelationSchema.extend({
  created_at: z.date(),
  my_permission: permissionEnum,
  shared_with_id: z.string(),
  shared_with_name: z.string(),
  shared_with_email: z.string(),
  relation_location: z.literal('Server'),
});
export type GetAllServerRelationsQueryType = z.infer<typeof GetAllServerRelationsQuerySchema>;
export const GetAllServerRelationsTransform = GetAllServerRelationsQuerySchema.transform(
  ({
    created_at,
    shared_with_email,
    shared_with_id,
    shared_with_name,
    my_permission,
    ...rest
  }) => ({
    ...rest,
    permission: my_permission,
    created_at: created_at.toISOString(),
    shared_with: [{ id: shared_with_id, email: shared_with_email, name: shared_with_name }],
  })
);
