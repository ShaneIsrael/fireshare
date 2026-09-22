import React from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Box, IconButton, Tooltip, Typography } from '@mui/material'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import HomeIcon from '@mui/icons-material/Home'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import VideoLibraryIcon from '@mui/icons-material/VideoLibrary'
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import FolderCopyIcon from '@mui/icons-material/FolderCopy'
import { SIDEBAR_PAGES } from '../../common/sidebarPages'

const PAGE_ICONS = {
  home: <HomeIcon />,
  videos: <VideoLibraryIcon />,
  images: <PhotoLibraryIcon />,
  games: <SportsEsportsIcon />,
  tags: <LocalOfferIcon />,
  folders: <FolderCopyIcon />,
}

// The divider is itself a member of the reorderable list. It cannot be picked
// up, but rows dragged past it displace it like any other item, which is what
// makes "drop it below the line to hide it" work without a second list.
const DIVIDER = '__inactive__'
const PAGES_BY_KEY = Object.fromEntries(SIDEBAR_PAGES.map((p) => [p.key, p]))

const rowSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1,
  height: 48,
  pl: 0.5,
  pr: 0.75,
  border: '1px solid rgba(194, 224, 255, 0.18)',
  borderRadius: '8px',
  bgcolor: '#0A1929',
  userSelect: 'none',
}

// Rows are picked up by their handle rather than anywhere on the row, so on a
// phone a finger on the label still scrolls the page and only the handle drags.
function PageRow({ page, enabled, landing, onToggle }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={page.key}
      as="div"
      dragListener={false}
      dragControls={controls}
      whileDrag={{ scale: 1.02, boxShadow: '0 12px 28px rgba(0, 0, 0, 0.55)', zIndex: 2 }}
      style={{ position: 'relative', borderRadius: 8 }}
    >
      <Box sx={{ ...rowSx, opacity: enabled ? 1 : 0.6 }}>
        <Box
          role="button"
          aria-label={`Drag to reorder ${page.title}`}
          onPointerDown={(e) => controls.start(e)}
          sx={{
            display: 'flex',
            p: 0.5,
            cursor: 'grab',
            touchAction: 'none',
            color: 'rgba(255, 255, 255, 0.35)',
            '&:hover': { color: 'rgba(255, 255, 255, 0.7)' },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicatorIcon />
        </Box>
        <Box
          sx={{
            display: 'flex',
            color: enabled ? '#66B2FF' : 'rgba(255, 255, 255, 0.4)',
            '& svg': { fontSize: 21 },
          }}
        >
          {PAGE_ICONS[page.key]}
        </Box>
        <Typography sx={{ flex: 1, fontSize: 15, fontWeight: 600, color: enabled ? '#fff' : '#B2BAC2' }}>
          {page.title}
        </Typography>
        {landing && (
          <Tooltip title="The page that opens when someone visits /" placement="left">
            <Box
              sx={{
                height: 22,
                px: 1,
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid #0059B2',
                borderRadius: 11,
                bgcolor: '#132F4C',
                color: '#99CCF3',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
            >
              Landing page
            </Box>
          </Tooltip>
        )}
        <Tooltip title={enabled ? 'Hide from sidebar' : 'Show in sidebar'} placement="left">
          <IconButton
            size="small"
            onClick={onToggle}
            aria-label={enabled ? `Hide ${page.title} from sidebar` : `Show ${page.title} in sidebar`}
            sx={{ color: enabled ? 'rgba(255, 255, 255, 0.6)' : '#FF6B6B' }}
          >
            {enabled ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
    </Reorder.Item>
  )
}

function DividerRow({ empty }) {
  return (
    <Reorder.Item value={DIVIDER} as="div" dragListener={false} style={{ position: 'relative' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
        <Box sx={{ flex: 1, borderTop: '1px dashed rgba(255, 107, 107, 0.45)' }} />
        <Typography
          sx={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255, 107, 107, 0.85)',
            whiteSpace: 'nowrap',
          }}
        >
          Inactive · hidden from the sidebar
        </Typography>
        <Box sx={{ flex: 1, borderTop: '1px dashed rgba(255, 107, 107, 0.45)' }} />
      </Box>
      {empty && (
        <Box
          sx={{
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px dashed rgba(194, 224, 255, 0.18)',
            borderRadius: '8px',
            color: 'rgba(255, 255, 255, 0.35)',
            fontSize: 13,
          }}
        >
          Drag a page here to hide it
        </Box>
      )}
    </Reorder.Item>
  )
}

/**
 * Drag-to-arrange editor for the sidebar's content pages. `pages` is the
 * resolved [{ key, enabled }] list (see common/sidebarPages.js); `onChange`
 * receives the full list in its new order whenever a row is moved or toggled.
 */
export default function SidebarPagesEditor({ pages, onChange }) {
  const values = React.useMemo(() => {
    const active = pages.filter((p) => p.enabled).map((p) => p.key)
    const inactive = pages.filter((p) => !p.enabled).map((p) => p.key)
    return [...active, DIVIDER, ...inactive]
  }, [pages])
  const inactiveCount = values.length - 1 - values.indexOf(DIVIDER)

  const emit = (nextValues) => {
    const dividerAt = nextValues.indexOf(DIVIDER)
    onChange(
      nextValues
        .filter((v) => v !== DIVIDER)
        .map((key) => ({ key, enabled: nextValues.indexOf(key) < dividerAt })),
    )
  }

  // The eye button is the no-drag route across the divider: a hidden page goes
  // back to the bottom of the active group, a shown one to the top of inactive.
  const toggle = (key) => {
    const without = values.filter((v) => v !== key)
    const dividerAt = without.indexOf(DIVIDER)
    const wasEnabled = values.indexOf(key) < values.indexOf(DIVIDER)
    const insertAt = wasEnabled ? dividerAt + 1 : dividerAt
    emit([...without.slice(0, insertAt), key, ...without.slice(insertAt)])
  }

  return (
    <Box>
      <Typography sx={{ fontSize: 14, color: 'text.secondary', mb: 1.5 }}>
        Drag pages to set the order they appear in the sidebar. Drop a page below the line to hide it. The top page
        is the one <Box component="span" sx={{ fontFamily: 'monospace', color: '#CDD2D7' }}>/</Box> opens.
      </Typography>
      <Reorder.Group
        axis="y"
        values={values}
        onReorder={emit}
        as="div"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: 0, padding: 0 }}
      >
        {values.map((value, index) =>
          value === DIVIDER ? (
            <DividerRow key={value} empty={inactiveCount === 0} />
          ) : (
            <PageRow
              key={value}
              page={PAGES_BY_KEY[value]}
              enabled={index < values.indexOf(DIVIDER)}
              landing={index === 0}
              onToggle={() => toggle(value)}
            />
          ),
        )}
      </Reorder.Group>
    </Box>
  )
}
