import OverviewExplorer from '@/components/OverviewExplorer';
import { getAll } from '@/lib/data';

export default async function OverviewPage() {
  const { aimag, soums } = await getAll();
  return <OverviewExplorer aimag={aimag} soums={soums} />;
}
