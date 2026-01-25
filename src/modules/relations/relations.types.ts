import { permissionEnum, BasicRelationSchema } from '@groceries/shared_types';
import { z } from 'zod';

export const getRelationByIdQueryResponseSchema = z.object({
  relation_id: z.string().uuid(),
  relation_name: z.string(),
  relation_created_at: z.date(),
  relation_location: z.literal('Server'),
  relation_last_modified: z.date(),
  task_id: z.string().uuid(),
  task_task: z.string(),
  task_created_at: z.date(),
  task_completed_by: z.string().uuid().nullable(),
  task_completed_at: z.date().nullable(),
  task_relations_id: z.string().uuid(),
  task_last_modified: z.date(),
  task_order_idx: z.number(),
});
export type GetRelationByIdQueryResponseType = z.infer<typeof getRelationByIdQueryResponseSchema>;

export const GetAllServerRelationsQuerySchema = BasicRelationSchema.omit({
  created_at: true,
  last_modified: true,
}).extend({
  created_at: z.date(),
  last_modified: z.date(),
  my_permission: permissionEnum,
  shared_with_id: z.string().nullable(),
  shared_with_name: z.string().nullable(),
  shared_with_email: z.string().nullable(),
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
    last_modified,
    ...rest
  }) =>
    shared_with_id && shared_with_email && shared_with_name
      ? {
          ...rest,
          permission: my_permission,
          created_at: created_at.toISOString(),
          last_modified: last_modified.toISOString(),
          shared_with: [{ id: shared_with_id, email: shared_with_email, name: shared_with_name }],
        }
      : {
          ...rest,
          permission: my_permission,
          created_at: created_at.toISOString(),
          last_modified: last_modified.toISOString(),
          shared_with: null,
        }
);
