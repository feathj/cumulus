/**
 * The imperative half of the cloud: builds the graph, starts the physics and
 * wires up dragging. Sigma only renders — WebGL for the orbs and tethers, a 2D
 * canvas for labels — while d3-force owns every position.
 *
 * The forces:
 *   collide  orbs push each other (and the hub) apart; this is what makes a
 *            thrown orb shove its neighbours
 *   orbit    pulls each orb toward its ring, stretched to the viewport's shape
 *   drift    a gentle push along the ring, so the cloud never quite settles
 *
 * The simulation never cools completely (alphaTarget stays above zero), which
 * keeps the drift alive. With reduced motion there is no drift and it stops.
 */
import type { createNodeBorderProgram as CreateNodeBorderProgram } from '@sigma/node-border';
import { forceCollide, forceSimulation } from 'd3-force';
import type { Force, SimulationNodeDatum } from 'd3-force';
import Graph from 'graphology';
import type Sigma from 'sigma';
import type { NodeHoverDrawingFunction, NodeLabelDrawingFunction } from 'sigma/rendering';

import { CARD_ICONS } from '@/lib/icons';
import type { CardIconName } from '@/lib/icons';

import { MEMBRANE, cellCapacity, cellOpacity, cellRing, createCellSwarm } from './cells';
import type { CellSwarm, Nucleus } from './cells';
import { ellipseAxes, hash01 } from './geometry';
import type { CloudHub, CloudOrb } from './types';
import { wrapText } from './wrap';

const HUB_ID = '__hub';

/** Clearance between orb edges. */
const GAP = 10;
/** Simulation heat kept alive for the idle drift. */
const DRIFT_ALPHA = 0.04;
/** Heat while something is being dragged, so neighbours react quickly. */
const DRAG_ALPHA = 0.3;
const ORBIT_STRENGTH = 0.07;
/** Graph units per tick added along the orbit. */
const DRIFT_SPEED = 0.03;
/** How much of the pointer's last movement a released orb keeps. */
const THROW = 0.6;
/** Pointer travel below which a press counts as a click, not a drag. */
const CLICK_TOLERANCE_PX = 5;
/** Below this on-screen radius a label wouldn't be readable, so it isn't drawn. */
const MIN_LABEL_RADIUS_PX = 16;
/** Icons need a little more room than text before they're worth drawing. */
const MIN_ICON_RADIUS_PX = 22;
/** Space between the text above and the icon row. */
const ICON_ROW_GAP = 5;
/** Below this on-screen radius an orb is too small to show the cards drifting inside it. */
const MIN_CELL_ORB_PX = 30;
/** Cells are faint: a standard cell's ring and title at this opacity, bigger cells brighter. */
const CELL_ALPHA = 0.3;
/** How dark an orb's nucleus is at its heart, behind the label. */
const NUCLEUS_SHADE = 0.34;
/** The faint ring of the membrane the cells stay inside. */
const MEMBRANE_ALPHA = 0.14;
/** Space around the outermost orbit when fitting the camera. */
const MARGIN = 36;

interface OrbAttributes {
  x: number;
  y: number;
  size: number;
  label: string;
  color: string;
  borderColor: string;
  labelColor: string;
  caption: string;
  captionColor: string;
  icons: CardIconName[];
  /** Cards drift inside it, so its label keeps a shadow and a record of its size. */
  hasCells: boolean;
  serif: boolean;
  bold: boolean;
  hub: boolean;
  forceLabel: boolean;
  highlighted: boolean;
  type: string;
}

interface TetherAttributes {
  size: number;
  color: string;
}

interface SimOrb extends SimulationNodeDatum {
  id: string;
  radius: number;
  ring: number;
  direction: number;
  hub: boolean;
}

type Axes = { kx: number; ky: number };

export interface CloudHandle {
  select(id: string | null): void;
  dispose(): void;
}

