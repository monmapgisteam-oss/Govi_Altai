import ThemeExplorer from '@/components/ThemeExplorer';
import { getAll } from '@/lib/data';
import { THEMES } from '@/lib/themes';

export const metadata = { title: THEMES.population.title + ' · Говь-Алтай' };

export default async function PopulationPage() {
  const { aimag, soums } = await getAll();
  return <ThemeExplorer aimag={aimag} soums={soums} themeKey="population" />;
}
