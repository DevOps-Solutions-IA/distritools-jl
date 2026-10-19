"use client";
import { useEffect, createContext, type ReactNode } from "react";
import { useAdminSession } from "@/features/admin/shell/useAdminSession";
import { AdminSessionFeedback } from "@/features/admin/shell/AdminSessionFeedback";
export const LogPermissionContext = createContext<readonly string[]>([]);
export function LogReadFence({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { state, retry } = useAdminSession("logistics:" + permission);
  useEffect(() => {
    const refresh = () => retry();
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [retry]);
  if (state.status !== "success")
    return <AdminSessionFeedback status={state.status} onRetry={retry} />;
  if (!state.user.permissions.includes(permission))
    return (
      <p role="alert">No tienes permiso para consultar esta información.</p>
    );
  return (
    <LogPermissionContext.Provider value={state.user.permissions}>
      {children}
    </LogPermissionContext.Provider>
  );
}