export interface MountCloudOptions {
  Sigma: typeof Sigma;
  createNodeBorderProgram: typeof CreateNodeBorderProgram;
  container: HTMLElement;
  orbs: CloudOrb[];
  hub: CloudHub;
  tetherColor: string;
  highlightColor: string;
  selectedId: string | null;
  onOrbClick: (id: string) => void;
}

function resolveFonts(element: HTMLElement): { sans: string; serif: string } {
  const style = getComputedStyle(element);
  const karla = style.getPropertyValue('--font-karla').trim();
  const spectral = style.getPropertyValue('--font-spectral').trim();
  return {
    sans: `${karla ? `${karla}, ` : ''}"Helvetica Neue", Arial, sans-serif`,
    serif: `${spectral ? `${spectral}, ` : ''}Georgia, serif`,
  };
}

/**
 * Starting positions: orbs on similar rings are spread evenly around them,
 * with a little per-orb jitter so the cloud doesn't look machined.
 */
function seedPositions(orbs: CloudOrb[], axes: Axes): SimOrb[] {
  const groups: CloudOrb[][] = [];
  for (const orb of [...orbs].sort((a, b) => a.ring - b.ring)) {
    const group = groups.at(-1);
    const first = group?.[0];
    if (group && first && orb.ring <= first.ring * 1.2) group.push(orb);
    else groups.push([orb]);
  }

  return groups.flatMap((group, groupIndex) =>
    group.map((orb, index) => {
      const angle =
        -Math.PI / 2 +
        (index / group.length) * 2 * Math.PI +
        groupIndex * 0.6 +
        (hash01(orb.id) - 0.5) * 0.4;
      return {
        id: orb.id,
        radius: orb.radius,
        ring: orb.ring,
        direction: orb.direction,
        hub: false,
        x: axes.kx * orb.ring * Math.cos(angle),
        y: axes.ky * orb.ring * Math.sin(angle),
      };
    }),
  );
}

/** Parsed once per icon; created on first draw, since `Path2D` only exists in the browser. */
const iconPaths = new Map<CardIconName, Path2D>();

/** A centred row of icons, each `size` pixels square. */
function drawIcons(
  context: CanvasRenderingContext2D,
  icons: CardIconName[],
  centerX: number,
  centerY: number,
  size: number,
  color: string,
) {
  const gap = size * 0.45;
  let x = centerX - (icons.length * size + (icons.length - 1) * gap) / 2;
  for (const name of icons) {
    const icon = CARD_ICONS[name];
    let path = iconPaths.get(name);
    if (!path) {
      path = new Path2D(icon.path);
      iconPaths.set(name, path);
    }
    context.save();
    context.translate(x, centerY - size / 2);
    // Icon paths are drawn on a 24-unit grid.
    context.scale(size / 24, size / 24);
    context.fillStyle = icon.color ?? color;
    context.fill(path, icon.evenOdd ? 'evenodd' : 'nonzero');
    context.restore();
    x += size + gap;
  }
}

function orbitForce(getAxes: () => Axes): Force<SimOrb, undefined> {
  let nodes: SimOrb[] = [];
  const force = (alpha: number) => {
    const { kx, ky } = getAxes();
    for (const node of nodes) {
      if (node.hub || node.fx != null) continue;
      const x = node.x ?? 0;
      const y = node.y ?? 0;
      const theta = Math.atan2(y / ky, x / kx);
      const targetX = kx * node.ring * Math.cos(theta);
      const targetY = ky * node.ring * Math.sin(theta);
      node.vx = (node.vx ?? 0) + (targetX - x) * ORBIT_STRENGTH * alpha;
      node.vy = (node.vy ?? 0) + (targetY - y) * ORBIT_STRENGTH * alpha;
    }
  };
  force.initialize = (initial: SimOrb[]) => {
    nodes = initial;
  };
  return force;
}

