import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Rocket,
  Settings,
  LogIn,
  HelpCircle,
  Volume2,
  VolumeX,
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
  | 'command'
  | 'tavern';

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
}

type NpcDef = {
  name: string;
  role: string;
  portrait: string;
  sprite?: string;
  /** Relative body scale — rockfolk big, jellyfolk tiny, teens smaller, etc. */
  scale: number;
  lines: string[];
  action?: WorldAction;
  actionLabel?: string;
};

const NPCS: Record<string, NpcDef> = {
  steward: {
    name: 'Captain Rhea',
    role: 'Hangar Steward',
    portrait: '/town/npc-steward.png',
    sprite: '/town/npc-steward-work.png',
    scale: 1.05,
    lines: [
      'Pads are clear. Suit up if you want — then launch when you are ready.',
      'I keep every launch logged. Make this one worth the ink.',
      'The rocket is waiting. Tap Launch Voyage when your gut says go.',
    ],
    action: 'launch',
    actionLabel: 'Launch Voyage',
  },
  engineer: {
    name: 'Basalt',
    role: 'Workshop Engineer',
    portrait: '/town/npc-engineer.png',
    sprite: '/town/npc-engineer-work.png',
    scale: 1.35,
    lines: [
      'Stone hands, fine tools. Your thrusters will sing after I touch them.',
      'Bring me scrap glow and I will forge upgrades that last.',
      'Want more power on the next jump? Let me tune you up.',
    ],
    action: 'upgrades',
    actionLabel: 'Tune the Ship',
  },
  courier: {
    name: 'Kite',
    role: 'Quest Courier',
    portrait: '/town/npc-courier.png',
    sprite: '/town/npc-courier-work.png',
    scale: 0.82,
    lines: [
      'Fresh scrolls, still warm from the wormhole!',
      'Pick a mission and I will pin it to your log.',
      'If it glows cyan, it is important. Probably.',
    ],
    action: 'quests',
    actionLabel: 'Take a Mission',
  },
  mapkeeper: {
    name: 'Archivist Vesper',
    role: 'Map Keeper',
    portrait: '/town/npc-mapkeeper.png',
    sprite: '/town/npc-mapkeeper-work.png',
    scale: 1.18,
    lines: [
      'The constellations remember every route you have flown.',
      'Align the armillary and the sector map will open.',
      'Stars do not lie. Charts sometimes do — I correct them.',
    ],
    action: 'map',
    actionLabel: 'Open Sector Map',
  },
  trader: {
    name: 'Foxglove',
    role: 'Space Trader',
    portrait: '/town/npc-trader.png',
    sprite: '/town/npc-trader-work.png',
    scale: 1.08,
    lines: [
      'Crates just landed — totally legitimate cosmic surplus.',
      'Buy pretty things. Your planet deserves decorations.',
      'My margins are fair. My smirk is free.',
    ],
    action: 'shop',
    actionLabel: 'Browse the Counter',
  },
  curator: {
    name: 'Commander Indira',
    role: 'Medal Curator',
    portrait: '/town/npc-curator.png',
    sprite: '/town/npc-curator-work.png',
    scale: 0.95,
    lines: [
      'Every medal is a jump that mattered.',
      'The Hall has room for more of your glory.',
      'Polish your pride — then earn another.',
    ],
    action: 'medals',
    actionLabel: 'View Medals',
  },
  gardener: {
    name: 'Bloom',
    role: 'Starlight Gardener',
    portrait: '/town/npc-gardener.png',
    sprite: '/town/npc-gardener-work.png',
    scale: 0.78,
    lines: [
      'The star-daisies bloom brighter after a good voyage.',
      'Harvest when the glow is ripe — never sooner.',
      'Green hands, green planet. That is the whole philosophy.',
    ],
    action: 'garden',
    actionLabel: 'Tend Plants',
  },
  barkeeper: {
    name: 'Marisol',
    role: 'Tavern Keep',
    portrait: '/town/npc-barkeeper.png',
    sprite: '/town/npc-barkeeper-work.png',
    scale: 1.0,
    lines: [
      'Welcome to the Starwell — drinks, gossip, and fair fights.',
      'Want a 2-player match? I will open a table for you.',
      'House rule: no thruster burns indoors.',
    ],
    action: 'arena',
    actionLabel: 'Open a 2P Table',
  },
  challenger: {
    name: 'Mothwing',
    role: 'Arena Challenger',
    portrait: '/town/npc-challenger.png',
    scale: 0.88,
    lines: [
      'Bet you cannot beat my perfect-chain record.',
      '1v1. No excuses. Wings optional.',
      'If you win, the whole tavern hears about it.',
    ],
    action: 'arena',
    actionLabel: 'Challenge 1v1',
  },
  storyteller: {
    name: 'Old Cassian',
    role: 'Retired Navigator',
    portrait: '/town/npc-storyteller.png',
    scale: 1.12,
    lines: [
      'Pull up a stool. I have routes older than this dome.',
      'Start at the Hangar if you want to fly. Start with Kite if you want a mission.',
      'Ask me for lore. Ask Rhea when you are ready to jump.',
    ],
  },
  matchmaker: {
    name: 'Puddle',
    role: 'Matchmaker',
    portrait: '/town/npc-matchmaker.png',
    scale: 0.55,
    lines: [
      'Looking for a co-pilot? I know who is online!',
      'Wave if you want a room code. I am excellent at introductions.',
      'Jelly memory is short, but rivalry is forever.',
    ],
    action: 'arena',
    actionLabel: 'Find a Partner',
  },
};

