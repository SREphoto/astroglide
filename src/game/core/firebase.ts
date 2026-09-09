/**
 * Local-first stand-in for the original Firebase layer.
 * Auth, cloud saves, leaderboards, home planet, and 1v1 rooms persist in
 * this browser (localStorage + BroadcastChannel). No remote backend.
 */

import { UserSavedData } from '../types/game';
import { RoomData, PlayerOnlineState, TrapInfo } from '../types/multiplayer';

const SESSION_KEY = 'COSMIC_EXPLORER_SESSION';
const ACCOUNTS_KEY = 'COSMIC_EXPLORER_ACCOUNTS';
const SAVES_KEY = 'COSMIC_EXPLORER_CLOUD_SAVES';
const LEADERBOARD_KEY = 'COSMIC_EXPLORER_LEADERBOARD';
const DAILY_LB_KEY = 'COSMIC_EXPLORER_DAILY_LB';
const HOME_PLANET_KEY = 'COSMIC_EXPLORER_HOME_PLANETS';
const ROOMS_KEY = 'COSMIC_EXPLORER_ROOMS';

export interface User {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  isAnonymous: boolean;
}

interface LocalAccount {
  uid: string;
  email: string;
  passwordHash: string;
  displayName: string;
}

type AuthListener = (user: User | null) => void;
const authListeners = new Set<AuthListener>();
const roomListeners = new Map<string, Set<(room: RoomData | null) => void>>();

