import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

/** Today: the focus block and the day's journal, together. Not built yet. */
export default function TodayPage() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, overflowY: 'auto', px: { xs: 2.5, md: 5 }, pt: 4.5, pb: 7 }}>
      <Box sx={{ maxWidth: 760 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 15, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase' }}
        >
          Today
        </Typography>
        <Typography sx={{ mt: 0.5, fontSize: 13.5, lineHeight: 1.5, color: 'text.secondary', maxWidth: '58ch' }}>
          The focus block and the day’s journal will live here side by side: what you’re working on
          now, and what you’re thinking about it. Not built yet.
        </Typography>
      </Box>
    </Box>
  );
}
