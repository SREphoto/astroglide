import type {
  InventoryEntry,
  JetpackModule,
  JetpackModuleId,
  PlanetNpc,
  RareItem,
  RareItemId,
} from '../types/game';

export const RARE_ITEMS: RareItem[] = [
  {
    id: 'STARHEART',
    name: 'Starheart Fragment',
    description: 'A crystallized core of a dying sun. Unique. Kept forever.',
    rarity: 'LEGENDARY',
    color: '#facc15',
    unique: true,
  },
  {
    id: 'VOID_PEARL',
    name: 'Void Pearl',
    description: 'A cold pearl that drank a pocket of darkness.',
    rarity: 'EPIC',
    color: '#a855f7',
    unique: false,
  },
  {
    id: 'COMET_FEATHER',
    name: 'Comet Feather',
    description: 'Plume from a comet’s tail, still warm to the touch.',
    rarity: 'RARE',
    color: '#fb923c',
    unique: false,
  },
  {
    id: 'PRISM_SHARD',
    name: 'Prism Shard',
    description: 'Splits starlight into a pocket rainbow.',
    rarity: 'RARE',
    color: '#22d3ee',
    unique: false,
  },
  {
    id: 'ANCIENT_MAP',
    name: 'Ancient Star Map',
    description: 'Brass tablet hinting at secret moon bridges.',
    rarity: 'EPIC',
    color: '#f59e0b',
    unique: true,
  },
  {
    id: 'GRAVITY_CORE',
    name: 'Gravity Anomaly Core',
    description: 'A ringed orb that tugs gently toward nearby worlds.',
    rarity: 'EPIC',
    color: '#eab308',
    unique: false,
  },
  {
    id: 'PHOENIX_EMBER',
    name: 'Phoenix Ember',
    description: 'A coal that will not go out. Warm against the void.',
    rarity: 'LEGENDARY',
    color: '#f97316',
    unique: true,
  },
  {
    id: 'MOON_SILK',
    name: 'Moon Silk',
    description: 'Pearlescent ribbon spun on a silent moon loom.',
    rarity: 'RARE',
    color: '#e2e8f0',
    unique: false,
  },
];

export const JETPACK_MODULES: JetpackModule[] = [
  {
    id: 'VECTOR_FINS',
    name: 'Vector Fins',
    description: 'Steer in mid-jump with A/D, swipe, or phone tilt.',
    priceStars: 900,
    priceDiamonds: 28,
    color: '#38bdf8',
  },
  {
    id: 'FUEL_CORE',
    name: 'Clockwork Fuel Core',
    description: '+2 jetpack charges at the start of every voyage.',
    priceStars: 650,
    priceDiamonds: 18,
    color: '#fbbf24',
  },
  {
    id: 'GRAV_TRIM',
    name: 'Grav-Trim Gyros',
    description: 'Cuts incoming gravity by 15% so jumps fly farther.',
    priceStars: 1100,
    priceDiamonds: 32,
    color: '#a78bfa',
  },
  {
    id: 'AFTERBURNER',
    name: 'Afterburner Nozzle',
    description: '+28% jetpack rescue thrust toward the next world.',
    priceStars: 800,
    priceDiamonds: 22,
    color: '#fb7185',
  },
];

export const MERCHANT_NAMES = ['Pip the Stardrifter', 'Old Helix', 'Marrow the Haggler', 'Sable Quill'];
export const MECHANIC_NAMES = ['Wren Forge', 'Cal the Tuner', 'Nix Spanner', 'Juno Coil'];

export type TraderStockId =
  | 'MAGNET_SHOT'
  | 'COMET_VIAL'
  | 'ICE_SHELL'
  | 'MYSTERY_RARE'
  | 'REFUEL'
  | JetpackModuleId;

export interface TraderStockItem {
  id: TraderStockId;
  name: string;
  description: string;
  priceStars: number;
  priceDiamonds?: number;
  kind: 'TEMP' | 'REFUEL' | 'MODULE' | 'RARE';
  merchant: boolean;
  mechanic: boolean;
}

export const TRADER_STOCK: TraderStockItem[] = [
  {
    id: 'MAGNET_SHOT',
    name: 'Magnet Shot',
    description: 'Temporary star magnet for this voyage.',
    priceStars: 40,
    kind: 'TEMP',
    merchant: true,
    mechanic: false,
  },
  {
    id: 'COMET_VIAL',
    name: 'Comet Vial',
    description: 'Burst of comet speed and void pushback.',
    priceStars: 55,
    kind: 'TEMP',
    merchant: true,
    mechanic: false,
  },
  {
    id: 'ICE_SHELL',
    name: 'Ice Shell',
    description: 'A brief freeze-proof aura.',
    priceStars: 70,
    kind: 'TEMP',
    merchant: true,
    mechanic: false,
  },
  {
    id: 'MYSTERY_RARE',
    name: 'Sealed Relic',
    description: 'A random rare for your keep-forever inventory.',
    priceStars: 180,
    kind: 'RARE',
    merchant: true,
    mechanic: false,
  },
  {
    id: 'REFUEL',
    name: 'Jetpack Refuel',
    description: '+1 jetpack charge for this voyage.',
    priceStars: 90,
    kind: 'REFUEL',
    merchant: false,
    mechanic: true,
  },
  ...JETPACK_MODULES.map((m) => ({
    id: m.id,
    name: m.name,
    description: m.description,
    priceStars: m.priceStars,
    priceDiamonds: m.priceDiamonds,
    kind: 'MODULE' as const,
    merchant: false,
    mechanic: true,
  })),
];

export function getRareItem(id: RareItemId): RareItem | undefined {
  return RARE_ITEMS.find((r) => r.id === id);
}

export function addRareToInventory(inv: InventoryEntry[] | undefined, id: RareItemId): InventoryEntry[] {
  const next = (inv || []).map((e) => ({ ...e }));
  const def = getRareItem(id);
  const existing = next.find((e) => e.id === id);
  if (existing) {
    if (def?.unique) return next;
    existing.count += 1;
    return next;
  }
  next.push({ id, count: 1 });
  return next;
}

export function inventoryHas(inv: InventoryEntry[] | undefined, id: RareItemId): boolean {
  return (inv || []).some((e) => e.id === id && e.count > 0);
}

export function hasJetpackModule(modules: JetpackModuleId[] | undefined, id: JetpackModuleId): boolean {
  return (modules || []).includes(id);
}

export function makeNpc(kind: PlanetNpc['kind'], index: number, angle: number): PlanetNpc {
  const names = kind === 'MERCHANT' ? MERCHANT_NAMES : MECHANIC_NAMES;
  return {
    id: `npc_${kind}_${index}`,
    kind,
    name: names[Math.abs(index) % names.length],
    angle,
  };
}
