import z from 'zod';
import { userSchema } from '../auth/auth.schema';

const parseDate = (arg: unknown) => {
  if (typeof arg === 'string') {
    const date = new Date(arg);
    return isNaN(date.getTime()) ? undefined : date;
  }
  if (arg instanceof Date && !isNaN(arg.getTime())) return arg;
  return undefined;
};

const parseNullableDate = (arg: unknown) => {
  if (arg === null||arg ==='null') return null;
  return parseDate(arg);
};

export const baseTaskSchema = z.object({
  id: z.string().uuid(),
  task: z.string(),
  created_at: z.preprocess(parseDate, z.date()),
  completed_by: z.string().uuid().nullable(),
  completed_at: z.preprocess(parseNullableDate, z.date().nullable()),
  task_relations_id: z.string().uuid(),
});


export const TaskSchema = baseTaskSchema.refine(
  (data) => !(data.completed_at && !data.completed_by),
  {
    message: 'completed_by isnt defined when completed_at is',
    path: ['completed_by'],
  }
);

export const baseModifyTaskSchema = z
  .object({
    completed_at: z.preprocess(parseNullableDate, z.date().nullable().optional()),
    completed_by: z.string().uuid().nullable().optional(),
    task: z.string().optional(),
  })
  .refine((data) => !(data.completed_at && !data.completed_by), {
    message: 'completed_by isnt defined when completed_at is',
    path: ['completed_by'],
  });

export const newTaskSchema = TaskSchema.transform((data) => ({
  ...data,
  created_at: new Date(),
}));
export const patchTaskSchema = baseModifyTaskSchema.transform((data) => {
  if (!data.completed_at && !data.completed_by)
    return { ...data, completed_at: null, completed_by: null };
  if (data.completed_by) {
    return { ...data, completed_at: new Date() };
  }
  return { ...data };
});

export const TaskRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  relation_location: z.string().default('Server'),
  created_at: z.preprocess(
    (arg) => (typeof arg === 'string' ? new Date(arg) : arg),
    z.date(),
    z.date()
  ),
  tasks: TaskSchema.array(),
});
export const newTaskRelationSchema = TaskRelationSchema.transform((data) => ({
  ...data,
  created_at: new Date(),
}));

export type TaskRelationType = z.infer<typeof TaskRelationSchema>;
export type TaskType = z.infer<typeof TaskSchema>;

export const permissionSchema = z.object({
  permission: z.enum(['owner', 'edit']),
});
export type PermissionType = z.infer<typeof permissionSchema>;

export const postRelationAndShareWithUserRequestSchema = z.object({
  task_relations: newTaskRelationSchema.array(),
  user_shared_with: userSchema.pick({ id: true }).shape.id,
});

export const postTaskToRelationReqSchema = z.object({
  task: baseTaskSchema.omit({ id: true }),
});

export const shareRelationWithUserReqSchema = z.object({
  task_relations_id: TaskRelationSchema.pick({ id: true }).shape.id,
  user_id: userSchema.pick({ id: true }).shape.id,
});
export const editRelationsTaskByIdReqParamsSchema = z.object({
  relation_id: TaskRelationSchema.pick({ id: true }).shape.id,
  task_id: baseTaskSchema.pick({ id: true }).shape.id,
});
export const editRelationsTaskByIdReqBodySchema = baseTaskSchema
  .omit({ id: true, task_relations_id: true, created_at: true })
  .partial();

export const removeTaskFromRelationReqParams = z.object({
  relation_id: TaskRelationSchema.pick({ id: true }).shape.id,
  task_id: baseTaskSchema.pick({ id: true }).shape.id,
});
export const getRelationsByIdReqParams = z.object({
  relation_id: TaskRelationSchema.pick({ id: true }).shape.id,
});

export const getRelationByIdQueryResponseSchema = baseTaskSchema.extend({
  relation_id: z.string().uuid(),
  name: z.string(),
  shared: z.number().nullable(),
  relation_created_at: z.preprocess(
    (arg) => (typeof arg === 'string' ? new Date(arg) : arg),
    z.date(),
    z.date()
  ),
});
export type getRelationByIdQueryResponseType = z.infer<
  typeof getRelationByIdQueryResponseSchema
>;
export const deleteRelationParamsSchema = z.object({
  relation_id: z.string().uuid(),
});
export type deleteRelationParamsType = z.infer<
  typeof deleteRelationParamsSchema
>;
