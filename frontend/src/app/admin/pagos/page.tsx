import type { SectionSearchParams } from "@/features/admin/platform/query";
import { SalesListPage } from "@/features/admin/orders/ListPage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Pagos admin | DistriTools JL",
  robots: { index: false, follow: false },
};
export default async function Page({
  searchParams,
}: { searchParams?: Promise<SectionSearchParams> } = {}) {
  return SalesListPage({ kind: "payments", query: (await searchParams) ?? {} });
}