function canStore(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

function readJson<T>(key: string, fallback: T): T {
  if (!canStore()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  if (!canStore()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('Local persist failed', e);
  }
}

function hashPassword(password: string): string {
  let hash = 2166136261;
  for (let i = 0; i < password.length; i++) {
    hash ^= password.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function explorerCallsign(): string {
  const ranks = ['Cadet', 'Pilot', 'Commander', 'Navigator', 'Ranger'];
  const names = ['Lyra', 'Orion', 'Vega', 'Nova', 'Sol', 'Io', 'Kepler', 'Atlas'];
  const rank = ranks[Math.floor(Math.random() * ranks.length)];
  const name = names[Math.floor(Math.random() * names.length)];
  return `${rank} ${name}`;
}

let currentUser: User | null = null;
if (canStore()) {
  currentUser = readJson<User | null>(SESSION_KEY, null);
}

function setCurrentUser(user: User | null) {
  currentUser = user;
  if (user) writeJson(SESSION_KEY, user);
  else if (canStore()) localStorage.removeItem(SESSION_KEY);
  authListeners.forEach((cb) => cb(currentUser));
}

export const auth = {
  get currentUser(): User | null {
    return currentUser;
  },
};

function notifyRooms(roomId: string, room: RoomData | null) {
  const listeners = roomListeners.get(roomId);
  if (listeners) listeners.forEach((cb) => cb(room));
}

function loadRooms(): Record<string, RoomData> {
  return readJson<Record<string, RoomData>>(ROOMS_KEY, {});
}

function saveRooms(rooms: Record<string, RoomData>) {
  writeJson(ROOMS_KEY, rooms);
}

function getRoom(roomId: string): RoomData | null {
  return loadRooms()[roomId] ?? null;
}

function putRoom(room: RoomData) {
  const rooms = loadRooms();
  rooms[room.id] = room;
  saveRooms(rooms);
  notifyRooms(room.id, room);
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const ch = new BroadcastChannel('cosmic-explorer-rooms');
      ch.postMessage({ type: 'room', room });
      ch.close();
    }
  } catch {
    /* ignore */
  }
}

function deleteRoom(roomId: string) {
  const rooms = loadRooms();
  delete rooms[roomId];
  saveRooms(rooms);
  notifyRooms(roomId, null);
}

if (typeof window !== 'undefined') {
  try {
    const ch = new BroadcastChannel('cosmic-explorer-rooms');
    ch.onmessage = (ev: MessageEvent) => {
      const data = ev.data as { type?: string; room?: RoomData };
      if (data?.type === 'room' && data.room) {
        notifyRooms(data.room.id, data.room);
      }
    };
  } catch {
    /* ignore */
  }
}

export class FirebaseService {
  public static onAuthChange(callback: (user: User | null) => void): () => void {
    authListeners.add(callback);
    callback(currentUser);
    return () => {
      authListeners.delete(callback);
    };
  }

  public static async signInWithGoogle(): Promise<User | null> {
    const user: User = {
      uid: randomId('google'),
      displayName: explorerCallsign(),
      photoURL: null,
      email: null,
      isAnonymous: false,
    };
    setCurrentUser(user);
    await this.syncUserProfile(user);
    return user;
  }

  public static async signInWithEmail(email: string, pass: string): Promise<User | null> {
    const accounts = readJson<Record<string, LocalAccount>>(ACCOUNTS_KEY, {});
    const key = email.trim().toLowerCase();
    const account = accounts[key];
    if (!account || account.passwordHash !== hashPassword(pass)) {
      throw new Error('Invalid email or password.');
    }
    const user: User = {
      uid: account.uid,
      displayName: account.displayName,
      photoURL: null,
      email: account.email,
      isAnonymous: false,
    };
    setCurrentUser(user);
    await this.syncUserProfile(user);
    return user;
  }

  public static async registerWithEmail(
    email: string,
    pass: string,
    displayName?: string,
  ): Promise<User | null> {
    const accounts = readJson<Record<string, LocalAccount>>(ACCOUNTS_KEY, {});
    const key = email.trim().toLowerCase();
    if (accounts[key]) {
      throw new Error('An explorer already uses that email.');
    }
    const account: LocalAccount = {
      uid: randomId('pilot'),
      email: key,
      passwordHash: hashPassword(pass),
      displayName: displayName?.trim() || explorerCallsign(),
    };
    accounts[key] = account;
    writeJson(ACCOUNTS_KEY, accounts);
    const user: User = {
      uid: account.uid,
      displayName: account.displayName,
      photoURL: null,
      email: account.email,
      isAnonymous: false,
    };
    setCurrentUser(user);
    await this.syncUserProfile(user);
    return user;
  }

  public static async signInGuest(): Promise<User | null> {
    const existing = currentUser;
    if (existing?.isAnonymous) return existing;
    const user: User = {
      uid: randomId('guest'),
      displayName: 'Cosmic Cadette',
      photoURL: null,
      email: null,
      isAnonymous: true,
    };
    setCurrentUser(user);
    return user;
  }

  public static async signOut(): Promise<void> {
    setCurrentUser(null);
  }

  public static async syncUserProfile(_user: User, _stats?: Partial<UserSavedData>): Promise<void> {
    return;
  }

  public static async saveGameToCloud(userId: string, savedData: UserSavedData): Promise<boolean> {
    const saves = readJson<Record<string, UserSavedData>>(SAVES_KEY, {});
    saves[userId] = savedData;
    writeJson(SAVES_KEY, saves);
    return true;
  }

  public static async loadGameFromCloud(userId: string): Promise<UserSavedData | null> {
    const saves = readJson<Record<string, UserSavedData>>(SAVES_KEY, {});
    return saves[userId] ?? null;
  }

  public static async submitLeaderboard(entry: {
    userId: string;
    displayName: string;
    photoURL?: string;
    score: number;
    altitude: number;
    maxCombo: number;
    costumeId: string;
    rocketSkinId: string;
  }): Promise<void> {
    const board = readJson<typeof entry[]>(LEADERBOARD_KEY, []);
    const next = board.filter((e) => e.userId !== entry.userId);
    next.push(entry);
    next.sort((a, b) => b.score - a.score);
    writeJson(LEADERBOARD_KEY, next.slice(0, 50));
  }

  public static async getTopScores(limitCount = 20) {
    const board = readJson<Array<Record<string, unknown>>>(LEADERBOARD_KEY, []);
    return board.slice(0, limitCount);
  }

  public static generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  public static async createMatchRoom(
    hostUser: User,
    mode: 'BATTLE' | 'RACE',
    initialState: Partial<PlayerOnlineState>,
  ): Promise<RoomData> {
    const roomId = randomId('room');
    const roomCode = this.generateRoomCode();
    const seed = Math.floor(Math.random() * 1000000);

    const hostParticipant = {
      userId: hostUser.uid,
      displayName: hostUser.displayName || 'Cosmic Host',
      photoURL: hostUser.photoURL || '',
      color: '#38bdf8',
    };

    const hostFullState: PlayerOnlineState = {
      userId: hostUser.uid,
      displayName: hostParticipant.displayName,
      photoURL: hostParticipant.photoURL,
      costumeId: initialState.costumeId || 'ASTRONAUT',
      rocketSkinId: initialState.rocketSkinId || 'APOLLO',
      color: hostParticipant.color,
      currentPlanetIndex: 0,
      altitude: 0,
      score: 0,
      shields: 100,
      trapsAvailable: 3,
      planetsClaimedCount: 0,
      isReady: true,
      lastPing: Date.now(),
      ...initialState,
    };

    const room: RoomData = {
      id: roomId,
      roomCode,
      mode,
      status: 'WAITING',
      host: hostParticipant,
      guest: null,
      seed,
      targetAltitude: mode === 'RACE' ? 3500 : 2500,
      claimedPlanets: {},
      traps: {},
      hostState: hostFullState,
      guestState: null,
      events: [
        {
          id: randomId('ev'),
          type: 'EMOTE',
          message: `${hostParticipant.displayName} created a ${mode} room!`,
          timestamp: Date.now(),
          userId: hostUser.uid,
        },
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    putRoom(room);
    return room;
  }

  public static async joinRoomByCode(
    roomCode: string,
    guestUser: User,
    initialState: Partial<PlayerOnlineState>,
  ): Promise<RoomData | null> {
    const rooms = Object.values(loadRooms());
    const found = rooms.find(
      (r) => r.roomCode?.toUpperCase() === roomCode.toUpperCase() && r.status === 'WAITING',
    );
    if (!found) return null;
    if (found.host.userId === guestUser.uid) return found;

    const guestParticipant = {
      userId: guestUser.uid,
      displayName: guestUser.displayName || 'Cosmic Challenger',
      photoURL: guestUser.photoURL || '',
      color: '#f43f5e',
    };

    const guestFullState: PlayerOnlineState = {
      userId: guestUser.uid,
      displayName: guestParticipant.displayName,
      photoURL: guestParticipant.photoURL,
      costumeId: initialState.costumeId || 'ASTRONAUT',
      rocketSkinId: initialState.rocketSkinId || 'APOLLO',
      color: guestParticipant.color,
      currentPlanetIndex: 0,
      altitude: 0,
      score: 0,
      shields: 100,
      trapsAvailable: 3,
      planetsClaimedCount: 0,
      isReady: true,
      lastPing: Date.now(),
      ...initialState,
    };

    const updated: RoomData = {
      ...found,
      guest: guestParticipant,
      guestState: guestFullState,
      status: 'STARTING',
      countdownSeconds: 3,
      updatedAt: Date.now(),
      events: [
        ...(found.events || []),
        {
          id: randomId('ev'),
          type: 'EMOTE',
          message: `${guestParticipant.displayName} entered the arena! Match starting!`,
          timestamp: Date.now(),
          userId: guestUser.uid,
        },
      ],
    };
    putRoom(updated);
    return updated;
  }

  public static subscribeToRoom(roomId: string, onUpdate: (room: RoomData | null) => void): () => void {
    const set = roomListeners.get(roomId) ?? new Set();
    set.add(onUpdate);
    roomListeners.set(roomId, set);
    onUpdate(getRoom(roomId));
    const poll = window.setInterval(() => onUpdate(getRoom(roomId)), 400);
    return () => {
      window.clearInterval(poll);
      const remaining = roomListeners.get(roomId);
      remaining?.delete(onUpdate);
    };
  }

  public static async updatePlayerState(
    roomId: string,
    userId: string,
    playerState: Partial<PlayerOnlineState>,
  ): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    const isHost = room.host.userId === userId;
    const existing = isHost ? room.hostState : room.guestState;
    const next: RoomData = {
      ...room,
      [isHost ? 'hostState' : 'guestState']: {
        ...existing,
        ...playerState,
        lastPing: Date.now(),
      },
      updatedAt: Date.now(),
    };
    putRoom(next);
  }

  public static async updateMatchTelemetry(
    roomId: string,
    userId: string,
    _isHost: boolean,
    playerState: Partial<PlayerOnlineState>,
  ): Promise<void> {
    return this.updatePlayerState(roomId, userId, playerState);
  }

  public static async claimPlanet(
    roomId: string,
    planetId: string,
    userId: string,
    userName?: string,
  ): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    const currentClaimed = room.claimedPlanets || {};
    if (currentClaimed[planetId] === userId) return;
    const updatedClaimed = { ...currentClaimed, [planetId]: userId };
    const displayName =
      userName ||
      (room.host.userId === userId ? room.host.displayName : room.guest?.displayName) ||
      'Explorer';
    const isHost = room.host.userId === userId;
    const newClaimCount = Object.values(updatedClaimed).filter((uid) => uid === userId).length;
    const stateKey = isHost ? 'hostState' : 'guestState';
    const existing = isHost ? room.hostState : room.guestState;
    putRoom({
      ...room,
      claimedPlanets: updatedClaimed,
      [stateKey]: { ...existing, planetsClaimedCount: newClaimCount },
      events: [
        ...(room.events || []).slice(-15),
        {
          id: randomId('ev'),
          type: 'CLAIM',
          message: `${displayName} claimed Planet #${planetId}!`,
          timestamp: Date.now(),
          userId,
        },
      ],
      updatedAt: Date.now(),
    });
  }

  public static async deployTrap(
    roomId: string,
    planetId: string,
    trapType: TrapInfo['type'],
    userId: string,
    userName?: string,
  ): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    const displayName =
      userName ||
      (room.host.userId === userId ? room.host.displayName : room.guest?.displayName) ||
      'Explorer';
    const trapInfo: TrapInfo = {
      id: randomId('trap'),
      planetId,
      type: trapType,
      placedBy: userId,
      deployedBy: userId,
      createdAt: Date.now(),
    };
    const isHost = room.host.userId === userId;
    const userState = isHost ? room.hostState : room.guestState;
    const trapsLeft = Math.max(0, (userState?.trapsAvailable || 1) - 1);
    const stateKey = isHost ? 'hostState' : 'guestState';
    putRoom({
      ...room,
      traps: { ...(room.traps || {}), [planetId]: trapInfo },
      [stateKey]: { ...userState, trapsAvailable: trapsLeft },
      events: [
        ...(room.events || []).slice(-15),
        {
          id: randomId('ev'),
          type: 'TRAP_TRIGGER',
          message: `${displayName} deployed an orbital ${trapType.replace('_', ' ')}!`,
          timestamp: Date.now(),
          userId,
        },
      ],
      updatedAt: Date.now(),
    });
  }

  public static async detonateTrap(
    roomId: string,
    planetId: string,
    detonatedByUserId: string,
  ): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    const trap = room.traps?.[planetId];
    if (!trap) return;
    const remainingTraps = { ...room.traps };
    delete remainingTraps[planetId];
    putRoom({
      ...room,
      traps: remainingTraps,
      events: [
        ...(room.events || []).slice(-15),
        {
          id: randomId('ev'),
          type: 'SHIELD_HIT',
          message: `Orbital trap triggered on Planet #${planetId}!`,
          timestamp: Date.now(),
          userId: detonatedByUserId,
        },
      ],
      updatedAt: Date.now(),
    });
  }

  public static async endMatch(roomId: string, winnerId: string, winnerName: string): Promise<void> {
    return this.finishMatch(roomId, winnerId, winnerName);
  }

  public static async triggerTrapDamage(
    roomId: string,
    planetId: string,
    victimId: string,
    victimName: string,
    damage = 25,
  ): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    const trap = room.traps?.[planetId];
    if (!trap || trap.placedBy === victimId) return;
    const remainingTraps = { ...room.traps };
    delete remainingTraps[planetId];
    const isHostVictim = room.host.userId === victimId;
    const victimState = isHostVictim ? room.hostState : room.guestState;
    const newShields = Math.max(0, (victimState?.shields || 100) - damage);
    const isGameOver = newShields <= 0;
    const winnerId = isGameOver ? trap.placedBy : undefined;
    const winnerName = isGameOver
      ? trap.placedBy === room.host.userId
        ? room.host.displayName
        : room.guest?.displayName
      : undefined;
    putRoom({
      ...room,
      traps: remainingTraps,
      [isHostVictim ? 'hostState' : 'guestState']: { ...victimState, shields: newShields },
      ...(isGameOver ? { status: 'FINISHED' as const, winnerId, winnerName } : {}),
      events: [
        ...(room.events || []).slice(-15),
        {
          id: randomId('ev'),
          type: 'SHIELD_HIT',
          message: `${victimName} detonated a ${trap.type.replace('_', ' ')}! (-${damage}% Shields)`,
          timestamp: Date.now(),
          userId: victimId,
        },
      ],
      updatedAt: Date.now(),
    });
  }

  public static async finishMatch(roomId: string, winnerId: string, winnerName: string): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    putRoom({
      ...room,
      status: 'FINISHED',
      winnerId,
      winnerName,
      updatedAt: Date.now(),
    });
  }

  public static async leaveRoom(roomId: string, userId: string): Promise<void> {
    const room = getRoom(roomId);
    if (!room) return;
    if (room.host.userId === userId) {
      deleteRoom(roomId);
    } else {
      putRoom({
        ...room,
        guest: null,
        guestState: null,
        status: 'WAITING',
        updatedAt: Date.now(),
      });
    }
  }

  public static async submitDailyScore(
    userId: string,
    displayName: string,
    photoURL: string,
    score: number,
    maxAltitude: number,
    planetsVisited: number,
    levelReached: number = 1,
  ): Promise<boolean> {
    const todayKey = new Date().toISOString().split('T')[0];
    const all = readJson<Record<string, Array<Record<string, unknown>>>>(DAILY_LB_KEY, {});
    const entries = all[todayKey] ?? [];
    const existing = entries.find((e) => e.userId === userId);
    if (existing && typeof existing.score === 'number' && existing.score >= score) {
      return false;
    }
    const next = entries.filter((e) => e.userId !== userId);
    next.push({
      userId,
      displayName: displayName || 'Cosmic Explorer',
      photoURL: photoURL || '',
      score,
      maxAltitude: Math.floor(maxAltitude),
      planetsVisited,
      levelReached,
      dateKey: todayKey,
      submittedAt: Date.now(),
    });
    next.sort((a, b) => Number(b.score) - Number(a.score));
    all[todayKey] = next.slice(0, 40);
    writeJson(DAILY_LB_KEY, all);
    return true;
  }

  public static async getDailyLeaderboard(
    dateKey: string = new Date().toISOString().split('T')[0],
    maxLimit: number = 25,
  ): Promise<any[]> {
    const all = readJson<Record<string, Array<Record<string, unknown>>>>(DAILY_LB_KEY, {});
    return (all[dateKey] ?? []).slice(0, maxLimit);
  }

  public static async saveHomePlanet(userId: string, homePlanet: any): Promise<boolean> {
    const planets = readJson<Record<string, unknown>>(HOME_PLANET_KEY, {});
    planets[userId] = { ...homePlanet, userId, lastSavedAt: Date.now() };
    writeJson(HOME_PLANET_KEY, planets);
    return true;
  }

  public static async loadHomePlanet(userId: string): Promise<any | null> {
    const planets = readJson<Record<string, unknown>>(HOME_PLANET_KEY, {});
    return planets[userId] ?? null;
  }
}
