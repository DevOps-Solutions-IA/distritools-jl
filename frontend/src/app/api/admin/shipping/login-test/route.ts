import {
  logisticsProxy,
  loginDiagnostic,
} from "@/features/admin/logistics/bff";
export function GET(request: Request) {
  return logisticsProxy(request, "/admin/shipping/login-test", loginDiagnostic);
}
