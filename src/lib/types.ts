export type Point = { year: number; value: number | null };

export type Cover = {
  school25: number;
  school50: number;
  kg15: number;
  kg30: number;
  road5: number;
  road10: number;
  nat20: number;
};

export type DistStat = { mean: number; median: number; p90: number };

export type Soum = {
  idx: number;
  code: string;
  name: string;
  rank: number;
  grade: string;
  areaKm2: number;
  population: number | null;
  households: number;
  herderHouseholds: number;
  centreHouseholds: number;
  herderPopulation: number;
  centrePopulation: number;
  householdSize: number;
  camps: number;
  schools: number;
  kindergartens: number;
  healthFacilities: number;
  centre: { lon: number; lat: number; name: string; source: string };
  centroid: [number, number];
  popDensity: number | null;
  roadKm: number;
  roadByClass: Record<string, number>;
  roadDensity: number;
  roadPerCapita: number | null;
  pavedKm: number;
  pavedShare: number;
  dSchool: DistStat;
  dRoad: DistStat;
  dNat: DistStat;
  travelH: number;
  bandsSchool: number[];
  bandsKg: number[];
  bandsRoad: number[];
  cover: Cover;
  schoolPer1000: number;
  kgPer1000: number;
  healthPer1000: number;
  schoolIndex: number;
  kgIndex: number;
  healthIndex: number;
  roadIndex: number;
  educationIndex: number;
  socialIndex: number;
  overallIndex: number;
  householdSeries: Point[];
};

export type Band = { labels: string[]; count: number[] };

export type Aimag = {
  code: string;
  name: string;
  areaKm2: number;
  soumCount: number;
  population: number;
  households: number;
  householdYear: number | null;
  herderHouseholds: number;
  camps: number;
  schools: number;
  schoolYear: number | null;
  kindergartens: number;
  kindergartenYear: number | null;
  healthFacilities: number;
  healthYear: number | null;
  roadKm: number;
  roadByClass: Record<string, number>;
  roadDensity: number;
  nationalRoadKm: number;
  populationDensity: number;
  cover: Cover;
  dist: { schoolMean: number; roadMean: number; natMean: number; travelMean: number };
  bands: { school: Band; kindergarten: Band; road: Band };
  series: { schools: Point[]; kindergartens: Point[]; households: Point[] };
  health: { name: string; value: number; year: number; series: Point[] }[];
  livestock: { group: string; value: number; year: number; series: Point[] }[];
  national: {
    schools: { code: string; name: string; value: number }[];
    kindergartens: { code: string; name: string; value: number }[];
    households: { name: string; value: number }[];
  };
};

export type Meta = {
  generatedAt: string;
  webmapId: string;
  webmapUrl: string;
  aimag: string;
  projection: string;
  layers: { key: string; title: string; url: string; role: string }[];
  parameters: {
    bands: { school: number[]; kindergarten: number[]; road: number[] };
    catchment: { school: number; kindergarten: number; health: number };
    grades: string[];
    herderHouseholdsPerCamp: number;
    facilityAllocation: string;
  };
};

export type Camps = {
  n: number;
  lon: number[];
  lat: number[];
  soum: number[];
  dRoad: number[];
  dNat: number[];
  dCentre: number[];
  travelH: number[];
  bandSchool: number[];
  bandKg: number[];
  bandRoad: number[];
};
