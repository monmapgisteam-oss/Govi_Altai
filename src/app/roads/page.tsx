import RoadsExplorer from '@/components/RoadsExplorer';
import { getAll, getNationalRoads } from '@/lib/data';

export const metadata = { title: 'Замын хүртээмж · Говь-Алтай' };

export default async function RoadsPage() {
  const [{ aimag, soums }, national] = await Promise.all([getAll(), getNationalRoads()]);
  return <RoadsExplorer aimag={aimag} soums={soums} national={national} />;
}
