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
  const fitCache = new Map<string, { fontSize: number; lines: string[] }>();

  const drawLabel: NodeLabelDrawingFunction<OrbAttributes, TetherAttributes> = (context, data) => {
    const orb = data as typeof data & Partial<OrbAttributes>;
    if (!orb.label || orb.size < MIN_LABEL_RADIUS_PX) return;

    const box = orb.size * 1.4;
    const caption = orb.caption && orb.size >= 26 ? orb.caption.toUpperCase() : '';
    const captionSize = Math.max(8, Math.min(11, orb.size * 0.17));
    const available = box - (caption ? captionSize + 6 : 0);
    const family = orb.serif ? fonts.serif : fonts.sans;
    const weight = orb.bold ? 500 : 400;

    const cacheKey = `${orb.label}|${Math.round(orb.size)}|${family}|${weight}|${caption ? 1 : 0}`;
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
      fit = { fontSize, lines };
      if (fitCache.size > 2000) fitCache.clear();
      fitCache.set(cacheKey, fit);
    }

    const lineHeight = fit.fontSize * 1.25;
    const blockHeight = fit.lines.length * lineHeight + (caption ? captionSize + 6 : 0);
    let y = orb.y - blockHeight / 2 + lineHeight / 2;

    context.save();
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = orb.labelColor ?? '#ffffff';
    context.font = `${weight} ${fit.fontSize}px ${family}`;
    for (const line of fit.lines) {
      context.fillText(line, orb.x, y);
      y += lineHeight;
    }
    if (caption) {
      context.font = `600 ${captionSize}px ${fonts.sans}`;
      context.fillStyle = orb.captionColor ?? orb.labelColor ?? '#ffffff';
      context.fillText(caption, orb.x, y - lineHeight / 2 + 6 + captionSize / 2);
    }
    context.restore();
  };

  const drawHover: NodeHoverDrawingFunction<OrbAttributes, TetherAttributes> = (
    context,
    data,
    settings,
  ) => {
    const orb = data as typeof data & Partial<OrbAttributes>;
    if (!orb.hub) {
      context.save();
      context.beginPath();
      context.arc(orb.x, orb.y, orb.size + 3, 0, Math.PI * 2);
      context.lineWidth = 2;
      context.strokeStyle = options.highlightColor;
      context.stroke();
      context.restore();
    }
    drawLabel(context, data, settings);
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
      simulation.stop();
      renderer.kill();
      graph.clear();
    },
  };
}
