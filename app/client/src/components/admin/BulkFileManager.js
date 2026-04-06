import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Modal,
  Stack,
  TextField,
  Tooltip,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import SearchIcon from '@mui/icons-material/Search'
import FolderIcon from '@mui/icons-material/Folder'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import VideoSettingsIcon from '@mui/icons-material/VideoSettings'
import RefreshIcon from '@mui/icons-material/Refresh'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import Select from 'react-select'
import selectFolderTheme from '../../common/reactSelectFolderTheme'
import { dialogPaperSx, labelSx } from '../../common/modalStyles'
import Api from '../../services/Api'

function formatSize(bytes) {
  if (bytes == null || bytes === 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds)) return '—'
  const s = Math.floor(seconds)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function formatDate(isoString) {
  if (!isoString) return '—'
  try {
    return new Date(isoString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

function formatResolution(width, height) {
  if (!width || !height) return '—'
  const shortSide = Math.min(width, height)
  if (shortSide >= 2160) return '4K'
  if (shortSide >= 1440) return '1440p'
  if (shortSide >= 1080) return '1080p'
  if (shortSide >= 720) return '720p'
  if (shortSide >= 480) return '480p'
  return `${width}×${height}`
}

function sortFiles(files, column, dir) {
  const sorted = [...files]
  const mul = dir === 'asc' ? 1 : -1
  switch (column) {
    case 'name':
      return sorted.sort((a, b) => mul * (a.title || a.filename).localeCompare(b.title || b.filename))
    case 'size':
      return sorted.sort((a, b) => mul * ((a.size || 0) - (b.size || 0)))
    case 'duration':
      return sorted.sort((a, b) => mul * ((a.duration || 0) - (b.duration || 0)))
    case 'date':
      return sorted.sort((a, b) => mul * (new Date(a.created_at || 0) - new Date(b.created_at || 0)))
    default:
      return sorted
  }
}

const headCellSx = {
  color: '#FFFFFF99',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  borderBottom: '1px solid #FFFFFF18',
  bgcolor: '#0e233a',
  py: 1.25,
  whiteSpace: 'nowrap',
}

const bodyCellSx = {
  borderBottom: '1px solid #FFFFFF0D',
  py: 0.75,
  fontSize: 13,
  color: '#FFFFFFCC',
}

const folderRowSx = {
  bgcolor: '#FFFFFF06',
  borderTop: '2px solid #FFFFFF12',
  '&:first-of-type': { borderTop: 'none' },
}

export default function BulkFileManager({ setAlert }) {
  const [files, setFiles] = useState([])
  const [folders, setFolders] = useState([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [folderFilter, setFolderFilter] = useState('__all__')
  const [sortColumn, setSortColumn] = useState('date')
  const [sortDir, setSortDir] = useState('desc')

  const [selected, setSelected] = useState(new Set())
  const [collapsedFolders, setCollapsedFolders] = useState(new Set())

  const toggleFolderCollapse = (folder) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      next.has(folder) ? next.delete(folder) : next.add(folder)
      return next
    })
  }

  // Dialog / modal open states
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [moveModalOpen, setMoveModalOpen] = useState(false)
  const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false)
  const [removeTranscodesDialogOpen, setRemoveTranscodesDialogOpen] = useState(false)
  const [removeCropDialogOpen, setRemoveCropDialogOpen] = useState(false)

  // Form state
  const [moveTargetFolder, setMoveTargetFolder] = useState(null) // react-select option {value, label} | null
  const [newFolderName, setNewFolderName] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await Api().get('/api/admin/files')
      setFiles(data.files || [])
      setFolders(data.folders || [])
    } catch (err) {
      console.error(err)
      setAlert({ open: true, message: err.response?.data || 'Failed to load files', type: 'error' })
    } finally {
      setLoading(false)
    }
  }, [setAlert])

  useEffect(() => {
    fetchFiles()
  }, [fetchFiles])

  const filteredFiles = useMemo(() => {
    let result = files

    if (folderFilter !== '__all__') {
      result = result.filter((f) => f.folder === folderFilter)
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (f) => (f.title || '').toLowerCase().includes(q) || (f.filename || '').toLowerCase().includes(q),
      )
    }

    return sortFiles(result, sortColumn, sortDir)
  }, [files, folderFilter, search, sortColumn, sortDir])

  // Group files by folder — always include every known folder, even empty ones
  const groupedFiles = useMemo(() => {
    const filesByFolder = new Map()
    for (const f of filteredFiles) {
      const key = f.folder || ''
      if (!filesByFolder.has(key)) filesByFolder.set(key, [])
      filesByFolder.get(key).push(f)
    }

    if (folderFilter !== '__all__') {
      return [[folderFilter, filesByFolder.get(folderFilter) || []]]
    }

    // Union all known folders (including empty ones from the API)
    const allFolders = [...new Set([...folders, ...filesByFolder.keys()])]

    // Build [folder, files] pairs then sort folder groups by the "best" file
    // in each group according to the active sort, so that folder order reflects
    // the same sort the user applied (empty folders always go last alphabetically)
    const pairs = allFolders.map((f) => [f, filesByFolder.get(f) || []])
    pairs.sort(([aFolder, aFiles], [bFolder, bFiles]) => {
      if (aFiles.length === 0 && bFiles.length === 0) return aFolder.localeCompare(bFolder)
      if (aFiles.length === 0) return 1
      if (bFiles.length === 0) return -1
      // Each folder's files are already sorted; [0] is the "best" per sort dir
      const a = aFiles[0]
      const b = bFiles[0]
      const mul = sortDir === 'asc' ? 1 : -1
      switch (sortColumn) {
        case 'name': {
          const an = (a.title || a.filename || '').toLowerCase()
          const bn = (b.title || b.filename || '').toLowerCase()
          return mul * an.localeCompare(bn)
        }
        case 'size':
          return mul * ((a.size || 0) - (b.size || 0))
        case 'duration':
          return mul * ((a.duration || 0) - (b.duration || 0))
        case 'date':
          return mul * (new Date(a.created_at || 0) - new Date(b.created_at || 0))
        default:
          return aFolder.localeCompare(bFolder)
      }
    })
    return pairs
  }, [filteredFiles, folders, folderFilter, sortColumn, sortDir])

  const filteredIds = useMemo(() => new Set(filteredFiles.map((f) => f.video_id)), [filteredFiles])

  const allFilteredSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selected.has(f.video_id))

  const someFilteredSelected = filteredFiles.some((f) => selected.has(f.video_id)) && !allFilteredSelected

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        filteredIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const toggleSelect = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectedCount = selected.size

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortColumn(column)
      setSortDir('desc')
    }
  }

  const selectedFiles = useMemo(() => files.filter((f) => selected.has(f.video_id)), [files, selected])

  const uniqueCurrentFolders = useMemo(
    () => new Set(selectedFiles.map((f) => f.folder).filter(Boolean)),
    [selectedFiles],
  )

  const moveFolderOptions = useMemo(() => {
    let opts = folders
    if (uniqueCurrentFolders.size === 1) {
      const cur = [...uniqueCurrentFolders][0]
      opts = folders.filter((f) => f !== cur)
    }
    return opts.map((f) => ({ value: f, label: `/videos/${f}/` }))
  }, [folders, uniqueCurrentFolders])

  const runBulkAction = useCallback(
    async (endpoint, body, successMsg) => {
      setActionLoading(true)
      try {
        const { data } = await Api().post(endpoint, body)
        const updatedCount = (data.updated ?? data.moved ?? data.deleted ?? []).length
        const errorCount = (data.errors ?? []).length
        if (errorCount > 0) {
          setAlert({
            open: true,
            message: `${successMsg}: ${updatedCount} succeeded, ${errorCount} error${errorCount !== 1 ? 's' : ''}`,
            type: 'warning',
          })
        } else {
          setAlert({ open: true, message: `${successMsg} (${updatedCount})`, type: 'success' })
        }
        setSelected(new Set())
        await fetchFiles()
        return true
      } catch (err) {
        console.error(err)
        setAlert({ open: true, message: err.response?.data || 'Action failed', type: 'error' })
        return false
      } finally {
        setActionLoading(false)
      }
    },
    [fetchFiles, setAlert],
  )

  const handleDelete = async () => {
    const ok = await runBulkAction('/api/admin/files/bulk-delete', { video_ids: [...selected] }, 'Deleted files')
    if (ok) setDeleteDialogOpen(false)
  }

  const handleMove = async () => {
    if (!moveTargetFolder) return
    setActionLoading(true)
    try {
      const { data } = await Api().post('/api/admin/files/bulk-move', {
        video_ids: [...selected],
        folder: moveTargetFolder.value,
      })
      const movedCount = (data.moved ?? []).length
      const errorCount = (data.errors ?? []).length
      if (errorCount > 0) {
        setAlert({
          open: true,
          message: `Moved ${movedCount}, ${errorCount} error${errorCount !== 1 ? 's' : ''}`,
          type: 'warning',
        })
      } else {
        setAlert({
          open: true,
          message: `Moved ${movedCount} file${movedCount !== 1 ? 's' : ''} to "${moveTargetFolder.value}"`,
          type: 'success',
        })
      }
      setSelected(new Set())
      setMoveModalOpen(false)
      setMoveTargetFolder(null)
      await fetchFiles()
    } catch (err) {
      setAlert({ open: true, message: err.response?.data || 'Move failed', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveTranscodes = async () => {
    const ok = await runBulkAction(
      '/api/admin/files/bulk-remove-transcodes',
      { video_ids: [...selected] },
      'Removed transcodes',
    )
    if (ok) setRemoveTranscodesDialogOpen(false)
  }

  const handleRemoveCrop = async () => {
    const ok = await runBulkAction('/api/admin/files/bulk-remove-crop', { video_ids: [...selected] }, 'Removed crop')
    if (ok) setRemoveCropDialogOpen(false)
  }

  const handleSetPrivacy = async (isPrivate) => {
    await runBulkAction(
      '/api/admin/files/bulk-set-privacy',
      { video_ids: [...selected], private: isPrivate },
      isPrivate ? 'Set to private' : 'Set to public',
    )
  }

  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setActionLoading(true)
    try {
      await Api().post('/api/admin/folders/create', { name })
      setAlert({ open: true, message: `Folder "${name}" created`, type: 'success' })
      setNewFolderName('')
      setCreateFolderDialogOpen(false)
      await fetchFiles()
    } catch (err) {
      setAlert({ open: true, message: err.response?.data || 'Failed to create folder', type: 'error' })
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress size={36} />
      </Box>
    )
  }

  const COL_SPAN = 9 // checkbox + 8 data columns

  return (
    <Box>
      {/* ── Selected actions row (only when items are selected) ── */}
      {selectedCount > 0 && (
        <Stack
          direction="row"
          alignItems="center"
          flexWrap="wrap"
          sx={{ mb: 1, px: 1, py: 0.75, borderRadius: '8px', bgcolor: '#FFFFFF0D', gap: 2 }}
        >
          <Typography variant="body2" sx={{ color: '#FFFFFFCC', mr: 0.5, whiteSpace: 'nowrap' }}>
            {selectedCount} selected
          </Typography>

          <Tooltip title="Move selected to another folder">
            <Button
              size="small"
              variant="outlined"
              startIcon={<DriveFileMoveIcon />}
              onClick={() => {
                setMoveTargetFolder(null)
                setMoveModalOpen(true)
              }}
              sx={{
                textTransform: 'none',
                borderColor: '#FFFFFF33',
                color: '#FFFFFFCC',
                '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
              }}
            >
              Move
            </Button>
          </Tooltip>

          <Tooltip title="Remove transcoded versions (480p / 720p / 1080p)">
            <Button
              size="small"
              variant="outlined"
              startIcon={<VideoSettingsIcon />}
              onClick={() => setRemoveTranscodesDialogOpen(true)}
              sx={{
                textTransform: 'none',
                borderColor: '#FFFFFF33',
                color: '#FFFFFFCC',
                '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
              }}
            >
              Remove Transcodes
            </Button>
          </Tooltip>

          <Tooltip title="Remove crop settings from selected files">
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCutIcon />}
              onClick={() => setRemoveCropDialogOpen(true)}
              sx={{
                textTransform: 'none',
                borderColor: '#FFFFFF33',
                color: '#FFFFFFCC',
                '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
              }}
            >
              Remove Crop
            </Button>
          </Tooltip>

          <Tooltip title="Make selected files public">
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockOpenIcon />}
              onClick={() => handleSetPrivacy(false)}
              disabled={actionLoading}
              sx={{
                textTransform: 'none',
                borderColor: '#1DB95444',
                color: '#1DB954',
                '&:hover': { borderColor: '#1DB954', bgcolor: '#1DB95412' },
              }}
            >
              Set Public
            </Button>
          </Tooltip>

          <Tooltip title="Make selected files private">
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockIcon />}
              onClick={() => handleSetPrivacy(true)}
              disabled={actionLoading}
              sx={{
                textTransform: 'none',
                borderColor: '#FFFFFF33',
                color: '#FFFFFFCC',
                '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
              }}
            >
              Set Private
            </Button>
          </Tooltip>
          <Tooltip title="Delete selected files">
            <Button
              size="small"
              variant="contained"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={() => setDeleteDialogOpen(true)}
              sx={{ textTransform: 'none' }}
            >
              Delete
            </Button>
          </Tooltip>
        </Stack>
      )}

      {/* ── Search / folder filter / create folder ── */}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
        <TextField
          size="small"
          placeholder="Search by name or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: '#FFFFFF55', fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            flex: 1,
            height: 38,
            '& .MuiOutlinedInput-root': {
              '& fieldset': { borderColor: '#FFFFFF22' },
              '&:hover fieldset': { borderColor: '#FFFFFF44' },
              '&.Mui-focused fieldset': { borderColor: '#FFFFFF66' },
            },
            '& input': { color: '#FFFFFFCC' },
            '& .MuiInputBase-input::placeholder': { color: '#FFFFFF55' },
          }}
        />

        <Box sx={{ minWidth: 160 }}>
          <Select
            options={[
              { value: '__all__', label: 'All Folders' },
              ...folders.sort((a, b) => a.localeCompare(b)).map((f) => ({ value: f, label: f })),
            ]}
            value={
              folderFilter === '__all__'
                ? { value: '__all__', label: 'All Folders' }
                : { value: folderFilter, label: folderFilter }
            }
            onChange={(opt) => setFolderFilter(opt.value)}
            styles={selectFolderTheme}
            isSearchable={false}
          />
        </Box>

        <Tooltip title="Create a new empty folder in /videos">
          <Button
            size="medium"
            variant="outlined"
            startIcon={<CreateNewFolderIcon />}
            onClick={() => {
              setNewFolderName('')
              setCreateFolderDialogOpen(true)
            }}
            sx={{
              height: 38,
              textTransform: 'none',
              whiteSpace: 'nowrap',
              borderColor: '#FFFFFF33',
              color: '#FFFFFFCC',
              '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
            }}
          >
            Create Folder
          </Button>
        </Tooltip>

        <Tooltip title="Refresh file list">
          <IconButton
            onClick={fetchFiles}
            disabled={loading}
            sx={{
              border: '1px solid #FFFFFF33',
              borderRadius: 1,
              color: '#FFFFFFCC',
              '&:hover': { borderColor: '#FFFFFF66', bgcolor: '#FFFFFF0D' },
            }}
          >
            <RefreshIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* ── File table ── */}
      <TableContainer
        sx={{
          borderRadius: '8px',
          border: '1px solid #FFFFFF14',
          bgcolor: '#FFFFFF05',
          maxHeight: 600,
          overflow: 'auto',
        }}
      >
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ ...headCellSx, width: 40 }}>
                <Checkbox
                  size="small"
                  indeterminate={someFilteredSelected}
                  checked={allFilteredSelected}
                  onChange={toggleSelectAll}
                  sx={{ color: '#FFFFFF44', '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#3399FF' } }}
                />
              </TableCell>
              {[
                {
                  col: 'name',
                  label: 'Name',
                  sx: { maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
                },
                { col: 'size', label: 'Size', sx: { width: 110, minWidth: 110, whiteSpace: 'nowrap' } },
                { col: 'duration', label: 'Duration', sx: { width: 85, whiteSpace: 'nowrap' } },
                { col: null, label: 'Resolution', sx: { width: 80, whiteSpace: 'nowrap' } },
                { col: null, label: 'Transcodes', sx: { width: 160, whiteSpace: 'nowrap' } },
                { col: null, label: 'Cropped', sx: { width: 80, whiteSpace: 'nowrap' } },
                { col: null, label: 'Privacy', sx: { width: 75, whiteSpace: 'nowrap' } },
                { col: 'date', label: 'Date', sx: { width: 110, minWidth: 110, whiteSpace: 'nowrap' } },
              ].map(({ col, label, sx }) => (
                <TableCell
                  key={label}
                  onClick={col ? () => handleSort(col) : undefined}
                  sx={{
                    ...headCellSx,
                    ...sx,
                    ...(col && {
                      cursor: 'pointer',
                      userSelect: 'none',
                      '&:hover': { color: '#FFFFFFCC', bgcolor: '#FFFFFF10' },
                    }),
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {label}
                    {col && (
                      <Box
                        component="span"
                        sx={{
                          fontSize: 12,
                          lineHeight: 1,
                          opacity: sortColumn === col ? 1 : 0.25,
                          color: sortColumn === col ? '#3399FF' : 'inherit',
                        }}
                      >
                        {sortColumn === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                      </Box>
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredFiles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COL_SPAN} sx={{ ...bodyCellSx, textAlign: 'center', py: 4, color: '#FFFFFF55' }}>
                  No files found
                </TableCell>
              </TableRow>
            ) : (
              groupedFiles.map(([folder, groupItems], groupIdx) => {
                const isCollapsed = collapsedFolders.has(folder)
                const folderFileIds = groupItems.map((f) => f.video_id)
                const allFolderSelected = folderFileIds.length > 0 && folderFileIds.every((id) => selected.has(id))
                const someFolderSelected = folderFileIds.some((id) => selected.has(id)) && !allFolderSelected
                const toggleFolderSelect = () => {
                  setSelected((prev) => {
                    const next = new Set(prev)
                    if (allFolderSelected) {
                      folderFileIds.forEach((id) => next.delete(id))
                    } else {
                      folderFileIds.forEach((id) => next.add(id))
                    }
                    return next
                  })
                }
                return (
                  <React.Fragment key={folder || '__root__'}>
                    {/* Folder header row */}
                    <TableRow
                      sx={{ ...folderRowSx, cursor: 'pointer' }}
                      onClick={() => folderFileIds.length > 0 && toggleFolderCollapse(folder)}
                    >
                      <TableCell
                        padding="checkbox"
                        sx={{ borderBottom: '1px solid #FFFFFF14', bgcolor: 'transparent' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          if (folderFileIds.length > 0) toggleFolderSelect()
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={allFolderSelected}
                          indeterminate={someFolderSelected}
                          disabled={folderFileIds.length === 0}
                          sx={{
                            display: folderFileIds.length === 0 ? 'none' : 'inline-flex',
                            color: '#FFFFFF44',
                            '&.Mui-checked, &.MuiCheckbox-indeterminate': { color: '#3399FF' },
                          }}
                        />
                      </TableCell>
                      <TableCell
                        colSpan={COL_SPAN - 1}
                        sx={{
                          py: 0.75,
                          borderBottom: '1px solid #FFFFFF14',
                          bgcolor: 'transparent',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          {folderFileIds.length > 0 ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', width: 16 }}>
                              {isCollapsed ? (
                                <KeyboardArrowRightIcon sx={{ fontSize: 16, color: '#FFFFFF44' }} />
                              ) : (
                                <KeyboardArrowDownIcon sx={{ fontSize: 16, color: '#FFFFFF44' }} />
                              )}
                            </Box>
                          ) : (
                            <Box sx={{ width: 16 }} />
                          )}
                          <FolderIcon sx={{ fontSize: 14, color: '#FFFFFF55' }} />
                          <Typography
                            sx={{ fontSize: 12, fontWeight: 700, color: '#FFFFFF77', letterSpacing: '0.04em' }}
                          >
                            {folder || '(root)'}
                          </Typography>
                          <Typography sx={{ fontSize: 11, color: '#FFFFFF33', ml: 0.25 }}>
                            ({groupItems.length})
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>

                    {/* File rows */}
                    {!isCollapsed &&
                      groupItems.map((file, idx) => {
                        const isSelected = selected.has(file.video_id)
                        const displayName = file.title || file.filename
                        const hasTranscodes = file.has_480p || file.has_720p || file.has_1080p
                        return (
                          <TableRow
                            key={file.video_id}
                            hover
                            selected={isSelected}
                            sx={{
                              cursor: 'default',
                              bgcolor: isSelected ? '#3399FF14' : idx % 2 === 0 ? 'transparent' : '#FFFFFF03',
                              '&:hover': { bgcolor: isSelected ? '#3399FF1E' : '#FFFFFF08' },
                              '&.Mui-selected': { bgcolor: '#3399FF14' },
                              '&.Mui-selected:hover': { bgcolor: '#3399FF1E' },
                            }}
                          >
                            {/* Checkbox */}
                            <TableCell padding="checkbox" sx={{ borderBottom: '1px solid #FFFFFF0D' }}>
                              <Checkbox
                                size="small"
                                checked={isSelected}
                                onChange={() => toggleSelect(file.video_id)}
                                sx={{ color: '#FFFFFF44', '&.Mui-checked': { color: '#3399FF' } }}
                              />
                            </TableCell>

                            {/* Name */}
                            <TableCell sx={{ ...bodyCellSx, maxWidth: 300, overflow: 'hidden' }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}>
                                <Tooltip title={displayName} placement="top" enterDelay={600}>
                                  <Typography
                                    sx={{
                                      fontSize: 13,
                                      color: '#FFFFFFCC',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      flex: 1,
                                    }}
                                  >
                                    {displayName}
                                  </Typography>
                                </Tooltip>
                                <Tooltip title="Open in new tab">
                                  <IconButton
                                    size="small"
                                    onClick={() => window.open(`/#/w/${file.video_id}`, '_blank')}
                                    sx={{
                                      color: '#FFFFFF33',
                                      p: 0.25,
                                      flexShrink: 0,
                                      '&:hover': { color: '#FFFFFF99' },
                                    }}
                                  >
                                    <OpenInNewIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>

                            {/* Size */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              <Tooltip
                                arrow
                                placement="top"
                                title={
                                  file.derived_size > 0 ? (
                                    <Box>
                                      <Typography sx={{ fontSize: 12 }}>
                                        Derived: {formatSize(file.derived_size)}
                                      </Typography>
                                      <Typography sx={{ fontSize: 12 }}>
                                        Total: {formatSize((file.size || 0) + (file.derived_size || 0))}
                                      </Typography>
                                    </Box>
                                  ) : (
                                    ''
                                  )
                                }
                              >
                                <Typography sx={{ fontSize: 12, color: '#FFFFFF77' }}>
                                  {formatSize(file.size)}
                                </Typography>
                              </Tooltip>
                            </TableCell>

                            {/* Duration */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              <Typography sx={{ fontSize: 12, color: '#FFFFFF77' }}>
                                {formatDuration(file.duration)}
                              </Typography>
                            </TableCell>

                            {/* Resolution */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Chip
                                  label={formatResolution(file.width, file.height)}
                                  size="small"
                                  sx={{
                                    height: 17,
                                    fontSize: 10,
                                    bgcolor: '#FFFFFF12',
                                    color: '#FFFFFF66',
                                    '& .MuiChip-label': { px: 0.75 },
                                  }}
                                />
                              </Box>
                            </TableCell>

                            {/* Transcodes */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              {hasTranscodes ? (
                                <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap' }}>
                                  {file.has_1080p && (
                                    <Chip
                                      label="1080p"
                                      size="small"
                                      sx={{
                                        height: 17,
                                        fontSize: 10,
                                        bgcolor: '#FFFFFF12',
                                        color: '#FFFFFF66',
                                        '& .MuiChip-label': { px: 0.75 },
                                      }}
                                    />
                                  )}
                                  {file.has_720p && (
                                    <Chip
                                      label="720p"
                                      size="small"
                                      sx={{
                                        height: 17,
                                        fontSize: 10,
                                        bgcolor: '#FFFFFF12',
                                        color: '#FFFFFF66',
                                        '& .MuiChip-label': { px: 0.75 },
                                      }}
                                    />
                                  )}
                                  {file.has_480p && (
                                    <Chip
                                      label="480p"
                                      size="small"
                                      sx={{
                                        height: 17,
                                        fontSize: 10,
                                        bgcolor: '#FFFFFF12',
                                        color: '#FFFFFF66',
                                        '& .MuiChip-label': { px: 0.75 },
                                      }}
                                    />
                                  )}
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: 11, color: '#FFFFFF33' }}>—</Typography>
                              )}
                            </TableCell>

                            {/* Cropped */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              {file.has_crop ? (
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                  <Chip
                                    label="Cropped"
                                    size="small"
                                    sx={{
                                      height: 17,
                                      fontSize: 10,
                                      bgcolor: '#FF990018',
                                      color: '#FF9900BB',
                                      border: '1px solid #FF990033',
                                      '& .MuiChip-label': { px: 0.75 },
                                    }}
                                  />
                                </Box>
                              ) : (
                                <Typography sx={{ fontSize: 11, color: '#FFFFFF33' }}>—</Typography>
                              )}
                            </TableCell>

                            {/* Privacy */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <Chip
                                  label={file.private ? 'Private' : 'Public'}
                                  size="small"
                                  sx={{
                                    height: 17,
                                    fontSize: 10,
                                    bgcolor: file.private ? '#FFFFFF12' : '#1DB95418',
                                    color: file.private ? '#FFFFFF66' : '#1DB954',
                                    border: '1px solid',
                                    borderColor: file.private ? '#FFFFFF22' : '#1DB95433',
                                    '& .MuiChip-label': { px: 0.75 },
                                  }}
                                />
                              </Box>
                            </TableCell>

                            {/* Date */}
                            <TableCell sx={{ ...bodyCellSx }}>
                              <Tooltip
                                title={file.recorded_at ? `Recorded: ${formatDate(file.recorded_at)}` : ''}
                                placement="top"
                              >
                                <Typography sx={{ fontSize: 12, color: '#FFFFFF55' }}>
                                  {formatDate(file.created_at)}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* ── Move modal (matches MoveVideoModal style) ── */}
      <Modal open={moveModalOpen} onClose={() => !actionLoading && setMoveModalOpen(false)}>
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 420,
            p: 4,
            ...dialogPaperSx,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, color: 'white', mb: 2.5 }}>
            Move {selectedCount} file{selectedCount !== 1 ? 's' : ''}...
          </Typography>

          {uniqueCurrentFolders.size === 1 && (
            <Box sx={{ mb: 2 }}>
              <Typography sx={labelSx}>Current location</Typography>
              <Box
                sx={{
                  bgcolor: '#FFFFFF0D',
                  border: '1px solid #FFFFFF26',
                  borderRadius: '8px',
                  px: 1.5,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 14,
                  fontFamily: 'Inter, sans-serif',
                  color: '#FFFFFFCC',
                }}
              >
                {`/videos/${[...uniqueCurrentFolders][0]}/`}
              </Box>
            </Box>
          )}

          <Box sx={{ mb: 3.5 }}>
            <Typography sx={labelSx}>Move to folder</Typography>
            <Select
              options={moveFolderOptions}
              value={moveTargetFolder}
              onChange={setMoveTargetFolder}
              placeholder="Select a folder…"
              styles={selectFolderTheme}
              isDisabled={actionLoading}
              noOptionsMessage={() => 'No other folders available'}
            />
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              fullWidth
              variant="outlined"
              onClick={() => setMoveModalOpen(false)}
              disabled={actionLoading}
              sx={{
                color: 'white',
                borderColor: '#FFFFFF44',
                '&:hover': { borderColor: 'white', bgcolor: '#FFFFFF12' },
              }}
            >
              Cancel
            </Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <FolderIcon />}
              onClick={handleMove}
              disabled={actionLoading || !moveTargetFolder}
              sx={{
                bgcolor: '#3399FF',
                '&:hover': { bgcolor: '#1976D2' },
                '&.Mui-disabled': { bgcolor: '#3399FF44', color: '#FFFFFF44' },
              }}
            >
              {actionLoading ? 'Moving…' : 'Move'}
            </Button>
          </Stack>
        </Box>
      </Modal>

      {/* ── Delete dialog ── */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !actionLoading && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { ...dialogPaperSx, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'white' }}>
          Delete {selectedCount} file{selectedCount !== 1 ? 's' : ''}?
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#FFFFFFAA' }}>
            This will permanently delete {selectedCount} file{selectedCount !== 1 ? 's' : ''} and all related data. This
            cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setDeleteDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#FFFFFF88', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDelete}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <DeleteIcon />}
            sx={{ textTransform: 'none' }}
          >
            {actionLoading ? 'Deleting…' : `Delete ${selectedCount} file${selectedCount !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove Transcodes dialog ── */}
      <Dialog
        open={removeTranscodesDialogOpen}
        onClose={() => !actionLoading && setRemoveTranscodesDialogOpen(false)}
        PaperProps={{ sx: { ...dialogPaperSx, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'white' }}>Remove Transcodes?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#FFFFFFAA' }}>
            This will delete the 480p, 720p, and 1080p transcoded files for {selectedCount} selected file
            {selectedCount !== 1 ? 's' : ''}.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setRemoveTranscodesDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#FFFFFF88', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRemoveTranscodes}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <VideoSettingsIcon />}
            sx={{ textTransform: 'none' }}
          >
            {actionLoading ? 'Removing…' : 'Remove Transcodes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Remove Crop dialog ── */}
      <Dialog
        open={removeCropDialogOpen}
        onClose={() => !actionLoading && setRemoveCropDialogOpen(false)}
        PaperProps={{ sx: { ...dialogPaperSx, minWidth: 380 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'white' }}>Remove Crop?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#FFFFFFAA' }}>
            This will clear the crop settings and remove associated transcoded files for {selectedCount} selected file
            {selectedCount !== 1 ? 's' : ''}. This cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setRemoveCropDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#FFFFFF88', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRemoveCrop}
            disabled={actionLoading}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <ContentCutIcon />}
            sx={{ textTransform: 'none' }}
          >
            {actionLoading ? 'Removing…' : 'Remove Crop'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Create Folder dialog ── */}
      <Dialog
        open={createFolderDialogOpen}
        onClose={() => !actionLoading && setCreateFolderDialogOpen(false)}
        PaperProps={{ sx: { ...dialogPaperSx, minWidth: 360 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: 'white' }}>Create New Folder</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#FFFFFFAA', mb: 2 }}>
            Enter a name for the new folder. It will be created in the root of your videos directory.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newFolderName.trim() && !actionLoading) handleCreateFolder()
            }}
            InputLabelProps={{ sx: { color: '#FFFFFF66' } }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': { borderColor: '#FFFFFF22' },
                '&:hover fieldset': { borderColor: '#FFFFFF44' },
                '&.Mui-focused fieldset': { borderColor: '#FFFFFF66' },
              },
              '& input': { color: '#FFFFFFCC' },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button
            onClick={() => setCreateFolderDialogOpen(false)}
            disabled={actionLoading}
            sx={{ color: '#FFFFFF88', textTransform: 'none' }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateFolder}
            disabled={actionLoading || !newFolderName.trim()}
            startIcon={actionLoading ? <CircularProgress size={14} color="inherit" /> : <CreateNewFolderIcon />}
            sx={{ textTransform: 'none', '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.12)', color: '#FFFFFF44' } }}
          >
            {actionLoading ? 'Creating…' : 'Create Folder'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