function driftForce(getAxes: () => Axes): Force<SimOrb, undefined> {
  let nodes: SimOrb[] = [];
  const force = () => {
    const { kx, ky } = getAxes();
    for (const node of nodes) {
      if (node.hub || node.fx != null) continue;
      const theta = Math.atan2((node.y ?? 0) / ky, (node.x ?? 0) / kx);
      const tangentX = -kx * Math.sin(theta);
      const tangentY = ky * Math.cos(theta);
      const length = Math.hypot(tangentX, tangentY) || 1;
      node.vx = (node.vx ?? 0) + (tangentX / length) * DRIFT_SPEED * node.direction;
      node.vy = (node.vy ?? 0) + (tangentY / length) * DRIFT_SPEED * node.direction;
    }
  };
  force.initialize = (initial: SimOrb[]) => {
    nodes = initial;
  };
  return force;
}

export function mountCloud(options: MountCloudOptions): CloudHandle {
  const { Sigma, createNodeBorderProgram, container, orbs, hub } = options;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fonts = resolveFonts(container);
  let axes = ellipseAxes(container.clientWidth, container.clientHeight);

  // --- Physics bodies -----------------------------------------------------------

  const hubBody: SimOrb = {
    id: HUB_ID,
    radius: hub.radius,
    ring: 0,
    direction: 0,
    hub: true,
    x: 0,
    y: 0,
    fx: 0,
    fy: 0,
  };
  const orbBodies = seedPositions(orbs, axes);
  const bodies = [hubBody, ...orbBodies];
  const bodiesById = new Map(bodies.map((body) => [body.id, body]));

  // --- Graph -------------------------------------------------------------------

  const graph = new Graph<OrbAttributes, TetherAttributes>();
  graph.addNode(HUB_ID, {
    x: 0,
    y: 0,
    size: hub.radius,
    label: hub.label,
    color: hub.fill,
    borderColor: hub.border,
    labelColor: hub.labelColor,
    caption: '',
    captionColor: hub.labelColor,
    icons: [],
    hasCells: false,
    serif: false,
    bold: true,
    hub: true,
    forceLabel: true,
    highlighted: false,
    type: 'orb',
  });
  for (const orb of orbs) {
    const body = bodiesById.get(orb.id);
    graph.addNode(orb.id, {
      x: body?.x ?? 0,
      y: body?.y ?? 0,
      size: orb.radius,
      label: orb.label,
      color: orb.fill,
      borderColor: orb.border,
      labelColor: orb.labelColor,
      caption: orb.caption ?? '',
      captionColor: orb.captionColor,
      icons: orb.icons ?? [],
      hasCells: Boolean(orb.cells?.length),
      serif: orb.serif,
      bold: orb.bold,
      hub: false,
      forceLabel: true,
      highlighted: orb.id === options.selectedId,
      type: 'orb',
    });
    graph.addEdge(HUB_ID, orb.id, { size: 1, color: options.tetherColor });
  }

  // --- Labels, drawn inside each orb --------------------------------------------

  // Fitting text is the costly part of a frame, and most frames redraw the same
  // labels at the same size, so remember each fit.
  const fitCache = new Map<string, { fontSize: number; lines: string[]; width: number }>();
  /** Each orb's label block, in orb radii, so the cells inside it can keep clear. */
  const labelBlocks = new Map<string, Nucleus>();

  const drawLabel: NodeLabelDrawingFunction<OrbAttributes, TetherAttributes> = (context, data) => {
    const orb = data as typeof data & Partial<OrbAttributes> & { key?: string };
    if (!orb.label || orb.size < MIN_LABEL_RADIUS_PX) return;

    const box = orb.size * 1.4;
    const caption = orb.caption && orb.size >= 26 ? orb.caption.toUpperCase() : '';
    const captionSize = Math.max(8, Math.min(11, orb.size * 0.17));
    const icons = orb.icons?.length && orb.size >= MIN_ICON_RADIUS_PX ? orb.icons : [];
    const iconSize = Math.max(9, Math.min(13, orb.size * 0.2));
    const iconRow = icons.length ? iconSize + ICON_ROW_GAP : 0;
    const available = box - (caption ? captionSize + 6 : 0) - iconRow;
    const family = orb.serif ? fonts.serif : fonts.sans;
    const weight = orb.bold ? 500 : 400;

    const cacheKey = `${orb.label}|${Math.round(orb.size)}|${family}|${weight}|${caption ? 1 : 0}|${icons.length ? 1 : 0}`;
    let fit = fitCache.get(cacheKey);
    if (!fit) {
      let fontSize = Math.max(9, Math.min(18, orb.size * 0.3));
      let lines: string[] = [];
      for (;;) {
        context.font = `${weight} ${fontSize}px ${family}`;
        const maxLines = Math.max(1, Math.floor(available / (fontSize * 1.25)));
        lines = wrapText(orb.label, box, maxLines, (text) => context.measureText(text).width);
        if (!lines.at(-1)?.endsWith('…') || fontSize <= 9) break;
        fontSize -= 1;
      }
      fit = { fontSize, lines, width: Math.max(0, ...lines.map((line) => context.measureText(line).width)) };
      if (fitCache.size > 2000) fitCache.clear();
      fitCache.set(cacheKey, fit);
    }

    const lineHeight = fit.fontSize * 1.25;
    const blockHeight = fit.lines.length * lineHeight + (caption ? captionSize + 6 : 0) + iconRow;
    let y = orb.y - blockHeight / 2 + lineHeight / 2;
    if (orb.hasCells && orb.key) {
      labelBlocks.set(orb.key, {
        halfWidth: fit.width / 2 / orb.size,
        halfHeight: blockHeight / 2 / orb.size,
      });
    }

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    if (orb.hasCells) {
      // Lifts the name off the cells drifting behind it.
      context.shadowColor = 'rgba(0, 0, 0, 0.7)';
      context.shadowBlur = Math.max(4, fit.fontSize * 0.45);
    }
    context.fillStyle = orb.labelColor ?? '#ffffff';
    context.font = `${weight} ${fit.fontSize}px ${family}`;
    for (const line of fit.lines) {
      context.fillText(line, orb.x, y);
      y += lineHeight;
    }
    let bottom = y - lineHeight / 2;
    if (caption) {
      context.font = `600 ${captionSize}px ${fonts.sans}`;
      context.fillStyle = orb.captionColor ?? orb.labelColor ?? '#ffffff';
      context.fillText(caption, orb.x, bottom + 6 + captionSize / 2);
      bottom += 6 + captionSize;
    }
    if (icons.length) {
      drawIcons(
        context,
        icons,
        orb.x,
        bottom + ICON_ROW_GAP + iconSize / 2,
        iconSize,
        orb.captionColor ?? orb.labelColor ?? '#ffffff',
      );
    }
    context.restore();
  };

  // Just the ring. Every label, hovered or not, is already on the label layer.
  const drawHover: NodeHoverDrawingFunction<OrbAttributes, TetherAttributes> = (context, data) => {
    const orb = data as typeof data & Partial<OrbAttributes>;
    if (orb.hub) return;
    context.save();
    context.beginPath();
    context.arc(orb.x, orb.y, orb.size + 3, 0, Math.PI * 2);
    context.lineWidth = 2;
    context.strokeStyle = options.highlightColor;
    context.stroke();
    context.restore();
  };

  // --- Renderer -----------------------------------------------------------------

  const OrbProgram = createNodeBorderProgram<OrbAttributes, TetherAttributes>({
    borders: [
      { size: { value: 1.5, mode: 'pixels' }, color: { attribute: 'borderColor' } },
      { size: { fill: true }, color: { attribute: 'color' } },
    ],
    drawLabel,
    drawHover,
  });

  const renderer = new Sigma<OrbAttributes, TetherAttributes>(graph, container, {
    nodeProgramClasses: { orb: OrbProgram },
    defaultNodeType: 'orb',
    defaultDrawNodeLabel: drawLabel,
    defaultDrawNodeHover: drawHover,
    // Sizes are graph units that scale with zoom, like positions — so an
    // orb's drawn radius and its collision radius are the same number.
    itemSizesReference: 'positions',
    zoomToSizeRatioFunction: (ratio) => ratio,
    stagePadding: 12,
    labelRenderedSizeThreshold: 0,
    renderEdgeLabels: false,
    enableEdgeEvents: false,
    defaultEdgeColor: options.tetherColor,
    minCameraRatio: 0.2,
    maxCameraRatio: 2.5,
    allowInvalidContainer: true,
  });

  // Sigma draws hovered and highlighted nodes a second time, on a WebGL layer
  // above the labels, which suits labels that sit beside a node. Ours sit
  // inside, so that copy covered them; the node layer already draws every orb.
  const hoverNodes = container.querySelector<HTMLCanvasElement>('.sigma-hoverNodes');
  if (hoverNodes) hoverNodes.style.display = 'none';

  // --- Cells: cards drifting inside their orbs ------------------------------------

  const swarms = new Map<string, CellSwarm>();
  for (const orb of orbs) {
    if (orb.cells?.length) {
      swarms.set(orb.id, createCellSwarm(orb.cells, cellCapacity(orb.radius, orb.cells.length)));
    }
  }

  // Their own canvas, between the orbs and the labels, so orb titles stay on top.
  // The mouse layer above everything means cells can't be hovered or clicked.
  const cellLayer = swarms.size ? renderer.createCanvas('cells', { afterLayer: 'nodes' }) : null;
  const cellContext = cellLayer?.getContext('2d') ?? null;
  const cellLabels = new Map<string, string>();

  const sizeCells = () => {
    if (!cellLayer || !cellContext) return;
    const { width, height } = renderer.getDimensions();
    const ratio = window.devicePixelRatio || 1;
    cellLayer.width = Math.round(width * ratio);
    cellLayer.height = Math.round(height * ratio);
    cellLayer.style.width = `${width}px`;
    cellLayer.style.height = `${height}px`;
    cellContext.setTransform(ratio, 0, 0, ratio, 0, 0);
  };
  sizeCells();

  const fitCellLabel = (context: CanvasRenderingContext2D, label: string, fontSize: number, maxWidth: number) => {
    const key = `${label}|${fontSize}|${maxWidth}`;
    let fitted = cellLabels.get(key);
    if (fitted === undefined) {
      fitted = wrapText(label, maxWidth, 1, (text) => context.measureText(text).width)[0] ?? '';
      if (cellLabels.size > 1000) cellLabels.clear();
      cellLabels.set(key, fitted);
    }
    return fitted;
  };

  /**
   * One orb's insides: a shaded nucleus behind its label, a faint membrane just
   * inside its edge, and its cells — rings sized by priority, with tiny titles —
   * clipped to the membrane so nothing spills out.
   */
  const drawSwarm = (
    context: CanvasRenderingContext2D,
    swarm: CellSwarm,
    centerX: number,
    centerY: number,
    radius: number,
    color: string,
    nucleus: Nucleus | undefined,
  ) => {
    const fontSize = Math.min(10, Math.max(6.5, radius * 0.11));
    const maxWidth = Math.round(radius * 0.9);

    context.save();
    if (nucleus) {
      // Darkest behind the label and fading out past it, so the name sits in a nucleus.
      const rx = Math.min(radius * 0.95, (nucleus.halfWidth + 0.2) * radius);
      const ry = Math.min(radius * 0.95, (nucleus.halfHeight + 0.16) * radius);
      context.save();
      context.translate(centerX, centerY);
      context.scale(1, ry / rx);
      const shade = context.createRadialGradient(0, 0, 0, 0, 0, rx);
      shade.addColorStop(0, `rgba(0, 0, 0, ${NUCLEUS_SHADE})`);
      shade.addColorStop(0.55, `rgba(0, 0, 0, ${NUCLEUS_SHADE * 0.6})`);
      shade.addColorStop(1, 'rgba(0, 0, 0, 0)');
      context.fillStyle = shade;
      context.beginPath();
      context.arc(0, 0, rx, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    // The membrane, then everything else kept inside it.
    context.lineWidth = 1;
    context.strokeStyle = color;
    context.fillStyle = color;
    context.globalAlpha = MEMBRANE_ALPHA;
    context.beginPath();
    context.arc(centerX, centerY, radius * MEMBRANE, 0, Math.PI * 2);
    context.stroke();
    context.clip();

    context.textAlign = 'center';
    context.textBaseline = 'top';
    for (const cell of swarm.cells) {
      const { scale } = cell.card;
      const opacity = cellOpacity(cell) * Math.min(1, CELL_ALPHA * scale ** 0.75);
      if (opacity < 0.01) continue;
      const x = centerX + cell.x * radius;
      const y = centerY + cell.y * radius;
      const ring = Math.max(2, radius * cellRing(cell.card));
      const titleSize = Math.round(fontSize * Math.sqrt(scale) * 2) / 2;
      context.globalAlpha = opacity;
      context.beginPath();
      context.arc(x, y, ring, 0, Math.PI * 2);
      context.stroke();
      context.font = `400 ${titleSize}px ${fonts.sans}`;
      context.fillText(fitCellLabel(context, cell.card.label, titleSize, maxWidth), x, y + ring + 2);
    }
    context.restore();
  };

  let lastCellDraw = performance.now();
  const drawCells = () => {
    if (!cellContext) return;
    const now = performance.now();
    const elapsed = (now - lastCellDraw) / 1000;
    lastCellDraw = now;

    const { width, height } = renderer.getDimensions();
    cellContext.clearRect(0, 0, width, height);
    for (const [id, swarm] of swarms) {
      const nucleus = labelBlocks.get(id);
      swarm.setNucleus(nucleus ?? null);
      // A zero step still moves cells out of the label's way, without any drifting.
      swarm.step(reducedMotion ? 0 : elapsed);
      const data = renderer.getNodeDisplayData(id);
      if (!data) continue;
      const radius = renderer.scaleSize(data.size);
      if (radius < MIN_CELL_ORB_PX) continue;
      const center = renderer.framedGraphToViewport(data);
      drawSwarm(
        cellContext,
        swarm,
        center.x,
        center.y,
        radius,
        graph.getNodeAttribute(id, 'labelColor'),
        nucleus,
      );
    }
  };

  // Cells move on their own clock, faster than the physics. With reduced motion
  // they hold still and are only redrawn when the view changes.
  let cellFrame = 0;
  const animateCells = () => {
    drawCells();
    cellFrame = requestAnimationFrame(animateCells);
  };
  if (swarms.size) {
    if (reducedMotion) renderer.on('afterRender', drawCells);
    else cellFrame = requestAnimationFrame(animateCells);
  }

  // A fixed frame, so orbs drifting outward don't make Sigma rescale the view.
  const fitFrame = () => {
    let x = hub.radius;
    let y = hub.radius;
    for (const body of orbBodies) {
      x = Math.max(x, axes.kx * body.ring + body.radius);
      y = Math.max(y, axes.ky * body.ring + body.radius);
    }
    renderer.setCustomBBox({ x: [-x - MARGIN, x + MARGIN], y: [-y - MARGIN, y + MARGIN] });
  };
  fitFrame();
  renderer.refresh();

  // Labels drawn before the web fonts load used fallbacks; redraw once they're in.
  void document.fonts.ready.then(() => {
    fonts = resolveFonts(container);
    fitCache.clear();
    cellLabels.clear();
    renderer.refresh();
  });

  // --- Simulation ---------------------------------------------------------------

  const simulation = forceSimulation<SimOrb>(bodies)
    .velocityDecay(0.3)
    .force(
      'collide',
      forceCollide<SimOrb>((body) => body.radius + GAP / 2)
        .strength(0.85)
        .iterations(2),
    )
    .force(
      'orbit',
      orbitForce(() => axes),
    )
    .alphaTarget(reducedMotion ? 0 : DRIFT_ALPHA)
    .on('tick', () => {
      graph.updateEachNodeAttributes(
        (id, attributes) => {
          const body = bodiesById.get(id);
          return body ? { ...attributes, x: body.x ?? 0, y: body.y ?? 0 } : attributes;
        },
        { attributes: ['x', 'y'] },
      );
    });
  if (!reducedMotion) simulation.force('drift', driftForce(() => axes));

  // --- Dragging -----------------------------------------------------------------

  let dragged: SimOrb | null = null;
  let travelled = 0;
  let lastPointer = { x: 0, y: 0 };
  let lastPosition = { x: 0, y: 0 };
  let throwVelocity = { x: 0, y: 0 };

  renderer.on('downNode', ({ node, event }) => {
    const body = bodiesById.get(node);
    if (!body || body.hub) return;
    dragged = body;
    travelled = 0;
    lastPointer = { x: event.x, y: event.y };
    lastPosition = { x: body.x ?? 0, y: body.y ?? 0 };
    throwVelocity = { x: 0, y: 0 };
    body.fx = body.x;
    body.fy = body.y;
    simulation.alphaTarget(DRAG_ALPHA).restart();
    container.style.cursor = 'grabbing';
  });

  const captor = renderer.getMouseCaptor();

  captor.on('mousemovebody', (event) => {
    if (!dragged) return;
    const position = renderer.viewportToGraph(event);
    travelled += Math.abs(event.x - lastPointer.x) + Math.abs(event.y - lastPointer.y);
    throwVelocity = { x: position.x - lastPosition.x, y: position.y - lastPosition.y };
    lastPointer = { x: event.x, y: event.y };
    lastPosition = position;
    dragged.fx = position.x;
    dragged.fy = position.y;
    // Hold the camera still while an orb is in hand.
    event.preventSigmaDefault();
    event.original.preventDefault();
    event.original.stopPropagation();
  });

  captor.on('mouseup', () => {
    if (!dragged) return;
    const released = dragged;
    dragged = null;
    released.fx = null;
    released.fy = null;
    released.vx = throwVelocity.x * THROW;
    released.vy = throwVelocity.y * THROW;
    simulation.alphaTarget(reducedMotion ? 0 : DRIFT_ALPHA).alpha(0.3).restart();
    container.style.cursor = '';
    if (travelled < CLICK_TOLERANCE_PX) options.onOrbClick(released.id);
  });

  renderer.on('enterNode', ({ node }) => {
    if (!dragged) container.style.cursor = bodiesById.get(node)?.hub ? 'default' : 'grab';
  });
  renderer.on('leaveNode', () => {
    if (!dragged) container.style.cursor = '';
  });

  // --- Resizing -----------------------------------------------------------------

  const resizeObserver = new ResizeObserver(() => {
    axes = ellipseAxes(container.clientWidth, container.clientHeight);
    renderer.resize();
    sizeCells();
    fitFrame();
    renderer.refresh();
    simulation.alpha(Math.max(simulation.alpha(), 0.2)).restart();
  });
  resizeObserver.observe(container);

  // --- Handle -------------------------------------------------------------------

  let selected = options.selectedId;

  return {
    select(id) {
      if (selected && graph.hasNode(selected)) {
        graph.setNodeAttribute(selected, 'highlighted', false);
      }
      selected = id;
      if (id && graph.hasNode(id)) graph.setNodeAttribute(id, 'highlighted', true);
    },
    dispose() {
      resizeObserver.disconnect();
      cancelAnimationFrame(cellFrame);
      cellLayer?.remove();
      simulation.stop();
      renderer.kill();
      graph.clear();
    },
  };
}
