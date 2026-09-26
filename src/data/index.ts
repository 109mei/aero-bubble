import rawBalance from './balance.json';
import rawCreatures from './creatures.json';
import { BalanceSchema, CreaturesSchema, type Balance, type Creature } from './schema';

/** ルール本体に渡すデータ：数値（balance.json）と仲間の一覧（creatures.json） */
export type GameData = Balance & { creatures: Creature[] };

export function parseGameData(balanceJson: unknown, creaturesJson: unknown): GameData {
  return { ...BalanceSchema.parse(balanceJson), creatures: CreaturesSchema.parse(creaturesJson) };
}

export const gameData: GameData = parseGameData(rawBalance, rawCreatures);

export type { Balance, Condition, Creature } from './schema';
