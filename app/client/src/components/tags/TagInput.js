import React, { useState } from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'

/**
 * TagInput — inline chip-style tag editor.
 *
 * Props:
 *   tags     string[]   current list of tags
 *   onChange fn         called with the new string[] on every change
 */
const TagInput = ({ tags = [], onChange }) => {
  const [inputValue, setInputValue] = useState('')

  const addTag = (raw) => {
    const trimmed = raw.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed])
    }
    setInputValue('')
  }

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 0.75,
        bgcolor: '#FFFFFF0D',
        border: '1px solid #FFFFFF26',
        borderRadius: '8px',
        px: 1.5,
        py: 1,
        cursor: 'text',
        '&:focus-within': { borderColor: '#3399FF' },
      }}
      onClick={() => document.getElementById('tag-input-field')?.focus()}
    >
      {tags.map((tag) => (
        <Box
          key={tag}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.4,
            bgcolor: '#FFFFFF14',
            border: '1px solid #FFFFFF26',
            borderRadius: '20px',
            pl: 1.25,
            pr: 0.5,
            py: 0.25,
          }}
        >
          <Typography sx={{ fontSize: 13, color: 'white', lineHeight: 1 }}>{tag}</Typography>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); removeTag(tag) }}
            sx={{ color: '#FFFFFF66', p: 0.2, '&:hover': { color: 'white' } }}
          >
            <CloseIcon sx={{ fontSize: 13 }} />
          </IconButton>
        </Box>
      ))}

      <input
        id="tag-input-field"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => inputValue && addTag(inputValue)}
        placeholder={tags.length === 0 ? 'Add clip tags...' : ''}
        style={{
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'white',
          fontSize: 13,
          flex: 1,
          minWidth: 80,
          padding: '2px 4px',
        }}
      />

      {tags.length > 0 && (
        <IconButton
          size="small"
          onClick={(e) => { e.stopPropagation(); onChange([]) }}
          sx={{ color: '#FFFFFF66', p: 0.25, ml: 'auto', '&:hover': { color: 'white' }, flexShrink: 0 }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      )}
    </Box>
  )
}

export default TagInput
