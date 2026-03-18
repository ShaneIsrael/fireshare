import React from 'react'
import { Box, Button, CircularProgress, Modal, Stack, Typography, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import CheckIcon from '@mui/icons-material/Check'
import { GameService } from '../../services'

// ─── Style constants ──────────────────────────────────────────────────────────

const modalSx = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 700,
  maxWidth: '95vw',
  maxHeight: '90vh',
  bgcolor: '#041223',
  border: '1px solid #FFFFFF1A',
  borderRadius: '12px',
  boxShadow: '0 16px 48px #00000099',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}


const TABS = [
  { type: 'hero', label: 'Hero', aspectRatio: '16 / 5', gridCols: 'repeat(auto-fill, minmax(240px, 1fr))', fit: 'cover' },
  { type: 'logo', label: 'Logo', aspectRatio: '3 / 2',  gridCols: 'repeat(auto-fill, minmax(160px, 1fr))', fit: 'contain' },
  { type: 'icon', label: 'Icon', aspectRatio: '1 / 1',  gridCols: 'repeat(auto-fill, minmax(110px, 1fr))', fit: 'cover' },
]

// ─── Tab bar item ─────────────────────────────────────────────────────────────

const TabItem = ({ tab, isActive, onClick }) => (
  <Box
    onClick={onClick}
    sx={{
      px: 2,
      py: 1.5,
      cursor: 'pointer',
      fontSize: 12,
      fontWeight: 600,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      color: isActive ? 'white' : '#FFFFFFB3',
      borderBottom: '2px solid',
      borderColor: isActive ? '#3399FF' : 'transparent',
      transition: 'color 0.15s ease, border-color 0.15s ease',
      '&:hover': { color: 'white' },
      userSelect: 'none',
    }}
  >
    {tab.label}
  </Box>
)

// ─── Main component ───────────────────────────────────────────────────────────

const EditGameAssetsModal = ({ game, open, onClose, onSaved }) => {
  const [activeTabIndex, setActiveTabIndex] = React.useState(0)
  const [options, setOptions] = React.useState(null)
  const [loadingOptions, setLoadingOptions] = React.useState(false)
  const [pendingSelections, setPendingSelections] = React.useState({})
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open && game) {
      setActiveTabIndex(0)
      setPendingSelections({})
      setOptions(null)
      setLoadingOptions(true)
      GameService.getGameAssetOptions(game.steamgriddb_id)
        .then((res) => setOptions(res.data))
        .catch((err) => {
          console.error('Failed to fetch asset options:', err)
          setOptions({ heroes: [], logos: [], icons: [] })
        })
        .finally(() => setLoadingOptions(false))
    }
  }, [open, game])

  const handleSave = async () => {
    if (Object.keys(pendingSelections).length === 0) {
      onClose()
      return
    }
    setSaving(true)
    try {
      await Promise.all(
        Object.entries(pendingSelections).map(([assetType, url]) =>
          GameService.updateGameAsset(game.steamgriddb_id, assetType, url),
        ),
      )
      onSaved()
    } catch (err) {
      console.error('Failed to save asset changes:', err)
    } finally {
      setSaving(false)
    }
  }

  const getOptionsForTab = (tabIndex) => {
    if (!options) return []
    const type = TABS[tabIndex].type
    if (type === 'hero') return options.heroes || []
    if (type === 'logo') return options.logos || []
    return options.icons || []
  }

  const activeTab = TABS[activeTabIndex]
  const currentOptions = getOptionsForTab(activeTabIndex)
  const hasPendingChanges = Object.keys(pendingSelections).length > 0

  return (
    <Modal open={open} onClose={onClose}>
      <Box sx={modalSx}>
        {/* ── Header ── */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 3,
            py: 2.5,
            borderBottom: '1px solid #FFFFFF14',
            flexShrink: 0,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'white' }}>
            Edit {game?.name}
          </Typography>
          <IconButton
            onClick={onClose}
            size="small"
            sx={{ color: '#FFFFFF66', '&:hover': { color: 'white', bgcolor: '#FFFFFF14' } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* ── Tab bar ── */}
        <Box
          sx={{
            display: 'flex',
            borderBottom: '1px solid #FFFFFF14',
            px: 1,
            flexShrink: 0,
          }}
        >
          {TABS.map((tab, i) => (
            <TabItem
              key={tab.type}
              tab={tab}
              isActive={activeTabIndex === i}
              onClick={() => setActiveTabIndex(i)}
            />
          ))}
        </Box>

        {/* ── Content area ── */}
        <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
          {loadingOptions ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180 }}>
                <CircularProgress size={32} sx={{ color: '#3399FF' }} />
              </Box>
            ) : currentOptions.length === 0 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 180 }}>
                <Typography sx={{ color: '#FFFFFF4D', fontSize: 14 }}>
                  No options available from SteamGridDB
                </Typography>
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: activeTab.gridCols,
                  gap: 1.5,
                }}
              >
                {currentOptions.map((item) => {
                  const isSelected = pendingSelections[activeTab.type] === item.url
                  return (
                    <Box
                      key={item.id}
                      onClick={() =>
                        setPendingSelections((prev) => ({ ...prev, [activeTab.type]: item.url }))
                      }
                      sx={{
                        position: 'relative',
                        aspectRatio: activeTab.aspectRatio,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        border: '2px solid',
                        borderColor: isSelected ? '#3399FF' : '#FFFFFF1A',
                        bgcolor: '#FFFFFF0D',
                        transition: 'border-color 0.15s ease, transform 0.15s ease',
                        '&:hover': {
                          borderColor: isSelected ? '#3399FF' : '#FFFFFF44',
                          transform: 'scale(1.03)',
                        },
                      }}
                    >
                      <Box
                        component="img"
                        src={item.thumb || item.url}
                        alt=""
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: activeTab.fit,
                        }}
                      />
                      {isSelected && (
                        <Box
                          sx={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            bgcolor: '#3399FF',
                            borderRadius: '50%',
                            width: 22,
                            height: 22,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <CheckIcon sx={{ fontSize: 14, color: 'white' }} />
                        </Box>
                      )}
                    </Box>
                  )
                })}
              </Box>
            )}
        </Box>

        {/* ── Footer ── */}
        <Box
          sx={{
            px: 3,
            py: 2,
            borderTop: '1px solid #FFFFFF14',
            flexShrink: 0,
          }}
        >
          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              onClick={onClose}
              disabled={saving}
              sx={{ color: 'white', borderColor: '#FFFFFF44', '&:hover': { borderColor: 'white', bgcolor: '#FFFFFF12' } }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handleSave}
              disabled={saving || !hasPendingChanges}
              sx={{ bgcolor: '#3399FF', '&:hover': { bgcolor: '#1976D2' } }}
            >
              {saving ? <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} /> : null}
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </Stack>
        </Box>
      </Box>
    </Modal>
  )
}

export default EditGameAssetsModal
