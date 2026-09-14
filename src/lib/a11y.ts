/**
 * Hidden on screen but read by screen readers, and shown again while keyboard
 * focus is inside it — so it can hold the focusable alternative to a canvas.
 */
export const srOnlyUntilFocused = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  p: 0,
  m: '-1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
  border: 0,
  '&:focus-within': {
    width: 'auto',
    height: 'auto',
    maxHeight: '60%',
    overflowY: 'auto',
    clip: 'auto',
    whiteSpace: 'normal',
    m: 0,
    left: 16,
    top: 16,
    zIndex: 3,
    p: 1.5,
    listStyle: 'none',
    bgcolor: 'background.paper',
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
  },
} as const;
