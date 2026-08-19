import SoumsExplorer from '@/components/SoumsExplorer';
import { getAll } from '@/lib/data';

export const metadata = { title: 'Сумын харьцуулалт · Говь-Алтай' };

export default async function SoumsPage() {
  const { aimag, soums } = await getAll();
  return <SoumsExplorer aimag={aimag} soums={soums} />;
}
