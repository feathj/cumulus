import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export default function CloudLoading() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
      <CircularProgress size={22} aria-label="Loading" />
    </Box>
  );
}
