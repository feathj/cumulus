/**
 * The cards drifting inside an orb, like the insides of a cell. Purely
 * decorative: a few of a cluster's cards at a time wander around within it,
 * quicker than the orbs themselves move, and every so often one fades out so
 * another from the cluster can fade in — so over time every card surfaces.
 *
 * Cells stay inside the orb's membrane and out of its nucleus, the space the
 * orb's own label takes up, so the label always reads clearly.
 *
 * Positions and sizes are in orb radii from the orb's centre, so the swarm
 * doesn't care how big the orb is drawn or where it is.
 */
import type { CloudCell } from './types';

/** Seconds a card spends fading in, and again fading out, as it rotates through. */
export const CELL_FADE_S = 1.4;
/** A standard cell's ring, in orb radii. A cell's `scale` multiplies it. */
export const CELL_RADIUS = 0.08;
/** The membrane: cells and their titles are clipped to this, in orb radii. */
export const MEMBRANE = 0.9;

/** How far out a cell's centre may go, less its own ring, leaving room for its title below. */
const WALL = 0.74;
const MIN_LIFE_S = 9;
const MAX_LIFE_S = 18;
/** Orb radii per second. The orbs drift at roughly a tenth of an orb radius a second. */
const MIN_SPEED = 0.18;
const MAX_SPEED = 0.32;
/** Most a heading wanders, in radians per second. */
const TURN_RATE = 1.6;
/** Space kept between neighbouring rings, so their titles don't pile up. */
const CELL_GAP = 0.2;
/** Longest step simulated at once, so a tab coming back from the background doesn't teleport anything. */
const MAX_STEP_S = 0.1;

/** Clearance around the label, in orb radii: room for a ring and the start of its title. */
const NUCLEUS_PAD_X = 0.16;
const NUCLEUS_PAD_Y = 0.1;
/** A cell's title hangs below its ring, so the point that must clear the label sits a little lower. */
const TITLE_DROP = 0.09;
/** The nucleus never grows so big that cells have nowhere left to go. */
const NUCLEUS_MAX = 0.5;

/** The orb's label block, in orb radii either side of the centre. */
export interface Nucleus {
  halfWidth: number;
  halfHeight: number;
}

export interface Cell {
  card: CloudCell;
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Seconds since it faded in. */
  age: number;
  /** Seconds it stays before making way for another card. */
  life: number;
}

export interface CellSwarm {
  readonly cells: readonly Cell[];
  /** Where the orb's label is, for cells to keep clear of; null while unknown. */
  setNucleus(nucleus: Nucleus | null): void;
  /** Advances the swarm by `seconds` of wandering and rotation. */
  step(seconds: number): void;
}

/** How many cells an orb of this radius (graph units) shows at once: one or two in small orbs, up to six. */
export function cellCapacity(radius: number, poolSize: number): number {
  return Math.min(poolSize, Math.max(1, Math.min(6, Math.floor(radius / 13) - 1)));
}

/** 0 to 1: fading in, fully shown, then fading out at the end of its life. */
export function cellOpacity({ age, life }: Pick<Cell, 'age' | 'life'>): number {
  return Math.max(0, Math.min(1, age / CELL_FADE_S, (life - age) / CELL_FADE_S));
}

/** A card's ring radius, in orb radii. */
export function cellRing(card: CloudCell): number {
  return CELL_RADIUS * card.scale;
}

/** How far from the centre a card's cell may go. Bigger cells stay further in. */
export function cellWall(card: CloudCell): number {
  return WALL - cellRing(card);
}

/** Under 1 when a cell at (x, y) would crowd the label; 1 on the edge of the space kept clear. */
export function nucleusReach(x: number, y: number, nucleus: Nucleus): number {
  const a = Math.min(NUCLEUS_MAX, nucleus.halfWidth + NUCLEUS_PAD_X);
  const b = Math.min(NUCLEUS_MAX, nucleus.halfHeight + NUCLEUS_PAD_Y);
  return (x / a) ** 2 + ((y + TITLE_DROP) / b) ** 2;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j] as T, items[i] as T];
  }
  return items;
}

/** Mirrors a heading about a surface normal, for glancing off a wall. */
function reflect(heading: number, nx: number, ny: number): number {
  const vx = Math.cos(heading);
  const vy = Math.sin(heading);
  const along = vx * nx + vy * ny;
  return Math.atan2(vy - 2 * along * ny, vx - 2 * along * nx);
}

/** Keeps a cell inside its wall, turning it back if it's heading out. */
function keepInside(cell: Cell) {
  const wall = cellWall(cell.card);
  const distance = Math.hypot(cell.x, cell.y);
  if (distance <= wall) return;
  const nx = cell.x / distance;
  const ny = cell.y / distance;
  if (Math.cos(cell.heading) * nx + Math.sin(cell.heading) * ny > 0) {
    cell.heading = reflect(cell.heading, nx, ny);
  }
  cell.x = nx * wall;
  cell.y = ny * wall;
}