/** Guided hub loop — one clear next step at a time. */
const FLOW: { id: string; text: string; scene: SceneId; target: string; advanceOn: 'enter' | 'talk' | 'action' }[] = [
  { id: 'meet', text: 'Drag along Hearth Row, then step into the Hangar', scene: 'street', target: 'hangar', advanceOn: 'enter' },
  { id: 'rhea', text: 'Talk to Captain Rhea', scene: 'hangar', target: 'steward', advanceOn: 'talk' },
  { id: 'launch', text: 'Launch a voyage when you are ready — or explore more of town', scene: 'hangar', target: 'steward', advanceOn: 'action' },
  { id: 'mission', text: 'Optional: find Kite (courier) for a mission scroll', scene: 'street', target: 'courier', advanceOn: 'talk' },
  { id: 'tavern', text: 'Optional: visit Starwell Tavern for 2-player games', scene: 'street', target: 'tavern', advanceOn: 'enter' },
];

const SCENES: Record<SceneId, SceneDef> = {
  street: {
    id: 'street',
    name: 'Hearth Row',
    art: '/town/street.png',
    artW: 1584,
    artH: 672,
    ambience: 'Your town. Buildings hold everything — talk to people, not menus.',
    hotspots: [
      { id: 'greenhouse', label: 'Greenhouse', x: 0.13, kind: 'door', to: 'greenhouse' },
      { id: 'shop', label: 'Trade Post', x: 0.24, kind: 'door', to: 'shop' },
      { id: 'bank', label: 'Bank', x: 0.34, kind: 'door', to: 'bank' },
      { id: 'freight', label: 'Freight', x: 0.46, kind: 'door', to: 'warehouse' },
      { id: 'gym', label: 'Gym', x: 0.56, kind: 'door', to: 'gym' },
      { id: 'tavern', label: 'Starwell Tavern', x: 0.64, kind: 'door', to: 'tavern' },
      { id: 'courier', label: 'Kite', x: 0.7, kind: 'npc', npcId: 'courier' },
      { id: 'trophy', label: 'Hall of Honors', x: 0.76, kind: 'door', to: 'trophy' },
      { id: 'hangar', label: 'Launch Hangar', x: 0.86, kind: 'door', to: 'hangar' },
      { id: 'command', label: 'Command', x: 0.95, kind: 'door', to: 'command' },
    ],
  },
  hangar: {
    id: 'hangar',
    name: 'Launch Hangar',
    art: '/town/hangar.png',
    artW: 1376,
    artH: 768,
    ambience: 'Fuel lines hum. Rhea keeps the pad.',
    hotspots: [{ id: 'steward', label: 'Captain Rhea', x: 0.58, kind: 'npc', npcId: 'steward' }],
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Starlight Greenhouse',
    art: '/town/greenhouse.png',
    artW: 1376,
    artH: 768,
    ambience: 'Warm light under the glass dome.',
    hotspots: [{ id: 'gardener', label: 'Bloom', x: 0.55, kind: 'npc', npcId: 'gardener' }],
  },
  shop: {
    id: 'shop',
    name: 'Foxglove’s Trade Post',
    art: '/town/shop.png',
    artW: 1376,
    artH: 768,
    ambience: 'Surplus crates and questionable bargains.',
    hotspots: [{ id: 'trader', label: 'Foxglove', x: 0.5, kind: 'npc', npcId: 'trader' }],
  },
  gym: {
    id: 'gym',
    name: 'Gravity Gym',
    art: '/town/gym.png',
    artW: 1376,
    artH: 768,
    ambience: 'Basalt’s forge-shop smells like hot brass.',
    hotspots: [{ id: 'engineer', label: 'Basalt', x: 0.52, kind: 'npc', npcId: 'engineer' }],
  },
  bank: {
    id: 'bank',
    name: 'First Stellar Bank',
    art: '/town/bank.png',
    artW: 1376,
    artH: 768,
    ambience: 'Quiet counters. Your vault lives here.',
    hotspots: [],
  },
  warehouse: {
    id: 'warehouse',
    name: 'Supply Warehouse',
    art: '/town/warehouse.png',
    artW: 1376,
    artH: 768,
    ambience: 'Crates stacked with geometric perfection.',
    hotspots: [{ id: 'courier', label: 'Kite', x: 0.52, kind: 'npc', npcId: 'courier' }],
  },
  trophy: {
    id: 'trophy',
    name: 'Hall of Honors',
    art: '/town/trophy.png',
    artW: 1376,
    artH: 768,
    ambience: 'Gold on velvet.',
    hotspots: [{ id: 'curator', label: 'Commander Indira', x: 0.5, kind: 'npc', npcId: 'curator' }],
  },
  command: {
    id: 'command',
    name: 'Planetary Command',
    art: '/town/command.png',
    artW: 1376,
    artH: 768,
    ambience: 'Charts and soft alarm light.',
    hotspots: [{ id: 'mapkeeper', label: 'Archivist Vesper', x: 0.55, kind: 'npc', npcId: 'mapkeeper' }],
  },
  tavern: {
    id: 'tavern',
    name: 'Starwell Tavern',
    art: '/town/tavern.png',
    artW: 1376,
    artH: 768,
    ambience: 'Constellation glasses. Someone wants a rematch.',
    hotspots: [
      { id: 'barkeeper', label: 'Marisol', x: 0.26, kind: 'npc', npcId: 'barkeeper' },
      { id: 'challenger', label: 'Mothwing', x: 0.46, kind: 'npc', npcId: 'challenger' },
      { id: 'storyteller', label: 'Old Cassian', x: 0.66, kind: 'npc', npcId: 'storyteller' },
      { id: 'matchmaker', label: 'Puddle', x: 0.84, kind: 'npc', npcId: 'matchmaker' },
    ],
  },
};

