import ThemeExplorer from '@/components/ThemeExplorer';
import { getAll } from '@/lib/data';
import { THEMES } from '@/lib/themes';

export const metadata = { title: THEMES.health.title + ' · Говь-Алтай' };

export default async function HealthPage() {
  const { aimag, soums } = await getAll();
  return <ThemeExplorer aimag={aimag} soums={soums} themeKey="health" />;
}
