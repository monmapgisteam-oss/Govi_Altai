import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Aimag, Meta, Soum } from './types';

const DATA = join(process.cwd(), 'public', 'data');

async function read<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(join(DATA, file), 'utf8')) as T;
}

export type NationalRoad = {
  name: string;
  code: string;
  pavement: string;
  status: string;
  load: string;
  owner: string;
  builtYear: number | null;
  lengthKm: number;
};

/** Attribute table of the national roads clipped to the aimag. */
export async function getNationalRoads(): Promise<NationalRoad[]> {
  const fc = await read<{ features: { properties: NationalRoad }[] }>('geo/national-roads.geojson');
  return fc.features.map((f) => f.properties).sort((a, b) => b.lengthKm - a.lengthKm);
}

export const getAimag = () => read<Aimag>('aimag.json');
export const getSoums = () => read<Soum[]>('soums.json');
export const getMeta = () => read<Meta>('meta.json');

export async function getAll() {
  const [aimag, soums, meta] = await Promise.all([getAimag(), getSoums(), getMeta()]);
  return { aimag, soums, meta };
}
