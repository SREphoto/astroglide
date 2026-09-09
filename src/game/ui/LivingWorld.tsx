import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Compass,
  HelpCircle,
  LogIn,
  Map,
  Package,
  Rocket,
  Settings,
  ShoppingBag,
  Sparkles,
  Sprout,
  Swords,
  Trophy,
  User,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { UserSavedData } from '../types/game';
import { audioEngine } from '../core/AudioEngine';

type SceneId =
  | 'street'
  | 'hangar'
  | 'greenhouse'
  | 'shop'
  | 'gym'
  | 'bank'
  | 'warehouse'
  | 'trophy'
  | 'command';

export type WorldAction =
  | 'launch'
  | 'arena'
  | 'wardrobe'
  | 'map'
  | 'garden'
  | 'shop'
  | 'traveler'
  | 'upgrades'
  | 'treasury'
  | 'vault'
  | 'medals'
  | 'badges'
  | 'quests'
  | 'home'
  | 'login'
  | 'docs'
  | 'tutorial';

interface LivingWorldProps {
  savedData: UserSavedData;
  onAction: (action: WorldAction) => void;
  onToggleAudio: () => void;
}

interface Hotspot {
  id: string;
  label: string;
  x: number;
  kind: 'door' | 'npc';
  to?: SceneId;
  npcId?: string;
}

interface SceneDef {
  id: SceneId;
  name: string;
  art: string;
  artW: number;
  artH: number;
  ambience: string;
  hotspots: Hotspot[];
  actions: { id: WorldAction; label: string; icon: React.ReactNode; primary?: boolean }[];
}

const NPCS: Record<string, { name: string; role: string; portrait: string; lines: string[] }> = {
  juno: {
    name: 'Elder Juno',
    role: 'Town Guide',
    portrait: '/town/npc-juno.png',
    lines: [
      'Welcome home. This little rock is ours to grow.',
      'Every voyage you fly brings something back to Hearth Row.',
      'The townsfolk talk of nothing but your last jump. Make it a good story.',
    ],
  },
  nova: {
    name: 'Nova',
    role: 'Mechanic',
    portrait: '/town/npc-nova.png',
    lines: [
      'Ship is fueled and grumpy about it. Ready when you are.',
      'I tuned the thrusters while you were out. She purrs now.',
      'You jump, I fix. That is the deal.',
    ],
  },
  bargo: {
    name: 'Bargo',
    role: 'Shopkeeper',
    portrait: '/town/npc-bargo.png',
    lines: [
      'Fresh stock fell off a wormhole this morning. Totally legal.',
      'Buy something pretty — the planet deserves decorations.',
      'Prices? Fair. My margins? Also fair.',
    ],
  },
  seren: {
    name: 'Seren',
    role: 'Gardener',
    portrait: '/town/npc-seren.png',
    lines: [
      'The star-daisies bloom brighter after a good voyage.',
      'Harvest when the glow is ripe — never sooner.',
      'Green hands, green planet. That is the whole philosophy.',
    ],
  },
  tansy: {
    name: 'Old Tansy',
    role: 'Townsfolk',
    portrait: '/town/npc-tansy.png',
    lines: [
      'Back in my day we orbited uphill both ways.',
      'The dusk on this planet never gets old, dear.',
      'Bring the town something shiny, hmm?',
    ],
  },
  pip: {
    name: 'Pip',
    role: 'Townsfolk',
    portrait: '/town/npc-pip.png',
    lines: [
      'When I grow up I want to jump planets like you!',
      'I saw a comet yesterday. It waved. Probably.',
    ],
  },
  vega: {
    name: 'Coach Vega',
    role: 'Trainer',
    portrait: '/town/npc-vega.png',
    lines: ['One more orbit! Then one more after that!', 'Upgrades are just push-ups for your ship.'],
  },
  quill: {
    name: 'Mr. Quill',
    role: 'Bank Teller',
    portrait: '/town/npc-quill.png',
    lines: ['Deposits are eternal. Withdrawals require paperwork.', 'Your vault is precisely as tidy as I am.'],
  },
  mira: {
    name: 'Mira',
    role: 'Warehouse Keeper',
    portrait: '/town/npc-mira.png',
    lines: ['Aisle one: timber. Aisle two: quartz. Aisle three: my patience.', 'Bring me supplies. I will make them count.'],
  },
  laurel: {
    name: 'Doc Laurel',
    role: 'Curator',
    portrait: '/town/npc-laurel.png',
    lines: ['Every medal tells a jump. Every jump tells a story.', 'The Hall has room for more of your glory.'],
  },
  orion: {
    name: 'Commander Orion',
    role: 'Planetary Officer',
    portrait: '/town/npc-orion.png',
    lines: ['The Command Center tracks every breath of this world.', 'A wise commander reviews the report between voyages.'],
  },
};

