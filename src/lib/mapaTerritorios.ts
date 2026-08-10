// Posição de cada território sobre a imagem /mapa-geral.jpg
//
// Os valores são PORCENTAGEM da imagem (0 a 100), não pixels — assim a área
// clicável acompanha o mapa em qualquer tamanho de tela.
//
// Estes são apenas os valores de fábrica, medidos a olho sobre o desenho.
// Dentro do painel existe o modo "Calibrar", que salva os ajustes na tabela
// territorio_mapa e passa a ter preferência sobre o que está aqui.

export type RegiaoMapa = { x: number; y: number; w: number; h: number };

// A chave é o número do território (o "01" de "TERRITÓRIO 01").
export const REGIOES_PADRAO: Record<string, RegiaoMapa> = {
  '01': { x: 16.5, y: 10.0, w: 18.8, h: 9.6 },
  '02': { x: 15.9, y: 20.1, w: 19.4, h: 9.2 },
  '03': { x: 14.9, y: 30.8, w: 20.4, h: 9.7 },
  '04': { x: 12.9, y: 41.7, w: 21.7, h: 6.6 },
  '05': { x: 9.7, y: 49.1, w: 22.7, h: 16.5 },
  '06': { x: 35.9, y: 10.2, w: 14.3, h: 9.1 },
  '07': { x: 35.9, y: 20.1, w: 14.3, h: 9.2 },
  '08': { x: 35.9, y: 30.5, w: 14.3, h: 10.0 },
  '09': { x: 35.9, y: 41.7, w: 14.3, h: 6.6 },
  '10': { x: 35.6, y: 49.1, w: 14.6, h: 9.9 },
  '11': { x: 50.8, y: 9.9, w: 14.6, h: 9.4 },
  '12': { x: 50.8, y: 20.1, w: 14.6, h: 9.2 },
  '13': { x: 50.8, y: 30.5, w: 14.6, h: 10.0 },
  '14': { x: 50.8, y: 41.7, w: 14.6, h: 15.3 },
  '15': { x: 68.6, y: 16.5, w: 15.5, h: 9.7 },
  '16': { x: 70.2, y: 27.2, w: 15.2, h: 9.4 },
  '17': { x: 70.6, y: 37.2, w: 15.5, h: 11.7 },
  '18': { x: 71.2, y: 52.4, w: 17.8, h: 10.7 },
  '19': { x: 45.0, y: 59.5, w: 19.0, h: 6.0 },
  '20': { x: 52.4, y: 66.2, w: 17.2, h: 11.7 },
  '21': { x: 38.8, y: 69.7, w: 19.5, h: 12.7 },
  '22': { x: 45.3, y: 79.4, w: 22.7, h: 12.2 },
};

// "TERRITÓRIO 05" -> "05".  Aceita variações tipo "Território 5" ou "T 05".
export function numeroDoTerritorio(nome: string): string | null {
  const m = String(nome ?? '').match(/(\d+)\s*$/);
  if (!m) return null;
  return m[1].padStart(2, '0');
}

export function regiaoPadrao(nome: string): RegiaoMapa | null {
  const num = numeroDoTerritorio(nome);
  return num ? (REGIOES_PADRAO[num] ?? null) : null;
}
