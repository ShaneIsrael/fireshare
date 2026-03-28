// Shared dark-theme style constants for dialogs and modals

export const labelSx = {
  fontSize: 12,
  color: '#FFFFFFB3',
  mb: 1,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

export const inputSx = {
  '& .MuiOutlinedInput-root': {
    color: 'white',
    bgcolor: '#FFFFFF0D',
    borderRadius: '8px',
    '& fieldset': { borderColor: '#FFFFFF26' },
    '&:hover fieldset': { borderColor: '#FFFFFF55' },
    '&.Mui-focused fieldset': { borderColor: '#3399FF' },
  },
}

export const rowBoxSx = {
  display: 'flex',
  alignItems: 'center',
  gap: 1.5,
  bgcolor: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: '8px',
  px: 1.5,
  py: 1,
}

export const dialogPaperSx = {
  bgcolor: '#041223',
  border: '1px solid #FFFFFF1A',
  borderRadius: '12px',
  boxShadow: '0 16px 48px #00000099',
}

export const dialogTitleSx = {
  fontWeight: 800,
  color: 'white',
}

export const checkboxSx = {
  color: '#FFFFFF33',
  '&.Mui-checked': { color: '#3399FF' },
  p: 0.5,
}

export const helperTextSx = {
  fontSize: 14,
  color: '#FFFFFFB3',
}

export const timeInputStyle = {
  background: '#FFFFFF0D',
  border: '1px solid #FFFFFF26',
  borderRadius: 6,
  color: 'white',
  fontSize: 13,
  padding: '4px 8px',
  colorScheme: 'dark',
  flex: 1,
}
