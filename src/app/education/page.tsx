import EducationExplorer from '@/components/EducationExplorer';
import { getAll } from '@/lib/data';

export const metadata = { title: 'Боловсролын хүртээмж · Говь-Алтай' };

export default async function EducationPage() {
  const { aimag, soums } = await getAll();
  return <EducationExplorer aimag={aimag} soums={soums} />;
}
