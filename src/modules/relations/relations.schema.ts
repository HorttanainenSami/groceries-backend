import z from 'zod';

export const NewTaskSchema = z.object({
  text: z.string(),
  created_at: z.string(),
  completed_by: z.string().uuid().nullable(),
  completed_at: z.string().nullable(),
  task_relations_id: z.string().uuid(),
  }).transform(({ text, ...rest }) => ({
  ...rest,
  task: text,
  }));
export const LocalTaskSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  created_at: z.string(),
  completed_by: z.string().uuid().nullable(),
  completed_at: z.string().nullable(),
  task_relations_id: z.string().uuid(),
  }).transform(({ text, ...rest }) => ({
  ...rest,
  task: text,
  }));
  export const LocalTaskRelationSchema = z.object({
    id:z.string().uuid(),
    name:z.string(),
    shared:z.number().nullable(),
    created_at: z.string(),
    tasks: LocalTaskSchema.array(),
  });
  
  export type LocalTaskRelationType = z.infer<typeof LocalTaskRelationSchema>;
  export type LocalTaskType = z.infer<typeof LocalTaskSchema>;
  
  export const TaskSchema = z.object({
    id: z.string().uuid(),
    task: z.string(),
    created_at: z.string(),
    completed_by: z.string().nullable(),
    completed_at: z.string().nullable(),
    task_relations_id: z.string().uuid(),
  });
  export const TaskRelationSchema = z.object({
    id:z.string().uuid(),
    name:z.string(),
    shared:z.number().nullable(),
    created_at: z.string(),
    tasks: TaskSchema.array(),
  });
  
  export type TaskRelationType = z.infer<typeof TaskRelationSchema>;
  export type TaskType = z.infer<typeof TaskSchema>;
  
  export const permissionSchema = z.object({
    permission: z.enum(['owner', 'edit'])
  });
  export type PermissionType = z.infer<typeof permissionSchema>;


export const CreatedRelationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  created_at: z.string(),
});

export type CreatedRelationType = z.infer<typeof CreatedRelationSchema>;

export const editTaskQuerySchema = z.object({
    id: z.string(),
    text: z.string().optional(),
    completed_at: z.string().nullable().optional(),
    completed_by: z.string().nullable().optional(),
    task_relations_id: z.string().optional(),
  }).strict().transform((data) => {
    if(!data.text) return data; 
    const { text, ...rest } = data;
    return {
      ...rest,
      task: text,
    };
  });

export type EditTaskQueryType = z.infer<typeof editTaskQuerySchema>;