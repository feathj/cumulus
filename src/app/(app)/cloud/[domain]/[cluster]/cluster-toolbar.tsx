'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonBase from '@mui/material/ButtonBase';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useId, useState } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { useShowNotice } from '@/components/notice';
import { SegmentGroup, segmentSx } from '@/components/segmented';
import { plural } from '@/lib/format';
import { neutral } from '@/lib/palette';
import { cloudPath, clusterPath, domainPath } from '@/lib/routes';
import type { ClusterRef } from '@/server/services/clusters';
import { useTRPC, useTRPCClient } from '@/trpc/client';

import { CloudToolbar, CloudTrail } from '../../cloud-trail';

/** The trail back up through the cloud, the cluster's three views, and archiving it. */
export function ClusterToolbar({ domainSlug, clusterSlug }: { domainSlug: string; clusterSlug: string }) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const palette = useDomainPalette();
  const { data: board } = useSuspenseQuery(
    trpc.cluster.board.queryOptions({ domainSlug, clusterSlug }),
  );

  const { data: domains } = useSuspenseQuery(trpc.domain.list.queryOptions());
  const domainTitle = domains.find((d) => d.slug === domainSlug)?.title ?? domainSlug;

  const views = [
    { label: 'Cloud', href: clusterPath(domainSlug, clusterSlug) },
    { label: 'Cards', href: clusterPath(domainSlug, clusterSlug, 'cards') },
    { label: 'Memory', href: clusterPath(domainSlug, clusterSlug, 'memory') },
  ];
  const openCards = board.tiers.NOW.length + board.tiers.NEXT.length + board.tiers.SOMEDAY.length;

  return (
    <CloudToolbar>
      <CloudTrail
        steps={[
          { label: 'Cloud', href: cloudPath },
          { label: domainTitle, href: domainPath(domainSlug) },
        ]}
        current={board.cluster.title}
      />
      <SegmentGroup label="Cluster views">
        {views.map((view) => {
          const active = pathname === view.href;
          return (
            <ButtonBase
              key={view.href}
              component={Link}
              href={view.href}
              aria-current={active ? 'page' : undefined}
              sx={segmentSx(active, palette)}
            >
              {view.label}
            </ButtonBase>
          );
        })}
      </SegmentGroup>
      <Typography sx={{ fontSize: 10, letterSpacing: '0.06em', color: 'text.secondary' }}>
        {plural(openCards, 'open card')}
      </Typography>
      <Box sx={{ flex: 1 }} />
      <ArchiveClusterButton domainSlug={domainSlug} cluster={board.cluster} openCards={openCards} />
    </CloudToolbar>
  );
}

/**
 * Archiving a whole cluster asks first — it's a lot to lose to a stray click —
 * then returns to the domain cloud with an Undo.
 */
function ArchiveClusterButton({
  domainSlug,
  cluster,
  openCards,
}: {
  domainSlug: string;
  cluster: ClusterRef;
  openCards: number;
}) {
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const router = useRouter();
  const showNotice = useShowNotice();
  const titleId = useId();
  const [confirming, setConfirming] = useState(false);
  const archive = useMutation(trpc.cluster.archive.mutationOptions());

  // Just the lists. Refetching the archived cluster's own board would 404 while it's still on screen.
  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.cluster.list.queryKey({ domainSlug }) });
    void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
  };

  // Runs after this toolbar has gone (the page has moved to the domain), so it
  // calls the client directly instead of through a mutation hook tied to it.
  const undo = () => {
    trpcClient.cluster.restore.mutate({ id: cluster.id }).then(
      () => {
        refreshLists();
        showNotice(`${cluster.title} is back.`, { label: 'Open', href: clusterPath(domainSlug, cluster.slug) });
      },
      () => showNotice(`${cluster.title} couldn’t be restored.`),
    );
  };

  const confirm = () =>
    archive.mutate(
      { id: cluster.id },
      {
        onSuccess: () => {
          setConfirming(false);
          router.push(domainPath(domainSlug));
          refreshLists();
          showNotice(`Archived ${cluster.title}.`, { label: 'Undo', onClick: undo });
        },
        onError: () => {
          setConfirming(false);
          showNotice(`${cluster.title} couldn’t be archived.`);
        },
      },
    );

  return (
    <>
      <Button
        size="small"
        variant="outlined"
        color="inherit"
        onClick={() => setConfirming(true)}
        sx={{
          fontSize: 12,
          color: neutral.muted,
          borderColor: neutral.lineStrong,
          '&:hover': { color: neutral.text, borderColor: neutral.muted },
        }}
      >
        Archive cluster
      </Button>
      <Dialog
        open={confirming}
        onClose={() => {
          if (!archive.isPending) setConfirming(false);
        }}
        aria-labelledby={titleId}
        slotProps={{ paper: { sx: { bgcolor: neutral.surface, border: `1px solid ${neutral.line}` } } }}
      >
        <DialogTitle id={titleId} sx={{ fontSize: 16 }}>
          Archive {cluster.title}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: 13.5, lineHeight: 1.55 }}>
            It leaves the domain cloud and the counts, along with its {plural(openCards, 'open card')}.
            Nothing is deleted — cards, notes and memory are kept — and you can undo straight after.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setConfirming(false)} disabled={archive.isPending} autoFocus>
            Cancel
          </Button>
          <Button variant="outlined" onClick={confirm} disabled={archive.isPending}>
            Archive
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
