import { z } from "zod";
const nullableText = z.string().nullable();
export const userSchema = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: nullableText.optional(),
  role: z
    .object({ id: z.string(), name: z.string(), slug: z.string() })
    .nullable(),
  isActive: z.boolean(),
  twoFactorEnabled: z.boolean(),
  lastLoginAt: nullableText,
});
export const permissionSchema = z.object({
  id: z.string(),
  slug: z.string(),
  module: z.string(),
  name: z.string().optional(),
  description: nullableText.optional(),
});
export const roleSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: nullableText.optional(),
  usersCount: z.number().int().nonnegative(),
  permissions: z.array(permissionSchema),
});
export const usersSchema = z.object({ data: z.array(userSchema) });
export const rolesSchema = z.object({ data: z.array(roleSchema) });
export const matrixSchema = z.object({
  catalog: z.array(permissionSchema),
  roles: z.array(
    z.object({
      roleId: z.string(),
      roleName: z.string(),
      roleSlug: z.string(),
      permissions: z.array(z.string()),
    }),
  ),
});
export const auditSchema = z.object({
  id: z.string(),
  actorUserId: nullableText,
  action: z.string(),
  entityType: z.string(),
  entityId: z.string(),
  requestId: nullableText.optional(),
  correlationId: nullableText.optional(),
  beforeData: z.unknown(),
  afterData: z.unknown(),
  createdAt: z.string(),
});
export const auditsSchema = z.object({ data: z.array(auditSchema) });
const providerSchema = z.object({
  provider: z.string(),
  ready: z.boolean(),
  configured: z.record(z.boolean()),
  pseProvider: z.string().optional(),
  mode: z.string().optional(),
  env: z.string().optional(),
});
export const providersSchema = z.object({
  payments: providerSchema,
  shipping: providerSchema,
  notifications: providerSchema,
});
export const providerValidationSchema = z.object({
  valid: z.boolean(),
  failures: z.array(z.string()),
  providers: providersSchema,
});
export const settingsSchema = z
  .object({
    persisted: z.array(
      z.object({
        id: z.string(),
        key: z.string(),
        category: z.string(),
        isSecret: z.boolean(),
        isEditableFromAdmin: z.boolean(),
        value: z.unknown(),
        updatedAt: z.string(),
      }),
    ),
    general: z.object({ storeName: z.string(), currency: z.string() }),
    productionReadiness: z
      .object({
        status: z.string(),
        checks: z.array(
          z.object({
            key: z.string(),
            label: z.string(),
            status: z.enum(["pass", "fail"]),
            message: z.string(),
          }),
        ),
      })
      .optional(),
  })
  .transform((value) => ({
    ...value,
    persisted: value.persisted
      .filter((row) => row.key === "general.storeName" || row.isSecret)
      .map((row) => ({
        ...row,
        value: row.isSecret
          ? {
              configured: Boolean(
                row.value &&
                typeof row.value === "object" &&
                "configured" in row.value &&
                row.value.configured === true,
              ),
            }
          : row.value,
      })),
  }));
export const userCreateSchema = z
  .object({
    fullName: z.string().trim().min(1),
    email: z
      .string()
      .email()
      .refine((v) => !v.includes("*")),
    password: z.string().min(10),
    phone: z.string().trim().optional(),
    roleId: z.string().uuid(),
  })
  .strict();