const SCENES: Record<SceneId, SceneDef> = {
  street: {
    id: 'street',
    name: 'Hearth Row — Main Street',
    art: '/town/street.png',
    artW: 1584,
    artH: 672,
    ambience: 'Lanterns flicker along Hearth Row as dusk settles over your world.',
    hotspots: [
      { id: 'greenhouse', label: 'Greenhouse', x: 0.13, kind: 'door', to: 'greenhouse' },
      { id: 'shop', label: 'Bargo’s Store', x: 0.24, kind: 'door', to: 'shop' },
      { id: 'bank', label: 'Stellar Bank', x: 0.34, kind: 'door', to: 'bank' },
      { id: 'freight', label: 'Freight Depot', x: 0.46, kind: 'door', to: 'warehouse' },
      { id: 'gym', label: 'Gravity Gym', x: 0.56, kind: 'door', to: 'gym' },
      { id: 'tansy', label: 'Old Tansy', x: 0.64, kind: 'npc', npcId: 'tansy' },
      { id: 'juno', label: 'Elder Juno', x: 0.52, kind: 'npc', npcId: 'juno' },
      { id: 'hangar', label: 'Launch Hangar', x: 0.82, kind: 'door', to: 'hangar' },
      { id: 'trophy', label: 'Hall of Honors', x: 0.72, kind: 'door', to: 'trophy' },
      { id: 'command', label: 'Command', x: 0.93, kind: 'door', to: 'command' },
    ],
    actions: [],
  },
  hangar: {
    id: 'hangar',
    name: 'Launch Hangar',
    art: '/town/hangar.png',
    artW: 1376,
    artH: 768,
    ambience: 'Fuel lines hum. Your rocket waits under the work lights.',
    hotspots: [{ id: 'nova', label: 'Nova', x: 0.62, kind: 'npc', npcId: 'nova' }],
    actions: [
      { id: 'launch', label: 'Launch Voyage', icon: <Rocket className="w-4 h-4" />, primary: true },
      { id: 'arena', label: '1v1 Arena', icon: <Swords className="w-4 h-4" /> },
      { id: 'wardrobe', label: 'Hangar Rack', icon: <User className="w-4 h-4" /> },
      { id: 'map', label: 'Sector Map', icon: <Map className="w-4 h-4" /> },
    ],
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Starlight Greenhouse',
    art: '/town/greenhouse.png',
    artW: 1376,
    artH: 768,
    ambience: 'Warm light filters through the glass dome. Everything smells of growth.',
    hotspots: [{ id: 'seren', label: 'Seren', x: 0.55, kind: 'npc', npcId: 'seren' }],
    actions: [{ id: 'garden', label: 'Tend the Garden', icon: <Sprout className="w-4 h-4" />, primary: true }],
  },
  shop: {
    id: 'shop',
    name: 'Bargo’s Parts Store',
    art: '/town/shop.png',
    artW: 1376,
    artH: 768,
    ambience: 'Shelves glitter with parts, relics and questionable bargains.',
    hotspots: [{ id: 'bargo', label: 'Bargo', x: 0.5, kind: 'npc', npcId: 'bargo' }],
    actions: [
      { id: 'shop', label: 'Browse Wares', icon: <ShoppingBag className="w-4 h-4" />, primary: true },
      { id: 'traveler', label: 'Travelers', icon: <Sparkles className="w-4 h-4" /> },
    ],
  },
  gym: {
    id: 'gym',
    name: 'The Gravity Gym',
    art: '/town/gym.png',
    artW: 1376,
    artH: 768,
    ambience: 'Weights clank. Motivational posters defy gravity.',
    hotspots: [{ id: 'vega', label: 'Coach Vega', x: 0.52, kind: 'npc', npcId: 'vega' }],
    actions: [{ id: 'upgrades', label: 'Train & Upgrade', icon: <Zap className="w-4 h-4" />, primary: true }],
  },
  bank: {
    id: 'bank',
    name: 'First Stellar Bank',
    art: '/town/bank.png',
    artW: 1376,
    artH: 768,
    ambience: 'Marble counters, polite silence, extremely organized coins.',
    hotspots: [{ id: 'quill', label: 'Mr. Quill', x: 0.5, kind: 'npc', npcId: 'quill' }],
    actions: [{ id: 'treasury', label: 'View Treasury', icon: <Sparkles className="w-4 h-4" />, primary: true }],
  },
  warehouse: {
    id: 'warehouse',
    name: 'Supply Warehouse',
    art: '/town/warehouse.png',
    artW: 1376,
    artH: 768,
    ambience: 'Crates stacked with geometric perfection.',
    hotspots: [{ id: 'mira', label: 'Mira', x: 0.52, kind: 'npc', npcId: 'mira' }],
    actions: [{ id: 'vault', label: 'Open Supply Vault', icon: <Package className="w-4 h-4" />, primary: true }],
  },
  trophy: {
    id: 'trophy',
    name: 'Hall of Honors',
    art: '/town/trophy.png',
    artW: 1376,
    artH: 768,
    ambience: 'Gold glimmers on velvet. Your deeds, framed.',
    hotspots: [{ id: 'laurel', label: 'Doc Laurel', x: 0.5, kind: 'npc', npcId: 'laurel' }],
    actions: [
      { id: 'medals', label: 'Medal Chest', icon: <Award className="w-4 h-4" />, primary: true },
      { id: 'badges', label: 'Badges', icon: <Trophy className="w-4 h-4" /> },
    ],
  },
  command: {
    id: 'command',
    name: 'Planetary Command',
    art: '/town/command.png',
    artW: 1376,
    artH: 768,
    ambience: 'Screens track growth, atmosphere and threats across your whole world.',
    hotspots: [{ id: 'orion', label: 'Commander Orion', x: 0.55, kind: 'npc', npcId: 'orion' }],
    actions: [
      { id: 'home', label: 'World Operations', icon: <Compass className="w-4 h-4" />, primary: true },
      { id: 'quests', label: 'Mission Log', icon: <Map className="w-4 h-4" /> },
    ],
  },
};

