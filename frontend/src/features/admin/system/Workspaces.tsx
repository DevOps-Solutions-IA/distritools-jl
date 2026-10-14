"use client";
import { useState, useRef, useId, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  mutationSchema,
  parseIamMutationConfirmation,
  parseIamSettingsConfirmation,
  settingsMutationSchema,
  providerValidationSchema,
  auditSchema,
  sanitizeAudit,
} from "./contracts";
import type {
  IamUser,
  IamRole,
  IamPermission,
  IamSettings,
  IamProviders,
  IamAudit,
} from "./contracts";
const panel =
  "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5";
const select =
  "focus-ring min-h-11 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-2 text-base";
function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  const id = props.id ?? generatedId;
  return (
    <div className="grid gap-2 text-sm font-semibold">
      <label htmlFor={id}>{label}</label>
      <select className={select} {...props} id={id}>
        {children}
      </select>
    </div>
  );
}
function useCommand() {
  const router = useRouter();
  const lock = useRef(false);
  const [state, setState] = useState<
    "idle" | "pending" | "success" | "error" | "uncertain"
  >("idle");
  const [message, setMessage] = useState("");
  const [data, setData] = useState<unknown>(null);
  async function send(
    path: string,
    method: string,
    body: unknown,
    success: string,
  ) {
    if (lock.current) return false;
    lock.current = true;
    setState("pending");
    setMessage("Guardando…");
    setData(null);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      let value: Record<string, unknown>;
      try {
        value = await response.json();
      } catch {
        setState("uncertain");
        setMessage(
          "Resultado incierto. Consulte el estado antes de volver a guardar.",
        );
        return false;
      }
      if (!response.ok) {
        if (response.status >= 500) {
          setState("uncertain");
          setMessage(
            "Resultado incierto. Consulte el estado antes de volver a guardar.",
          );
        } else {
          lock.current = false;
          setState("error");
          setMessage(
            response.status === 401
              ? "Sesión requerida. Inicie sesión nuevamente."
              : response.status === 403
                ? "No tiene permiso para esta operación."
                : typeof value.error === "string"
                  ? value.error
                  : "No se pudo guardar. Revise los datos y el estado actual.",
          );
        }
        return false;
      }
      const schema = path.endsWith("/providers/validate")
        ? providerValidationSchema
        : path === "/api/admin/settings"
          ? settingsMutationSchema
          : mutationSchema;
      const parsed = schema.safeParse(value);
      if (
        !parsed.success ||
        (schema === mutationSchema &&
          !parseIamMutationConfirmation(path, method, body, value).success) ||
        (schema === settingsMutationSchema &&
          !parseIamSettingsConfirmation(body, value).success)
      ) {
        setState("uncertain");
        setMessage(
          "Resultado incierto. Consulte el estado antes de volver a guardar.",
        );
        return false;
      }
      setData(parsed.data);
      lock.current = false;
      setState("success");
      setMessage(success);
      router.refresh();
      return true;
    } catch {
      setState("uncertain");
      setMessage(
        "Resultado incierto. Consulte el estado antes de volver a guardar.",
      );
      return false;
    }
  }
  return {
    send,
    state,
    message,
    data,
    locked: state === "pending" || state === "uncertain",
    reset: () => {
      if (state !== "uncertain") {
        setState("idle");
        setMessage("");
      }
    },
  };
}
function Result({
  command,
  href,
}: {
  command: ReturnType<typeof useCommand>;
  href: string;
}) {
  return command.message ? (
    <div
      role={
        command.state === "success" || command.state === "pending"
          ? "status"
          : "alert"
      }
      className="mt-3 break-words text-sm"
      data-state={command.state}
    >
      <p>{command.message}</p>
      {command.state === "uncertain" ? (
        <a className="mt-2 inline-block underline" href={href}>
          Consultar estado actualizado
        </a>
      ) : null}
      {command.message.startsWith("Sesión requerida") ? (
        <a className="mt-2 inline-block underline" href="/admin/login">
          Iniciar sesión
        </a>
      ) : null}
    </div>
  ) : null;
}
export function UsersWorkspace({
  users,
  roles,
  permissions,
  actorId,
}: {
  users: IamUser[];
  roles: IamRole[];
  permissions: string[];
  actorId: string;
}) {
  const command = useCommand();
  const [editing, setEditing] = useState<IamUser | "new" | null>(null);
  const [deactivate, setDeactivate] = useState<IamUser | null>(null);
  const [fullName, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roleId, setRole] = useState("");
  const canCreate = permissions.includes("users.create"),
    canEdit = permissions.includes("users.update"),
    canDeactivate = permissions.includes("users.deactivate");
  function open(user: IamUser | "new") {
    command.reset();
    setDeactivate(null);
    setEditing(user);
    setName(user === "new" ? "" : user.fullName);
    setEmail("");
    setPhone("");
    setPassword("");
    setRole("");
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    const creating = editing === "new";
    if ((creating && !canCreate) || (!creating && !canEdit)) return;
    const body = creating
      ? { fullName, email, phone: phone || undefined, password, roleId }
      : { fullName, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
    const saved = await command.send(
      creating ? "/api/admin/users" : `/api/admin/users/${editing.id}`,
      creating ? "POST" : "PATCH",
      body,
      creating
        ? "Usuario creado. Acceso pendiente de provisión segura de 2FA por un operador autorizado."
        : "Usuario actualizado.",
    );
    setPassword("");
    if (saved) {
      setEmail("");
      setPhone("");
      setEditing(null);
    }
  }
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Usuarios internos</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Acceso administrativo · contactos protegidos · inscripción de 2FA
              verificada por autenticación
            </p>
          </div>
          {canCreate ? (
            <Button onClick={() => open("new")} disabled={command.locked}>
              Crear usuario
            </Button>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          {users.length} registros recibidos · límite del backend: 100 · sin
          paginación adicional disponible
        </p>
      </section>
      <section className={panel}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-left text-sm">
            <caption className="sr-only">
              Usuarios y permisos de operación
            </caption>
            <thead>
              <tr>
                {[
                  "Usuario",
                  "Contacto protegido",
                  "Rol",
                  "Estado / 2FA",
                  "Operaciones",
                ].map((x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-white/10">
                  <td className="p-3 font-semibold">{user.fullName}</td>
                  <td className="p-3">
                    <span>{user.email}</span>
                    <br />
                    <span>{user.phone}</span>
                  </td>
                  <td className="p-3">{user.role?.name ?? "Sin rol"}</td>
                  <td className="p-3">
                    {user.isActive ? "Activo" : "Inactivo"}
                    <br />
                    2FA: {user.twoFactorEnabled ? "inscrito" : "pendiente"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {canEdit ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => open(user)}
                          disabled={command.locked}
                        >
                          Editar usuario
                        </Button>
                      ) : null}
                      {canDeactivate && user.isActive && user.id !== actorId ? (
                        <Button
                          variant="danger"
                          size="sm"
                          disabled={command.locked}
                          onClick={() => {
                            command.reset();
                            setEditing(null);
                            setDeactivate(user);
                          }}
                        >
                          Desactivar usuario
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!users.length ? (
          <p className="py-4">No hay usuarios en la respuesta autorizada.</p>
        ) : null}
      </section>
      {editing && (editing === "new" ? canCreate : canEdit) ? (
        <form
          onSubmit={save}
          className={panel}
          aria-label={
            editing === "new"
              ? "Crear usuario interno"
              : "Editar usuario interno"
          }
        >
          <h2 className="text-lg font-semibold">
            {editing === "new"
              ? "Nuevo usuario"
              : `Editar: ${editing.fullName}`}
          </h2>
          <fieldset
            disabled={command.locked}
            className="mt-4 grid gap-4 sm:grid-cols-2"
          >
            <Input
              label="Nombre completo"
              required
              value={fullName}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label={editing === "new" ? "Email" : "Nuevo email (opcional)"}
              type="email"
              required={editing === "new"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              helperText={
                editing === "new"
                  ? undefined
                  : "En blanco conserva el email existente; la máscara no se envía."
              }
            />
            <Input
              label={
                editing === "new"
                  ? "Teléfono (opcional)"
                  : "Nuevo teléfono (opcional)"
              }
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            {editing === "new" ? (
              <>
                <Input
                  label="Contraseña inicial"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {permissions.includes("permissions.read") ? (
                  <Select
                    label="Rol inicial"
                    required
                    value={roleId}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <option value="">Seleccione un rol</option>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    label="ID del rol inicial"
                    required
                    value={roleId}
                    onChange={(e) => setRole(e.target.value)}
                    helperText="Identificador de un rol existente proporcionado por su administrador."
                  />
                )}
              </>
            ) : null}
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button
                type="submit"
                disabled={
                  editing === "new" &&
                  permissions.includes("permissions.read") &&
                  !roles.length
                }
                loading={command.state === "pending"}
              >
                Guardar usuario
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setPassword("");
                }}
              >
                Cerrar formulario
              </Button>
            </div>
          </fieldset>
        </form>
      ) : null}
      {deactivate && canDeactivate ? (
        <section className={panel} aria-label="Confirmar desactivación">
          <h2 className="text-lg font-semibold">
            Desactivar a {deactivate.fullName}
          </h2>
          <p className="mt-2 text-sm">
            Perderá el acceso administrativo. El servidor debe autorizar y
            registrar la operación.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="danger"
              disabled={command.locked}
              onClick={async () => {
                if (
                  await command.send(
                    `/api/admin/users/${deactivate.id}/deactivate`,
                    "PATCH",
                    {},
                    "Usuario desactivado.",
                  )
                )
                  setDeactivate(null);
              }}
            >
              Confirmar desactivación
            </Button>
            <Button
              variant="outline"
              disabled={command.locked}
              onClick={() => setDeactivate(null)}
            >
              Cancelar
            </Button>
          </div>
        </section>
      ) : null}
      <Result command={command} href="/admin/usuarios" />
    </div>
  );
}
export function RolesWorkspace({
  roles,
  users,
  catalog,
  permissions,
}: {
  roles: IamRole[];
  users: IamUser[];
  catalog: IamPermission[];
  permissions: string[];
}) {
  const command = useCommand();
  const [creating, setCreating] = useState(false);
  const [target, setTarget] = useState<IamRole | null>(null);
  const [assigning, setAssigning] = useState<IamRole | null>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const [userId, setUser] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  return (
    <div className="space-y-4">
      <section className={panel}>
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Roles y permisos</h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Catálogo de permisos del servidor y asignaciones persistentes.
            </p>
          </div>
          {permissions.includes("roles.create") ? (
            <Button
              disabled={command.locked}
              onClick={() => {
                command.reset();
                setCreating(true);
                setTarget(null);
                setAssigning(null);
              }}
            >
              Crear rol
            </Button>
          ) : null}
        </div>
      </section>
      <section className={panel}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm">
            <caption className="sr-only">Roles registrados</caption>
            <thead>
              <tr>
                {["Rol", "Permisos", "Usuarios", "Operaciones"].map((x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr className="border-t border-white/10" key={role.id}>
                  <td className="p-3 font-semibold">
                    {role.name}
                    <p className="text-xs font-normal text-[var(--color-text-secondary)]">
                      {role.slug}
                    </p>
                  </td>
                  <td className="p-3">
                    <details>
                      <summary className="cursor-pointer">
                        {role.permissions.length} permisos
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {role.permissions.map((p) => (
                          <li key={p.slug}>{p.slug}</li>
                        ))}
                      </ul>
                    </details>
                  </td>
                  <td className="p-3">{role.usersCount}</td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {permissions.includes("permissions.assign") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={command.locked}
                          onClick={() => {
                            command.reset();
                            setTarget(role);
                            setSlugs(role.permissions.map((p) => p.slug));
                            setCreating(false);
                            setAssigning(null);
                          }}
                        >
                          Asignar permisos
                        </Button>
                      ) : null}
                      {permissions.includes("roles.assign") ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={command.locked}
                          onClick={() => {
                            command.reset();
                            setAssigning(role);
                            setTarget(null);
                            setCreating(false);
                            setUser("");
                          }}
                        >
                          Asignar usuario
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!roles.length ? (
          <p className="py-4">No hay roles registrados.</p>
        ) : null}
      </section>
      {creating && permissions.includes("roles.create") ? (
        <form
          className={panel}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await command.send(
                "/api/admin/roles",
                "POST",
                { name, slug, description: description || undefined },
                "Rol creado. Asigne permisos para habilitar sus capacidades.",
              )
            ) {
              setCreating(false);
              setName("");
              setSlug("");
              setDescription("");
            }
          }}
        >
          <h2 className="text-lg font-semibold">Nuevo rol</h2>
          <fieldset
            disabled={command.locked}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            <Input
              label="Nombre del rol"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              label="Identificador del rol"
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <Input
              label="Descripción (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Button type="submit" loading={command.state === "pending"}>
              Guardar rol
            </Button>
          </fieldset>
        </form>
      ) : null}
      {target && permissions.includes("permissions.assign") ? (
        <form
          className={panel}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              slugs.length &&
              (await command.send(
                `/api/admin/roles/${target.id}/permissions`,
                "PUT",
                { permissionSlugs: slugs },
                "Permisos del rol actualizados.",
              ))
            )
              setTarget(null);
          }}
        >
          <h2 className="text-lg font-semibold">Permisos: {target.name}</h2>
          <p className="mt-1 text-sm">
            Reemplaza la selección actual. El contrato exige al menos un
            permiso.
          </p>
          <fieldset
            disabled={command.locked}
            className="mt-4 grid gap-2 sm:grid-cols-2"
          >
            {catalog.map((p) => (
              <label
                className="flex min-h-11 items-center gap-3 rounded border border-white/10 p-2 text-sm"
                key={p.slug}
              >
                <input
                  type="checkbox"
                  className="focus-ring"
                  checked={slugs.includes(p.slug)}
                  onChange={(e) =>
                    setSlugs(
                      e.target.checked
                        ? [...slugs, p.slug]
                        : slugs.filter((s) => s !== p.slug),
                    )
                  }
                />
                <span>
                  {p.name ?? p.slug}
                  <span className="block text-xs text-[var(--color-text-secondary)]">
                    {p.module} · {p.slug}
                  </span>
                </span>
              </label>
            ))}
            <Button
              type="submit"
              disabled={!slugs.length}
              loading={command.state === "pending"}
            >
              Guardar permisos
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTarget(null)}
            >
              Cerrar selección
            </Button>
          </fieldset>
        </form>
      ) : null}
      {assigning && permissions.includes("roles.assign") ? (
        <form
          className={panel}
          onSubmit={async (e) => {
            e.preventDefault();
            if (
              await command.send(
                `/api/admin/roles/${assigning.id}/assign-user`,
                "POST",
                { userId },
                "Rol asignado al usuario.",
              )
            )
              setAssigning(null);
          }}
        >
          <h2 className="text-lg font-semibold">Asignar {assigning.name}</h2>
          <fieldset
            disabled={command.locked}
            className="mt-3 grid gap-3 sm:grid-cols-2"
          >
            {permissions.includes("users.read") ? (
              <Select
                label="Usuario destinatario"
                required
                value={userId}
                onChange={(e) => setUser(e.target.value)}
              >
                <option value="">Seleccione un usuario</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} · {u.isActive ? "Activo" : "Inactivo"}
                  </option>
                ))}
              </Select>
            ) : (
              <Input
                label="ID del usuario destinatario"
                required
                value={userId}
                onChange={(e) => setUser(e.target.value)}
                helperText="Identificador de un usuario existente. Su contacto no se consulta."
              />
            )}
            <Button type="submit" loading={command.state === "pending"}>
              Confirmar asignación
            </Button>
          </fieldset>
        </form>
      ) : null}
      <Result command={command} href="/admin/roles" />
    </div>
  );
}
export function SettingsWorkspace({
  settings,
  providers,
  permissions,
}: {
  settings: IamSettings;
  providers: IamProviders;
  permissions: string[];
}) {
  const command = useCommand();
  const persisted = settings.persisted.find(
    (v) =>
      v.key === "general.storeName" && !v.isSecret && v.isEditableFromAdmin,
  );
  const [storeName, setName] = useState(
    typeof persisted?.value === "string"
      ? persisted.value
      : settings.general.storeName,
  );
  const validation = providerValidationSchema.safeParse(command.data);
  return (
    <div className="space-y-4">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">Configuración del sistema</h1>
        <p className="mt-2 text-sm">
          Producción NO-GO · autorización de release pendiente. Los estados
          siguientes describen configuración del backend.
        </p>
      </section>
      <section className={panel}>
        <h2 className="text-lg font-semibold">Proveedores configurados</h2>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {[
            ["Pagos", providers.payments],
            ["Logística", providers.shipping],
            ["Notificaciones", providers.notifications],
          ].map(([name, value]) => {
            const p = value as IamProviders["payments"];
            return (
              <article
                key={String(name)}
                className="rounded-lg border border-white/10 p-3"
              >
                <h3 className="font-semibold">{String(name)}</h3>
                <p className="mt-2">Proveedor: {p.provider}</p>
                <p className="text-sm">
                  Configuración:{" "}
                  {p.ready ? "declarada por el backend" : "pendiente"}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  {Object.entries(p.configured).map(([key, configured]) => (
                    <div key={key} className="flex justify-between gap-3">
                      <dt className="break-all">{key}</dt>
                      <dd>{configured ? "Configurado" : "No configurado"}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          La validación local no comprueba credenciales con proveedores ni
          autoriza su uso.
        </p>
        {permissions.includes("settings.write") ? (
          <Button
            className="mt-3"
            variant="outline"
            disabled={command.locked}
            onClick={async () => {
              await command.send(
                "/api/admin/settings/providers/validate",
                "POST",
                {},
                "Validación local completada.",
              );
            }}
          >
            Validar configuración local
          </Button>
        ) : null}
        {validation.success ? (
          <p role="status" className="mt-3">
            {validation.data.valid
              ? "Sin errores locales de configuración."
              : validation.data.failures.join(" ")}
          </p>
        ) : null}
      </section>
      <form
        className={panel}
        onSubmit={async (e) => {
          e.preventDefault();
          await command.send(
            "/api/admin/settings",
            "PATCH",
            { general: { storeName } },
            "Datos públicos registrados para revisión. Las variables del entorno no se modificaron.",
          );
        }}
      >
        <h2 className="text-lg font-semibold">Datos públicos registrados</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          El nombre queda persistido para revisión administrativa. Moneda del
          entorno: {settings.general.currency}.
        </p>
        <fieldset
          disabled={command.locked || !permissions.includes("settings.write")}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <Input
            label="Nombre público registrado"
            required
            value={storeName}
            onChange={(e) => setName(e.target.value)}
          />
          {permissions.includes("settings.write") ? (
            <Button type="submit" loading={command.state === "pending"}>
              Guardar datos públicos
            </Button>
          ) : null}
        </fieldset>
      </form>
      <section
        className={panel}
        aria-label="Estado técnico declarado por el backend"
      >
        <h2 className="text-lg font-semibold">
          Producción — Checklist de salida
        </h2>
        <p className="mt-2 text-sm">
          Estado declarado por el backend. La autorización de release permanece
          pendiente.
          <span className="mt-2 block font-semibold">
            {settings.productionReadiness?.status ?? "No recibido"}
          </span>
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {settings.productionReadiness?.checks.map((check) => (
            <article
              key={check.key}
              className="rounded-lg border border-white/10 p-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <h3 className="font-semibold">{check.label}</h3>
                <span
                  className={
                    check.status === "pass"
                      ? "text-green-400"
                      : "text-amber-300"
                  }
                >
                  {check.status.toUpperCase()}
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {check.message}
              </p>
            </article>
          ))}
        </div>
      </section>
      <Result command={command} href="/admin/configuracion" />
    </div>
  );
}
export function AuditWorkspace({
  entries,
  filters,
}: {
  entries: IamAudit[];
  filters: Record<string, string>;
}) {
  const [detail, setDetail] = useState<IamAudit | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function read(id: string) {
    setDetail(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/audit/${id}`, {
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 403
            ? "No tiene permiso para leer auditoría."
            : response.status === 401
              ? "Sesión requerida."
              : "No se pudo leer el evento.",
        );
      const parsed = auditSchema.safeParse(await response.json());
      if (!parsed.success || parsed.data.id !== id)
        throw new Error("Respuesta de auditoría inválida.");
      setDetail({
        ...parsed.data,
        beforeData: sanitizeAudit(parsed.data.beforeData),
        afterData: sanitizeAudit(parsed.data.afterData),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo leer el evento.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <div className="space-y-4">
      <section className={panel}>
        <h1 className="text-2xl font-semibold">Auditoría administrativa</h1>
        <p className="mt-2 text-sm">
          Eventos y cambios sanitizados registrados por el backend.
        </p>
        <form
          action="/admin/auditoria"
          method="GET"
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          <Input
            label="Acción exacta"
            name="action"
            defaultValue={filters.action ?? ""}
          />
          <Input
            label="Tipo de entidad"
            name="entityType"
            defaultValue={filters.entityType ?? ""}
          />
          <Input
            label="ID de entidad"
            name="entityId"
            defaultValue={filters.entityId ?? ""}
          />
          <Select
            label="Límite de eventos"
            name="limit"
            defaultValue={filters.limit ?? "50"}
          >
            {["20", "50", "100"].map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
          <Button type="submit">Filtrar eventos</Button>
          <a
            href="/admin/auditoria"
            className="focus-ring inline-flex min-h-11 items-center px-3 underline"
          >
            Limpiar filtros
          </a>
        </form>
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          {entries.length} eventos recibidos · ventana limitada del servidor,
          sin cursor adicional disponible
        </p>
      </section>
      <section className={panel}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <caption className="sr-only">Eventos de auditoría</caption>
            <thead>
              <tr>
                {["Fecha", "Acción / Entidad", "Actor", "Detalle"].map((x) => (
                  <th key={x} className="p-3">
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-white/10">
                  <td className="p-3">
                    {new Date(entry.createdAt).toLocaleString("es-CO")}
                  </td>
                  <td className="p-3 font-semibold">
                    {entry.action}
                    <p className="break-all text-xs font-normal">
                      {entry.entityType} / {entry.entityId}
                    </p>
                  </td>
                  <td className="p-3 break-all">
                    {entry.actorUserId ?? "Sistema"}
                  </td>
                  <td className="p-3">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={loading}
                      onClick={() => read(entry.id)}
                    >
                      Ver cambios
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!entries.length ? (
          <p className="py-4">No hay eventos para los filtros recibidos.</p>
        ) : null}
      </section>
      {loading ? <p role="status">Cargando evento…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {detail ? (
        <section className={panel} aria-label="Detalle del evento">
          <h2 className="text-lg font-semibold">{detail.action}</h2>
          <dl className="mt-3 grid gap-3 break-all text-sm sm:grid-cols-2">
            <div>
              <dt>Actor</dt>
              <dd>{detail.actorUserId ?? "Sistema"}</dd>
            </div>
            <div>
              <dt>Entidad</dt>
              <dd>
                {detail.entityType} / {detail.entityId}
              </dd>
            </div>
            <div>
              <dt>Solicitud</dt>
              <dd>{detail.requestId ?? "No registrada"}</dd>
            </div>
            <div>
              <dt>Correlación</dt>
              <dd>{detail.correlationId ?? "No registrada"}</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              ["Antes", detail.beforeData],
              ["Después", detail.afterData],
            ].map(([label, data]) => (
              <section key={String(label)}>
                <h3 className="font-semibold">{String(label)}</h3>
                <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-3 text-xs">
                  {JSON.stringify(data, null, 2) ?? "Sin datos"}
                </pre>
              </section>
            ))}
          </div>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => setDetail(null)}
          >
            Cerrar detalle
          </Button>
        </section>
      ) : null}
    </div>
  );
}
