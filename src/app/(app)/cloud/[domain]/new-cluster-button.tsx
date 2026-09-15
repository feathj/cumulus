'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Fab from '@mui/material/Fab';
import Popover from '@mui/material/Popover';
import SvgIcon from '@mui/material/SvgIcon';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { FormEvent } from 'react';

import { useDomainPalette } from '@/components/domain-theme';
import { useShowNotice } from '@/components/notice';
import { neutral } from '@/lib/palette';
import { clusterPath } from '@/lib/routes';
import { useTRPC } from '@/trpc/client';

const PLUS = 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z';

/** The + in the corner of the domain cloud: name a cluster and it joins the orbit. */
export function NewClusterButton({ domainSlug }: { domainSlug: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const palette = useDomainPalette();
  const showNotice = useShowNotice();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [title, setTitle] = useState('');

  const create = useMutation(
    trpc.cluster.create.mutationOptions({
      onSettled: () => {
        void queryClient.invalidateQueries({ queryKey: trpc.cluster.list.queryKey({ domainSlug }) });
        void queryClient.invalidateQueries({ queryKey: trpc.domain.pathKey() });
      },
    }),
  );

  const close = () => {
    setAnchor(null);
    setTitle('');
    create.reset();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const name = title.trim();
    if (!name || create.isPending) return;
    create.mutate(
      { domainSlug, title: name },
      {
        onSuccess: (cluster) => {
          close();
          showNotice(`Created ${cluster.title}.`, { label: 'Open', href: clusterPath(domainSlug, cluster.slug) });
        },
      },
    );
  };

  // A clash with an existing name explains itself; anything else is unexpected.
  const errorText = create.error
    ? create.error.data?.code === 'CONFLICT'
      ? create.error.message
      : 'That cluster couldn’t be created.'
    : null;

  return (
    <>
      <Tooltip title="New cluster" placement="left">
        <Fab
          size="medium"
          aria-label="New cluster"
          aria-haspopup="dialog"
          aria-expanded={Boolean(anchor)}
          onClick={(event) => setAnchor(event.currentTarget)}
          sx={{
            position: 'absolute',
            right: 24,
            bottom: 24,
            bgcolor: palette.soft,
            color: palette.accent,
            border: `1px solid ${palette.border}`,
            boxShadow: 'none',
            '&:hover': { bgcolor: palette.border },
          }}
        >
          <SvgIcon>
            <path d={PLUS} />
          </SvgIcon>
        </Fab>
      </Tooltip>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { mt: -1.5, p: 2, width: 300, bgcolor: neutral.surface, border: `1px solid ${neutral.line}` },
          },
        }}
      >
        <Box component="form" onSubmit={submit} aria-label="New cluster">
          <TextField
            label="Cluster name"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              if (create.isError) create.reset();
            }}
            autoFocus
            fullWidth
            size="small"
            error={Boolean(errorText)}
            helperText={errorText ?? 'Enter to create'}
            slotProps={{ htmlInput: { maxLength: 80 } }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
            <Button size="small" color="inherit" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="small" variant="outlined" disabled={!title.trim() || create.isPending}>
              Create
            </Button>
          </Box>
        </Box>
      </Popover>
    </>
  );
}
