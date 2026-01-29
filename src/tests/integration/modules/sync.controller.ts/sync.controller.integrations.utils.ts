import { PendingOperation } from '@groceries/shared_types';

export const createTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  taskName: string = 'Test Task'
): PendingOperation => ({
  id: opId,
  type: 'task-create',
  data: {
    id: taskId,
    task: taskName,
    task_relations_id: relationId,
    order_idx: 0,
    last_modified: new Date().toISOString(),
    created_at: new Date().toISOString(),
    completed_at: null,
    completed_by: null,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const editTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  taskName: string,
  lastModified: string
): PendingOperation => ({
  id: opId,
  type: 'task-edit',
  data: {
    id: taskId,
    task: taskName,
    task_relations_id: relationId,
    last_modified: lastModified,
    completed_at: null,
    completed_by: null,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const toggleTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  lastModified: string,
  completedAt: string | null,
  completedBy: string | null
): PendingOperation => ({
  id: opId,
  type: 'task-toggle',
  data: {
    id: taskId,
    task_relations_id: relationId,
    last_modified: lastModified,
    completed_at: completedAt,
    completed_by: completedBy,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const deleteTaskOperation = (
  opId: string,
  taskId: string,
  relationId: string,
  lastModified: string
): PendingOperation => ({
  id: opId,
  type: 'task-delete',
  data: {
    id: taskId,
    task_relations_id: relationId,
    last_modified: lastModified,
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const reorderTaskOperation = (
  opId: string,
  tasks: { id: string; order_idx: number; task_relations_id: string; last_modified: string }[]
): PendingOperation => ({
  id: opId,
  type: 'task-reorder',
  data: tasks,
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const editRelationOperation = (
  opId: string,
  relationId: string,
  name: string,
  lastModified: string,
  createdAt: string
): PendingOperation => ({
  id: opId,
  type: 'relation-edit',
  data: {
    id: relationId,
    name: name,
    relation_location: 'Server' as const,
    created_at: createdAt,
    last_modified: lastModified,
    permission: 'owner' as const,
    shared_with: [],
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});

export const deleteRelationOperation = (
  opId: string,
  relationId: string,
  name: string,
  lastModified: string,
  createdAt: string
): PendingOperation => ({
  id: opId,
  type: 'relation-delete',
  data: {
    id: relationId,
    name: name,
    relation_location: 'Server' as const,
    created_at: createdAt,
    last_modified: lastModified,
    permission: 'owner' as const,
    shared_with: [],
  },
  timestamp: new Date().toISOString(),
  retryCount: 0,
});
