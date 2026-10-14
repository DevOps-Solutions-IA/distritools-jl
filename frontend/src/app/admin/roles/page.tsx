import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { iamRead, iamSession, iamLoad } from "@/features/admin/system/server";
import {
  rolesSchema,
  matrixSchema,
  usersSchema,
} from "@/features/admin/system/contracts";
import { RolesWorkspace } from "@/features/admin/system/Workspaces";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Roles admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const result = await iamLoad(async () => {
    const user = await iamSession("permissions.read");
    const [roles, matrix, users] = await Promise.all([
      iamRead("/admin/roles", rolesSchema),
      iamRead("/admin/permissions/matrix", matrixSchema),
      user.permissions.includes("users.read")
        ? iamRead("/admin/users", usersSchema)
        : Promise.resolve({ data: [] }),
    ]);
    return {
      roles: roles.data,
      catalog: matrix.catalog,
      users: users.data,
      user,
    };
  });
  return (
    <AdminShell>
      {result.ok ? (
        <RolesWorkspace
          roles={result.data.roles}
          catalog={result.data.catalog}
          users={result.data.users}
          permissions={result.data.user.permissions}
        />
      ) : (
        <AdminReadFailure result={result.result} />
      )}
    </AdminShell>
  );
}