export const LivingWorld: React.FC<LivingWorldProps> = ({ savedData, onAction, onToggleAudio }) => {
  const [sceneId, setSceneId] = useState<SceneId>('street');
  const [camX, setCamX] = useState(0);
  const [talk, setTalk] = useState<{ npcId: string; line: number } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, cam: 0, moved: 0, vx: 0 });
  const camRef = useRef(0);
  const scene = SCENES[sceneId];

  const layout = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return { vw: 430, vh: 932, scale: 1, worldW: scene.artW, maxCam: 0 };
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = vh / scene.artH;
    const worldW = scene.artW * scale;
    const maxCam = Math.max(0, worldW - vw);
    return { vw, vh, scale, worldW, maxCam };
  }, [scene.artH, scene.artW]);

  useEffect(() => {
    camRef.current = 0;
    setCamX(0);
    setTalk(null);
    const { maxCam } = layout();
    const start = sceneId === 'street' ? Math.min(maxCam * 0.35, maxCam) : maxCam * 0.15;
    camRef.current = start;
    setCamX(start);
  }, [sceneId, layout]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const d = drag.current;
      if (!d.active && Math.abs(d.vx) > 0.15) {
        const { maxCam } = layout();
        camRef.current = Math.max(0, Math.min(maxCam, camRef.current + d.vx));
        d.vx *= 0.92;
        setCamX(camRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [layout]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { active: true, x: e.clientX, cam: camRef.current, moved: 0, vx: 0 };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.active) return;
    const dx = e.clientX - d.x;
    d.moved += Math.abs(dx);
    const { maxCam } = layout();
    camRef.current = Math.max(0, Math.min(maxCam, d.cam - dx));
    d.vx = -dx * 0.35;
    setCamX(camRef.current);
  };

  const onPointerUp = () => {
    drag.current.active = false;
  };

  const tapHotspot = (hs: Hotspot) => {
    if (drag.current.moved > 12) return;
    audioEngine.playClick();
    if (hs.kind === 'npc' && hs.npcId) {
      setTalk({ npcId: hs.npcId, line: 0 });
      return;
    }
    if (hs.to) {
      setSceneId(hs.to);
      setHint(SCENES[hs.to].ambience);
    }
  };

  const goBack = () => {
    audioEngine.playClick();
    setTalk(null);
    if (sceneId === 'street') {
      setHint('Drag to look around · tap a doorway to step inside');
      return;
    }
    setSceneId('street');
  };

  const { worldW } = layout();
  const npc = talk ? NPCS[talk.npcId] : null;

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 z-20 bg-[#070b14] text-white overflow-hidden select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="absolute top-0 bottom-0 will-change-transform"
        style={{
          width: worldW,
          height: '100%',
          transform: `translate3d(${-camX}px,0,0)`,
        }}
      >
        <img
          src={scene.art}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover object-center pointer-events-none"
          style={{ width: worldW, height: '100%', maxWidth: 'none' }}
        />
        {scene.hotspots.map((hs) => (
          <button
            key={hs.id}
            type="button"
            onClick={() => tapHotspot(hs)}
            className="absolute -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-auto"
            style={{
              left: hs.x * worldW,
              top: hs.kind === 'npc' ? '58%' : '18%',
            }}
          >
            {hs.kind === 'door' && (
              <span className="px-2.5 py-1 rounded-full bg-[#070b14]/80 border border-amber-300/35 text-[10px] font-semibold tracking-wide uppercase text-amber-100 shadow-[0_0_18px_rgba(251,191,36,0.25)] backdrop-blur-sm">
                {hs.label}
              </span>
            )}
            {hs.kind === 'npc' && (
              <span className="px-2 py-0.5 rounded-full bg-[#070b14]/75 border border-white/15 text-[10px] text-slate-100">
                {hs.label}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="absolute top-0 inset-x-0 z-30 flex items-start justify-between p-3 pointer-events-none">
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={goBack}
            className="flex items-center gap-1 bg-[#070b14]/80 border border-white/10 text-slate-100 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl backdrop-blur-md"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {sceneId === 'street' ? 'Look around' : 'Street'}
          </button>
        </div>
        <div className="flex flex-col items-end gap-1.5 pointer-events-auto">
          <div className="bg-[#070b14]/80 border border-white/10 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-xl backdrop-blur-md">
            {scene.name}
          </div>
          <div className="flex items-center gap-1">
            <span className="bg-[#070b14]/80 border border-amber-400/30 text-amber-200 text-[10px] font-semibold px-2 py-1 rounded-full">
              {savedData.totalStars.toLocaleString()} ★
            </span>
            <span className="bg-[#070b14]/80 border border-sky-400/30 text-sky-200 text-[10px] font-semibold px-2 py-1 rounded-full">
              {(savedData.totalDiamonds || 0).toLocaleString()} ◆
            </span>
            <button
              type="button"
              onClick={() => {
                audioEngine.playClick();
                setMenuOpen((v) => !v);
              }}
              className="bg-[#070b14]/80 border border-white/10 p-1.5 rounded-full text-slate-300"
              aria-label="More"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {menuOpen && (
        <div className="absolute top-14 right-3 z-40 w-44 rounded-2xl bg-[#070b14]/95 border border-white/10 p-1.5 backdrop-blur-md">
          {[
            { id: 'login' as const, label: 'Account', icon: <LogIn className="w-3.5 h-3.5" /> },
            { id: 'docs' as const, label: 'Guide', icon: <HelpCircle className="w-3.5 h-3.5" /> },
            { id: 'tutorial' as const, label: 'How to jump', icon: <HelpCircle className="w-3.5 h-3.5" /> },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onAction(item.id);
              }}
              className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] text-slate-200 hover:bg-white/5"
            >
              {item.icon}
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onToggleAudio();
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12px] text-slate-200 hover:bg-white/5"
          >
            {savedData.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            {savedData.soundEnabled ? 'Sound on' : 'Sound off'}
          </button>
        </div>
      )}

      <div className="absolute bottom-3 inset-x-0 z-30 flex flex-col items-center gap-2 px-3 pointer-events-none">
        {npc && (
          <div className="pointer-events-auto w-full max-w-md bg-[#070b14]/92 border border-white/12 rounded-2xl p-3 backdrop-blur-md shadow-2xl">
            <div className="flex items-start gap-2.5">
              <img src={npc.portrait} alt="" className="w-12 h-12 rounded-xl object-cover object-top border border-white/10" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-semibold">{npc.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400">{npc.role}</span>
                </div>
                <p className="text-[12px] text-slate-200 mt-1 leading-relaxed">“{npc.lines[talk!.line % npc.lines.length]}”</p>
              </div>
              <button
                type="button"
                onClick={() => setTalk(null)}
                className="text-slate-500 text-xs font-semibold px-1"
              >
                Close
              </button>
            </div>
            <button
              type="button"
              onClick={() => setTalk({ npcId: talk!.npcId, line: talk!.line + 1 })}
              className="mt-2 w-full text-[11px] font-semibold py-1.5 rounded-xl bg-white/5 text-slate-200"
            >
              Continue
            </button>
          </div>
        )}

        {scene.actions.length > 0 && !npc && (
          <div className="pointer-events-auto flex flex-wrap gap-1.5 justify-center max-w-md">
            {scene.actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  audioEngine.playClick();
                  onAction(a.id);
                }}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                  a.primary
                    ? 'bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 shadow-lg'
                    : 'bg-[#070b14]/85 border border-white/15 text-slate-100 backdrop-blur-md'
                }`}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        )}

        <p className="text-[10px] italic text-slate-400/90 text-center max-w-[90%] truncate pointer-events-none">
          {hint || scene.ambience} · drag to look around
        </p>
      </div>
    </div>
  );
};
