import rawWilayas from './algeria-data.json';

export interface Daira {
  name: string;
  communes: string[];
}

export interface Wilaya {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  dairas: Daira[];
}

export const ALGERIA_WILAYAS: Wilaya[] = rawWilayas as Wilaya[];

export function getWilayas(): Wilaya[] {
  return ALGERIA_WILAYAS;
}

export function getWilayaById(id: number | string): Wilaya | undefined {
  const numId = typeof id === 'string' ? parseInt(id, 10) : id;
  return ALGERIA_WILAYAS.find((w) => w.id === numId || w.code === String(id).padStart(2, '0'));
}

export function getDairas(wilayaId: number | string): Daira[] {
  const w = getWilayaById(wilayaId);
  return w ? w.dairas : [];
}

export function getCommunes(wilayaId: number | string, dairaName: string): string[] {
  const dairas = getDairas(wilayaId);
  const found = dairas.find((d) => d.name === dairaName);
  return found ? found.communes : [];
}
