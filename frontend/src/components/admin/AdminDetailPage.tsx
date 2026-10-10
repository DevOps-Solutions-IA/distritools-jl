import { adminFetch } from '@/lib/admin/server-data';
import { getDetailScreenAdapter } from '@/features/admin/screen-adapters/detail-registry';
import { DetailFrame } from '@/features/admin/screen-adapters/shared/DetailFrame';
import type {
  DetailData,
  DetailPageProps,
} from '@/features/admin/screen-adapters/shared/types';

export async function AdminDetailPage({
  backendPath,
  ...navigation
}: DetailPageProps) {
  const result = await adminFetch<DetailData>(backendPath);
  const Screen = getDetailScreenAdapter(backendPath);
  return <DetailFrame {...navigation} result={result} Screen={Screen} />;
}