/** Keeps a cell out of the nucleus, turning it away if it's heading in. */
function keepOutOfNucleus(cell: Cell, nucleus: Nucleus) {
  const reach = nucleusReach(cell.x, cell.y, nucleus);
  if (reach >= 1) return;
  const a = Math.min(NUCLEUS_MAX, nucleus.halfWidth + NUCLEUS_PAD_X);
  const b = Math.min(NUCLEUS_MAX, nucleus.halfHeight + NUCLEUS_PAD_Y);
  const px = cell.x;
  const py = cell.y + TITLE_DROP;

  if (reach < 1e-9) {
    // Dead centre: step straight down and out.
    cell.x = 0;
    cell.y = b - TITLE_DROP;
    return;
  }
  // Out to the edge along the line from the centre.
  const k = 1 / Math.sqrt(reach);
  cell.x = px * k;
  cell.y = py * k - TITLE_DROP;

  // The ellipse's outward normal at that point.
  const gx = (px * k) / (a * a);
  const gy = (py * k) / (b * b);
  const length = Math.hypot(gx, gy);
  const nx = gx / length;
  const ny = gy / length;
  if (Math.cos(cell.heading) * nx + Math.sin(cell.heading) * ny < 0) {
    cell.heading = reflect(cell.heading, nx, ny);
  }
}

/** A swarm of up to `capacity` cells drawn from `pool`. `random` is injectable for tests. */
export function createCellSwarm(
  pool: readonly CloudCell[],
  capacity: number,
  random: () => number = Math.random,
): CellSwarm {
  const shown = new Set<string>();
  let queue: CloudCell[] = [];
  let nucleus: Nucleus | null = null;

  /** The next card not already on show, working through the pool in a shuffled order. */
  const nextCard = (): CloudCell | undefined => {
    for (let pass = 0; pass < 2; pass++) {
      while (queue.length > 0) {
        const card = queue.pop();
        if (card && !shown.has(card.id)) return card;
      }
      queue = shuffle(
        pool.filter((card) => !shown.has(card.id)),
        random,
      );
    }
    return undefined;
  };

  const spawn = (card: CloudCell): Cell => {
    shown.add(card.id);
    const wall = cellWall(card);
    let x = 0;
    let y = 0;
    // Somewhere clear of the label, if a few tries find it; the next step tidies up otherwise.
    for (let attempt = 0; attempt < 12; attempt++) {
      const angle = random() * Math.PI * 2;
      // sqrt spreads starting points evenly over the disc rather than bunching them in the middle.
      const distance = Math.sqrt(random()) * wall;
      x = Math.cos(angle) * distance;
      y = Math.sin(angle) * distance;
      if (!nucleus || nucleusReach(x, y, nucleus) >= 1) break;
    }
    return {
      card,
      x,
      y,
      heading: random() * Math.PI * 2,
      speed: lerp(MIN_SPEED, MAX_SPEED, random()),
      age: 0,
      life: lerp(MIN_LIFE_S, MAX_LIFE_S, random()),
    };
  };

  const cells: Cell[] = [];
  for (let i = 0; i < capacity; i++) {
    const card = nextCard();
    if (!card) break;
    const cell = spawn(card);
    // Start part-way through their lives, so they don't all rotate out together.
    cell.age = random() * (cell.life - CELL_FADE_S);
    cells.push(cell);
  }

  const separate = () => {
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i];
        const b = cells[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        const wanted = CELL_GAP + cellRing(a.card) + cellRing(b.card);
        if (distance >= wanted || distance < 1e-6) continue;
        const push = (wanted - distance) * 0.05;
        a.x -= (dx / distance) * push;
        a.y -= (dy / distance) * push;
        b.x += (dx / distance) * push;
        b.y += (dy / distance) * push;
      }
    }
  };

  return {
    cells,
    setNucleus(next) {
      nucleus = next;
    },
    step(seconds) {
      const dt = Math.min(Math.max(0, seconds), MAX_STEP_S);
      separate();
      for (const [index, cell] of cells.entries()) {
        cell.heading += (random() - 0.5) * 2 * TURN_RATE * dt;
        cell.x += Math.cos(cell.heading) * cell.speed * dt;
        cell.y += Math.sin(cell.heading) * cell.speed * dt;
        keepInside(cell);
        if (nucleus) {
          keepOutOfNucleus(cell, nucleus);
          keepInside(cell);
        }

        cell.age += dt;
        if (cell.age < cell.life) continue;
        const card = nextCard();
        if (card) {
          shown.delete(cell.card.id);
          cells[index] = spawn(card);
        } else {
          // Nothing else to show: this card simply stays.
          cell.age = CELL_FADE_S;
          cell.life = lerp(MIN_LIFE_S, MAX_LIFE_S, random());
        }
      }
    },
  };
}
