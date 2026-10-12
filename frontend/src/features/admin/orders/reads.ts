import { z } from "zod";
import { adminFetch } from "@/lib/admin/server-data";
import {
  adminContractFailure,
  type AdminApiResult,
} from "@/lib/admin/transport/result";
export async function saleRead<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<AdminApiResult<T>> {
  const response = await adminFetch<unknown>(path);
  if (!response.ok) return response;
  const data = schema.safeParse(response.data);
  return data.success
    ? { ...response, data: data.data }
    : adminContractFailure(response.status);
}
