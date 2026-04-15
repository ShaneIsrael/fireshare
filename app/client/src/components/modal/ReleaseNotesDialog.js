import * as React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Chip,
  Divider,
  CircularProgress,
  IconButton,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ReleaseService } from '../../services'
import { dialogPaperSx } from '../../common/modalStyles'

const INITIAL_LIMIT = 3

function formatDate(isoString) {
  if (!isoString) return ''
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

// Custom renderers for GitHub-flavored markdown, dark theme
const markdownComponents = {
  h1: ({ children }) => (
    <Typography sx={{ color: 'white', fontWeight: 700, fontSize: 15, mt: 2, mb: 0.75, lineHeight: 1.4 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography
      sx={{
        color: '#2684FF',
        fontWeight: 700,
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        mt: 2,
        mb: 0.75,
      }}
    >
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography sx={{ color: 'rgba(194, 224, 255, 0.85)', fontWeight: 600, fontSize: 13, mt: 1.5, mb: 0.5 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography
      component="p"
      sx={{ color: 'rgba(194, 224, 255, 0.65)', fontSize: 13, lineHeight: 1.7, mb: 0.75, mt: 0 }}
    >
      {children}
    </Typography>
  ),
  ul: ({ children }) => (
    <Box
      component="ul"
      sx={{
        color: 'rgba(194, 224, 255, 0.65)',
        fontSize: 13,
        pl: 2.5,
        mt: 0.25,
        mb: 0.75,
        '& li + li': { mt: 0.3 },
      }}
    >
      {children}
    </Box>
  ),
  ol: ({ children }) => (
    <Box
      component="ol"
      sx={{
        color: 'rgba(194, 224, 255, 0.65)',
        fontSize: 13,
        pl: 2.5,
        mt: 0.25,
        mb: 0.75,
        '& li + li': { mt: 0.3 },
      }}
    >
      {children}
    </Box>
  ),
  li: ({ children }) => <Box component="li" sx={{ lineHeight: 1.7 }}>{children}</Box>,
  a: ({ href, children }) => (
    <Box
      component="a"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      sx={{ color: '#3399FF', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
    >
      {children}
    </Box>
  ),
  strong: ({ children }) => (
    <Box component="strong" sx={{ color: 'rgba(194, 224, 255, 0.9)', fontWeight: 600 }}>
      {children}
    </Box>
  ),
  em: ({ children }) => (
    <Box component="em" sx={{ color: 'rgba(194, 224, 255, 0.6)', fontStyle: 'italic' }}>
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box
      sx={{
        borderLeft: '3px solid rgba(50, 153, 255, 0.4)',
        pl: 1.5,
        ml: 0,
        my: 1,
        '& p': { color: 'rgba(194, 224, 255, 0.45)', fontStyle: 'italic' },
      }}
    >
      {children}
    </Box>
  ),
  hr: () => <Divider sx={{ my: 1.5, borderColor: '#FFFFFF12' }} />,
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        bgcolor: '#FFFFFF08',
        border: '1px solid #FFFFFF14',
        borderRadius: '8px',
        p: 1.5,
        overflow: 'auto',
        my: 1,
        '& code': {
          all: 'unset',
          fontFamily: 'monospace',
          fontSize: 12,
          color: 'rgba(194, 224, 255, 0.8)',
          whiteSpace: 'pre',
        },
      }}
    >
      {children}
    </Box>
  ),
  code: ({ className, children }) => {
    // Fenced code blocks have a language-xxx className; inline code does not
    if (className) {
      return (
        <code className={className} style={{ fontFamily: 'monospace' }}>
          {children}
        </code>
      )
    }
    return (
      <Box
        component="code"
        sx={{
          bgcolor: '#FFFFFF14',
          color: '#E06C75',
          fontSize: '0.82em',
          px: 0.75,
          py: 0.2,
          borderRadius: '4px',
          fontFamily: 'monospace',
        }}
      >
        {children}
      </Box>
    )
  },
}

function ReleaseCard({ release, showDivider, isLatest }) {
  const showName = release.name && release.name !== `v${release.version}` && release.name !== release.version

  return (
    <Box sx={{ px: 3, pt: 2.5, pb: showDivider ? 0 : 0.5 }}>
      {/* Header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5, flexWrap: 'wrap' }}>
        <Chip
          label={`v${release.version}`}
          size="small"
          sx={isLatest ? {
            bgcolor: 'rgba(255, 179, 0, 0.1)',
            color: '#FFB300',
            fontWeight: 700,
            fontFamily: 'monospace',
            fontSize: 12,
            height: 22,
            borderRadius: '6px',
            border: '1px solid rgba(255, 179, 0, 0.25)',
          } : {
            bgcolor: 'rgba(50, 153, 255, 0.12)',
            color: '#3399FF',
            fontWeight: 700,
            fontFamily: 'monospace',
            fontSize: 12,
            height: 22,
            borderRadius: '6px',
            border: '1px solid rgba(50, 153, 255, 0.25)',
          }}
        />
        {showName && (
          <Typography sx={{ color: 'rgba(194, 224, 255, 0.75)', fontSize: 13, fontWeight: 600 }}>
            {release.name}
          </Typography>
        )}
        <Typography sx={{ color: 'rgba(194, 224, 255, 0.3)', fontSize: 12 }}>
          {formatDate(release.published_at)}
        </Typography>
      </Box>

      {/* Markdown body */}
      <Box sx={{ '& > *:first-of-type': { mt: '0 !important' } }}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {release.body || '_No release notes provided._'}
        </ReactMarkdown>
      </Box>

      {/* GitHub link */}
      {release.html_url && (
        <Box
          component="a"
          href={release.html_url}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: 'rgba(194, 224, 255, 0.3)',
            fontSize: 12,
            mt: 1,
            mb: showDivider ? 2.5 : 1,
            textDecoration: 'none',
            transition: 'color 0.15s',
            '&:hover': { color: '#3399FF' },
          }}
        >
          View on GitHub
          <OpenInNewIcon sx={{ fontSize: 12 }} />
        </Box>
      )}

      {showDivider && <Divider sx={{ borderColor: '#FFFFFF0E' }} />}
    </Box>
  )
}

function ReleaseNotesDialog({ open, onClose, authenticated }) {
  const [releases, setReleases] = React.useState([])
  const [loading, setLoading] = React.useState(false)
  const [hasMore, setHasMore] = React.useState(false)
  const [offset, setOffset] = React.useState(0)

  const fetchReleases = React.useCallback(async (currentOffset) => {
    setLoading(true)
    try {
      const res = await ReleaseService.getReleases(currentOffset, INITIAL_LIMIT)
      const data = res.data
      setReleases((prev) => (currentOffset === 0 ? data.releases : [...prev, ...data.releases]))
      setHasMore(data.has_more)
      setOffset(currentOffset + data.releases.length)
    } catch (err) {
      console.error('Failed to fetch releases', err)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    if (open) {
      setReleases([])
      setOffset(0)
      setHasMore(false)
      fetchReleases(0)
    }
  }, [open, fetchReleases])

  const handleClose = () => {
    if (releases.length > 0 && authenticated) {
      ReleaseService.setLastSeenVersion(releases[0].version).catch(() => {})
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{ sx: dialogPaperSx }}
    >
      <DialogTitle sx={{ px: 3, py: 2, borderBottom: '1px solid #FFFFFF0E' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontWeight: 800, color: 'white', fontSize: 16, letterSpacing: '0.02em' }}>
            Release Notes
          </Typography>
          <IconButton
            onClick={handleClose}
            size="small"
            sx={{
              color: 'rgba(194, 224, 255, 0.35)',
              '&:hover': { color: 'rgba(194, 224, 255, 0.85)', bgcolor: 'rgba(194, 224, 255, 0.08)' },
            }}
          >
            <CloseIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        {loading && releases.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: '#3399FF' }} />
          </Box>
        ) : (
          <>
            {releases.map((release, i) => (
              <ReleaseCard key={release.version} release={release} showDivider={i < releases.length - 1} isLatest={i === 0} />
            ))}
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              {loading ? (
                <CircularProgress size={22} sx={{ color: '#3399FF' }} />
              ) : hasMore ? (
                <Button
                  onClick={() => fetchReleases(offset)}
                  variant="outlined"
                  size="small"
                  sx={{
                    color: 'rgba(194, 224, 255, 0.55)',
                    borderColor: 'rgba(194, 224, 255, 0.18)',
                    borderRadius: '8px',
                    textTransform: 'none',
                    fontSize: 13,
                    '&:hover': {
                      borderColor: 'rgba(194, 224, 255, 0.45)',
                      bgcolor: 'rgba(194, 224, 255, 0.05)',
                    },
                  }}
                >
                  Load more releases
                </Button>
              ) : null}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #FFFFFF0E' }}>
        <Button
          onClick={handleClose}
          variant="contained"
          sx={{
            bgcolor: '#3399FF',
            '&:hover': { bgcolor: '#1976D2' },
            borderRadius: '8px',
            textTransform: 'none',
          }}
        >
          Got it
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ReleaseNotesDialog
