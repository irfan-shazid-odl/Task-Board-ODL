// Central API facade. Import `api` anywhere in the frontend and call
// `api.tasks.list(...)`, `api.projects.create(...)`, etc. Every resource
// module talks to Supabase directly (via @/lib/supabase) or, for privileged
// actions that need the service-role key, to one of our own `/api/**` Route
// Handlers — see lib/api/client.ts's `callServerApi`.

import { authApi } from './resources/auth';
import { usersApi } from './resources/users';
import { projectsApi } from './resources/projects';
import { tasksApi } from './resources/tasks';
import { taskAssignmentsApi } from './resources/taskAssignments';
import { timeLogsApi } from './resources/timeLogs';
import { vaultApi } from './resources/vault';
import { activityApi } from './resources/activity';
import { statsApi } from './resources/stats';
import { clientsApi, subscriptionsApi, credentialsApi, documentsApi } from './resources/misc';

export const api = {
  auth: authApi,
  users: usersApi,
  projects: projectsApi,
  tasks: tasksApi,
  taskAssignments: taskAssignmentsApi,
  timeLogs: timeLogsApi,
  clients: clientsApi,
  subscriptions: subscriptionsApi,
  activity: activityApi,
  credentials: credentialsApi,
  documents: documentsApi,
  vault: vaultApi,
  stats: statsApi,
};

export { ApiError } from './client';
export { subscribeToChanges } from './realtime';
export type { Unsubscribe } from './realtime';