export const userUpdateSchema = z
  .object({
    fullName: z.string().trim().min(1).optional(),
    email: z
      .string()
      .email()
      .refine((v) => !v.includes("*"))
      .optional(),
    phone: z.string().trim().nullable().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0);
export const roleCreateSchema = z
  .object({
    name: z.string().trim().min(1),
    slug: z.string().trim().min(1),
    description: z.string().trim().optional(),
  })
  .strict();
export const assignUserSchema = z
  .object({ userId: z.string().uuid() })
  .strict();
export const assignPermissionsSchema = z
  .object({ permissionSlugs: z.array(z.string().trim().min(1)).min(1) })
  .strict();
export const settingsUpdateSchema = z
  .object({
    general: z.object({ storeName: z.string().trim().min(1) }).strict(),
  })
  .strict();
export const emptyInputSchema = z.object({}).strict();
export const mutationSchema = z
  .object({
    id: z.string().optional(),
    roleId: z.string().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((v) => Boolean(v.id || v.roleId));
const confirmationSchema = z.object({
  id: z.string().optional(),
  roleId: z.string().optional(),
  isActive: z.boolean().optional(),
  fullName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().nullable().optional(),
  name: z.string().optional(),
  slug: z.string().optional(),
  description: z.string().nullable().optional(),
  permissions: z.array(z.string()).optional(),
});
export function parseIamMutationConfirmation(
  path: string,
  method: string,
  input: unknown,
  value: unknown,
) {
  const parsed = confirmationSchema.safeParse(value);
  const invalid = { success: false as const };
  if (!parsed.success) return invalid;
  const data = parsed.data;
  const body =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const route = path.replace(/^\/api(?=\/admin\/)/, "");
  // Project only the fields that establish the requested target and effect.
  // In particular, stored contact data must not escape unrelated mutations.
  const confirmation: z.infer<typeof confirmationSchema> = {};
  function userFieldsMatch() {
    for (const field of ["fullName", "email", "phone"] as const) {
      if (
        !Object.prototype.hasOwnProperty.call(body, field) ||
        body[field] === undefined
      )
        continue;
      const submitted = body[field];
      if (
        typeof submitted !== "string" &&
        !(field === "phone" && submitted === null)
      )
        return false;
      const expected =
        field === "phone"
          ? typeof submitted === "string"
            ? submitted.trim() || null
            : null
          : field === "email"
            ? (submitted as string).trim().toLowerCase()
            : (submitted as string).trim();
      if (data[field] !== expected) return false;
      if (field === "phone") confirmation.phone = data.phone;
      else confirmation[field] = data[field];
    }
    return true;
  }
  let matches = false;
  try {
    if (method === "POST" && route === "/admin/users") {
      matches =
        Boolean(data.id) &&
        typeof body.roleId === "string" &&
        data.roleId === body.roleId &&
        data.isActive === true &&
        typeof body.fullName === "string" &&
        typeof body.email === "string" &&
        userFieldsMatch();
      confirmation.id = data.id;
      confirmation.roleId = data.roleId;
      confirmation.isActive = data.isActive;
    } else if (method === "POST" && route === "/admin/roles") {
      matches =
        Boolean(data.id) &&
        typeof body.slug === "string" &&
        data.slug === body.slug.trim().toLowerCase() &&
        typeof body.name === "string" &&
        data.name === body.name.trim();
      confirmation.id = data.id;
      confirmation.slug = data.slug;
      confirmation.name = data.name;
      if (
        Object.prototype.hasOwnProperty.call(body, "description") &&
        body.description !== undefined
      ) {
        matches =
          matches &&
          typeof body.description === "string" &&
          data.description === (body.description.trim() || null);
        confirmation.description = data.description;
      }
    } else {
      const user = route.match(/^\/admin\/users\/([^/?#]+)(\/deactivate)?$/);
      const role = route.match(
        /^\/admin\/roles\/([^/?#]+)\/(permissions|assign-user)$/,
      );
      if (method === "PATCH" && user) {
        matches =
          data.id === decodeURIComponent(user[1]) &&
          (user[2]
            ? data.isActive === false
            : ["fullName", "email", "phone"].some((field) =>
                Object.prototype.hasOwnProperty.call(body, field),
              ) && userFieldsMatch());
        confirmation.id = data.id;
        if (user[2]) confirmation.isActive = data.isActive;
      } else if (method === "POST" && role?.[2] === "assign-user") {
        matches =
          typeof body.userId === "string" &&
          data.id === body.userId &&
          data.roleId === decodeURIComponent(role[1]);
        confirmation.id = data.id;
        confirmation.roleId = data.roleId;
      } else if (method === "PUT" && role?.[2] === "permissions") {
        if (
          !Array.isArray(body.permissionSlugs) ||
          !body.permissionSlugs.every((slug) => typeof slug === "string") ||
          data.permissions === undefined
        )
          return invalid;
        const expected = new Set(
          body.permissionSlugs.map((slug) => slug.trim().toLowerCase()),
        );
        const actual = new Set(data.permissions);
        matches =
          data.roleId === decodeURIComponent(role[1]) &&
          expected.size === actual.size &&
          [...expected].every((slug) => actual.has(slug));
        confirmation.roleId = data.roleId;
        confirmation.permissions = data.permissions;
      }
    }
  } catch {
    return invalid;
  }
  return matches ? { success: true as const, data: confirmation } : invalid;
}
export const settingsMutationSchema = z.object({
  updated: z.literal(true),
  acceptedForReview: z.literal(true),
  settings: z.object({ general: z.object({ storeName: z.string() }) }),
  operationalState: z.object({
    status: z.literal("requires_secure_secret_flow"),
  }),
});
export function parseIamSettingsConfirmation(input: unknown, value: unknown) {
  const request = settingsUpdateSchema.safeParse(input);
  const response = settingsMutationSchema.safeParse(value);
  return request.success &&
    response.success &&
    response.data.settings.general.storeName === request.data.general.storeName
    ? response
    : { success: false as const };
}
export type IamUser = z.infer<typeof userSchema>;
export type IamRole = z.infer<typeof roleSchema>;
export type IamPermission = z.infer<typeof permissionSchema>;
export type IamAudit = z.infer<typeof auditSchema>;
export type IamSettings = z.infer<typeof settingsSchema>;
export type IamProviders = z.infer<typeof providersSchema>;
export function sanitizeAudit(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";
  if (Array.isArray(value))
    return value.map((v) => sanitizeAudit(v, depth + 1));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        /email|phone|mobile|address|document|fullname|firstname|lastname|recipient|secret|token|password|authorization|cookie|otp|recovery|challenge|credential|key|signature|payload|rawbody/i.test(
          k,
        )
          ? "[REDACTED]"
          : sanitizeAudit(v, depth + 1),
      ]),
    );
  return value;
}
