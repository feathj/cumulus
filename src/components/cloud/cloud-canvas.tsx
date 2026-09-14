'use client';

import Box from '@mui/material/Box';
import { useEffect, useRef } from 'react';

import { flattenColor } from '@/lib/color';
import { neutral } from '@/lib/palette';

import { mountCloud } from './mount-cloud';
import type { CloudHandle } from './mount-cloud';
import type { CloudHub, CloudOrb } from './types';

export interface CloudCanvasProps {
  orbs: CloudOrb[];
  hub: CloudHub;
  tetherColor: string;
  highlightColor: string;
  selectedId: string | null;
  onOrbClick: (id: string) => void;
  ariaLabel: string;
}

interface Scene {
  orbs: CloudOrb[];
  hub: CloudHub;
  tetherColor: string;
  highlightColor: string;
}

/**
 * Callers describe the cloud with translucent colours, as the design does.
 * WebGL needs them solid, so each is resolved against the page background.
 */
function flattenScene(scene: Scene): Scene {
  const flat = (color: string) => flattenColor(color, neutral.canvas);
  return {
    ...scene,
    orbs: scene.orbs.map((orb) => ({ ...orb, fill: flat(orb.fill), border: flat(orb.border) })),
    hub: { ...scene.hub, fill: flat(scene.hub.fill), border: flat(scene.hub.border) },
    tetherColor: flat(scene.tetherColor),
  };
}

/**
 * A physics cloud of orbs around a hub. Sigma and its WebGL programs are
 * imported inside the effect, so this renders an empty stage on the server
 * and the cloud appears once the client has loaded them.
 *
 * The scene is rebuilt only when what's drawn actually changes (compared by
 * value); selection changes are applied to the running scene.
 */
export function CloudCanvas({
  orbs,
  hub,
  tetherColor,
  highlightColor,
  selectedId,
  onOrbClick,
  ariaLabel,
}: CloudCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<CloudHandle | null>(null);
  const onOrbClickRef = useRef(onOrbClick);
  const selectedIdRef = useRef(selectedId);

  const sceneKey = JSON.stringify({ orbs, hub, tetherColor, highlightColor } satisfies Scene);

  useEffect(() => {
    onOrbClickRef.current = onOrbClick;
  }, [onOrbClick]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    handleRef.current?.select(selectedId);
  }, [selectedId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const scene = flattenScene(JSON.parse(sceneKey) as Scene);
    let disposed = false;

    void Promise.all([import('sigma'), import('@sigma/node-border')])
      .then(([sigma, nodeBorder]) => {
        if (disposed) return;
        handleRef.current = mountCloud({
          Sigma: sigma.default,
          createNodeBorderProgram: nodeBorder.createNodeBorderProgram,
          container,
          ...scene,
          selectedId: selectedIdRef.current,
          onOrbClick: (id) => onOrbClickRef.current(id),
        });
      })
      .catch((error: unknown) => {
        console.error('The cloud could not start (is WebGL available?)', error);
      });

    return () => {
      disposed = true;
      handleRef.current?.dispose();
      handleRef.current = null;
    };
  }, [sceneKey]);

  return (
    <Box
      ref={containerRef}
      role="img"
      aria-label={ariaLabel}
      sx={{ position: 'absolute', inset: 0, touchAction: 'none' }}
    />
  );
}
