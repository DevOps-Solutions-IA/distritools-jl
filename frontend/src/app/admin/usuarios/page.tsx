import { AdminShell } from "@/components/layout/AdminShell";
import { AdminReadFailure } from "@/features/admin/platform/ReadFailure";
import { iamRead, iamSession, iamLoad } from "@/features/admin/system/server";
import { usersSchema, rolesSchema } from "@/features/admin/system/contracts";
import { UsersWorkspace } from "@/features/admin/system/Workspaces";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Usuarios admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page() {
  const result = await iamLoad(async () => {
    const user = await iamSession("users.read");
    const users = await iamRead("/admin/users", usersSchema);
    const roles = user.permissions.includes("permissions.read")
      ? await iamRead("/admin/roles", rolesSchema)
      : { data: [] };
    return { users: users.data, roles: roles.data, user };
  });
  return (
    <AdminShell>
      {result.ok ? (
        <UsersWorkspace
          users={result.data.users}
          roles={result.data.roles}
          permissions={result.data.user.permissions}
          actorId={result.data.user.id}
        />
      ) : (
        <AdminReadFailure result={result.result} />
      )}
    </AdminShell>
  );
}