export const LivingWorld: React.FC<LivingWorldProps> = ({ savedData, onAction, onToggleAudio }) => {
  const [sceneId, setSceneId] = useState<SceneId>('street');
  const [camX, setCamX] = useState(0);
  const [talk, setTalk] = useState<{ npcId: string; line: number } | null>(null);
  const [flowIdx, setFlowIdx] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, cam: 0, moved: 0, vx: 0 });
  const camRef = useRef(0);
  const scene = SCENES[sceneId];
  const step = FLOW[Math.min(flowIdx, FLOW.length - 1)];

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
    const start = sceneId === 'street' ? Math.min(maxCam * 0.45, maxCam) : maxCam * 0.12;
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

  const advanceFlow = (kind: 'enter' | 'talk' | 'action', id?: string) => {
    const cur = FLOW[flowIdx];
    if (!cur || flowIdx >= FLOW.length - 1) return;
    if (cur.advanceOn !== kind) return;
    if (id && cur.target !== id) return;
    setFlowIdx((i) => Math.min(i + 1, FLOW.length - 1));
  };

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
      advanceFlow('talk', hs.npcId);
      return;
    }
    if (hs.to) {
      setSceneId(hs.to);
      advanceFlow('enter', hs.id);
    }
  };

  const goBack = () => {
    audioEngine.playClick();
    setTalk(null);
    if (sceneId !== 'street') setSceneId('street');
  };

  const runNpcAction = (action: WorldAction) => {
    audioEngine.playClick();
    setTalk(null);
    if (action === 'launch' || action === 'arena') advanceFlow('action', 'steward');
    onAction(action);
  };

  const { worldW } = layout();
  const npc = talk ? NPCS[talk.npcId] : null;

  const focusHotspot = useMemo(() => {
    if (step.scene !== sceneId) return null;
    return scene.hotspots.find((h) => h.id === step.target || h.npcId === step.target) || null;
  }, [step, sceneId, scene.hotspots]);

  // Auto-pan toward current objective target
  useEffect(() => {
    if (!focusHotspot) return;
    const { vw, maxCam } = layout();
    const target = Math.max(0, Math.min(maxCam, focusHotspot.x * worldW - vw * 0.45));
    camRef.current = target;
    setCamX(target);
  }, [focusHotspot, layout, worldW]);

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
        {scene.hotspots.map((hs) => {
          const focused = focusHotspot?.id === hs.id;
          const def = hs.npcId ? NPCS[hs.npcId] : null;
          const bodyScale = def?.scale ?? 1;
          return (
            <button
              key={hs.id}
              type="button"
              onClick={() => tapHotspot(hs)}
              className="absolute -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-auto"
              style={{
                left: hs.x * worldW,
                ...(hs.kind === 'npc' ? { bottom: '4%', top: 'auto' } : { top: '12%' }),
              }}
            >
              {hs.kind === 'door' && (
                <span
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold tracking-wide border backdrop-blur-sm shadow-lg ${
                    focused
                      ? 'bg-cyan-400 text-slate-950 border-cyan-200 animate-pulse'
                      : 'bg-[#070b14]/80 border-amber-300/40 text-amber-50'
                  }`}
                >
                  {focused ? `→ ${hs.label}` : hs.label}
                </span>
              )}
              {hs.kind === 'npc' && def && (
                <>
                  <img
                    src={def.sprite || def.portrait}
                    alt=""
                    draggable={false}
                    className={`w-auto object-contain object-bottom pointer-events-none select-none ${
                      focused ? 'drop-shadow-[0_0_28px_rgba(34,211,238,0.55)]' : 'drop-shadow-[0_14px_28px_rgba(0,0,0,0.65)]'
                    }`}
                    style={{
                      height: `min(${Math.round(48 * bodyScale)}vh, ${Math.round(380 * bodyScale)}px)`,
                      maxWidth: `${Math.round(42 * bodyScale)}vw`,
                    }}
                  />
                  <span
                    className={`mt-0.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      focused
                        ? 'bg-cyan-400 text-slate-950 border-cyan-100 animate-pulse'
                        : 'bg-[#070b14]/80 border-cyan-300/25 text-cyan-50'
                    }`}
                  >
                    {focused ? `→ Talk to ${hs.label}` : hs.label}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Objective trail */}
      <div className="absolute top-3 inset-x-3 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-none max-w-md w-full rounded-2xl bg-[#070b14]/88 border border-cyan-300/30 px-3.5 py-2.5 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="text-[10px] uppercase tracking-[0.14em] text-cyan-300/90 font-semibold">Now</div>
          <div className="text-[13px] font-semibold text-slate-50 leading-snug mt-0.5">{step.text}</div>
          <div className="text-[10px] text-slate-400 mt-1">
            {savedData.totalStars.toLocaleString()} ★ · {(savedData.totalDiamonds || 0).toLocaleString()} ◆ · drag to look · tap glowing cues
          </div>
        </div>
      </div>

      <div className="absolute top-3 left-3 z-30 pointer-events-auto">
        <button
          type="button"
          onClick={goBack}
          className="flex items-center gap-1 bg-[#070b14]/80 border border-white/10 text-slate-100 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl backdrop-blur-md"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {sceneId === 'street' ? 'Town' : 'Street'}
        </button>
      </div>

      <div className="absolute top-3 right-3 z-30 pointer-events-auto flex flex-col items-end gap-1.5">
        <div className="bg-[#070b14]/80 border border-white/10 text-slate-200 text-[10px] font-semibold px-2.5 py-1 rounded-xl backdrop-blur-md">
          {scene.name}
        </div>
        <button
          type="button"
          onClick={() => {
            audioEngine.playClick();
            setMenuOpen((v) => !v);
          }}
          className="bg-[#070b14]/80 border border-white/10 p-1.5 rounded-full text-slate-300"
          aria-label="Account"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
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
          <div className="pointer-events-auto w-full max-w-lg bg-[#070b14]/9 border border-cyan-300/25 rounded-3xl p-3.5 backdrop-blur-md shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-end gap-3">
              <img
                src={npc.portrait}
                alt=""
                className="object-contain object-bottom drop-shadow-lg shrink-0"
                style={{ height: `${Math.round(7.5 * npc.scale)}rem`, width: 'auto', maxWidth: '6.5rem' }}
              />
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-cyan-50">{npc.name}</span>
                  <span className="text-[10px] uppercase tracking-wider text-amber-200/80">{npc.role}</span>
                </div>
                <p className="text-[13px] text-slate-100 mt-1.5 leading-relaxed">
                  “{npc.lines[talk!.line % npc.lines.length]}”
                </p>
              </div>
              <button type="button" onClick={() => setTalk(null)} className="text-slate-500 text-xs font-semibold px-1 self-start">
                Close
              </button>
            </div>
            <div className="mt-2.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => setTalk({ npcId: talk!.npcId, line: talk!.line + 1 })}
                className="flex-1 text-[11px] font-semibold py-2 rounded-xl bg-white/5 text-slate-200"
              >
                Continue
              </button>
              {npc.action && (
                <button
                  type="button"
                  onClick={() => runNpcAction(npc.action!)}
                  className="flex-[1.3] text-[11px] font-semibold py-2 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 flex items-center justify-center gap-1.5"
                >
                  {npc.action === 'launch' && <Rocket className="w-3.5 h-3.5" />}
                  {npc.actionLabel || 'Go'}
                </button>
              )}
            </div>
          </div>
        )}

        {!npc && sceneId === 'hangar' && flowIdx >= 2 && (
          <button
            type="button"
            onClick={() => runNpcAction('launch')}
            className="pointer-events-auto px-5 py-3 rounded-2xl text-sm font-bold flex items-center gap-2 bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-950 shadow-[0_0_28px_rgba(56,189,248,0.4)]"
          >
            <Rocket className="w-4 h-4" />
            Launch Voyage
          </button>
        )}

        {!npc && (
          <p className="text-[10px] italic text-slate-400/90 text-center max-w-[92%] truncate">
            {scene.ambience}
          </p>
        )}
      </div>
    </div>
  );
};
