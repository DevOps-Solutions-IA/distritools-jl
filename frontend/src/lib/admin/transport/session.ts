import { adminFetch } from '@/lib/admin/server-data';
import { adminContractFailure, type AdminApiResult } from './result';
import {
  parseAdminSessionContext,
  type AdminSessionContext,
} from './session-contract';
export type { AdminSessionContext } from './session-contract';
export async function getAdminSessionContext(): Promise<
  AdminApiResult<AdminSessionContext>
> {
  const result = await adminFetch<unknown>('/admin/session');
  if (!result.ok) return result;
  const data = parseAdminSessionContext(result.data);
  return data ? { ...result, data } : adminContractFailure(result.status);
}
