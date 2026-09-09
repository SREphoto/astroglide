import React from 'react';
import { X, Star, Gem, Fuel, Sparkles } from 'lucide-react';
import { PlanetNpc, UserSavedData, JetpackModuleId } from '../types/game';
import { TRADER_STOCK, TraderStockItem, hasJetpackModule } from '../core/Catalog';
import { NPC_SPRITES } from '../core/SpriteAtlas';
import { ItemSprite } from '../components/ItemSprite';

interface TraderModalProps {
  npc: PlanetNpc;
  savedData: UserSavedData;
  jetpackCharges: number;
  onBuy: (item: TraderStockItem, payWith: 'stars' | 'diamonds') => void;
  onClose: () => void;
}

export const TraderModal: React.FC<TraderModalProps> = ({
  npc,
  savedData,
  jetpackCharges,
  onBuy,
  onClose,
}) => {
  const isMech = npc.kind === 'MECHANIC';
  const stock = TRADER_STOCK.filter((s) => (isMech ? s.mechanic : s.merchant));
  const modules = savedData.unlockedJetpackModules || [];

  return (
    <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 text-white ui-interactive">
      <div className="bg-slate-900/95 border border-white/10 rounded-3xl w-full max-w-sm max-h-[92%] overflow-y-auto p-5 shadow-2xl space-y-4 animate-modal-entrance">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-slate-950 border border-white/10 overflow-hidden shrink-0">
              <ItemSprite
                src={NPC_SPRITES[npc.kind]}
                fallback={isMech ? '🔧' : '🧳'}
                className="w-14 h-14 object-contain"
                alt={npc.name}
              />
            </div>
            <div>
              <div className="text-[10px] tracking-[0.18em] uppercase text-sky-300/80 font-semibold">
                {isMech ? 'Field mechanic' : 'Wandering merchant'}
              </div>
              <h2 className="text-lg font-semibold text-white leading-tight">{npc.name}</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {isMech ? 'Refuel and expensive jetpack work.' : 'Temporary shots and sealed relics.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-slate-300"
            aria-label="Close trader"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-full text-amber-300 font-semibold flex items-center gap-1">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            {savedData.totalStars}
          </span>
          <span className="bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-full text-sky-300 font-semibold flex items-center gap-1">
            <Gem className="w-3 h-3 fill-sky-400 text-sky-400" />
            {savedData.totalDiamonds}
          </span>
          {isMech && (
            <span className="bg-slate-950/70 border border-slate-800 px-2.5 py-1 rounded-full text-rose-300 font-semibold flex items-center gap-1">
              <Fuel className="w-3 h-3" />
              {jetpackCharges}
            </span>
          )}
        </div>

        <div className="space-y-2">
          {stock.map((item) => {
            const owned = item.kind === 'MODULE' && hasJetpackModule(modules, item.id as JetpackModuleId);
            const canStars = savedData.totalStars >= item.priceStars;
            const canGems = item.priceDiamonds != null && savedData.totalDiamonds >= item.priceDiamonds;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2.5 flex items-start justify-between gap-2"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-sky-100 flex items-center gap-1.5">
                    {item.kind === 'RARE' && <Sparkles className="w-3.5 h-3.5 text-amber-300" />}
                    {item.name}
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">{item.description}</div>
                  {owned && <div className="text-[10px] text-emerald-400 mt-0.5 font-semibold">Installed</div>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    disabled={owned || !canStars}
                    onClick={() => onBuy(item, 'stars')}
                    className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed min-h-11 min-w-[4.5rem]"
                  >
                    {item.priceStars} ★
                  </button>
                  {item.priceDiamonds != null && (
                    <button
                      disabled={owned || !canGems}
                      onClick={() => onBuy(item, 'diamonds')}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-sky-400 text-slate-950 disabled:opacity-40 disabled:cursor-not-allowed min-h-11"
                    >
                      {item.priceDiamonds} ◆
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
