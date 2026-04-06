import zIndex from '@mui/material/styles/zIndex'

const selectTheme = {
  control: (styles) => ({
    ...styles,
    backgroundColor: '#FFFFFF0D',
    borderColor: '#FFFFFF26',
    borderRadius: '8px',
    boxShadow: 'none',
    '&:hover': {
      borderColor: '#FFFFFF55',
    },
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
  }),
  menu: (styles) => ({
    ...styles,
    borderRadius: '8px',
    marginTop: 4,
    backgroundColor: '#0b132b',
    border: '1px solid #FFFFFF1A',
    boxShadow: '0 8px 24px #00000066',
    zIndex: zIndex.modal + 1,
  }),
  menuList: (styles) => ({
    ...styles,
    backgroundColor: 'transparent',
    padding: 4,
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#fff',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
  }),
  placeholder: (styles) => ({
    ...styles,
    color: '#FFFFFF66',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
  }),
  dropdownIndicator: (styles) => ({
    ...styles,
    color: '#FFFFFF66',
    '&:hover': { color: '#fff' },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  option: (styles, { isFocused, isSelected }) => ({
    ...styles,
    backgroundColor: isSelected ? '#3399FF26' : isFocused ? '#FFFFFF1A' : 'transparent',
    borderRadius: '6px',
    color: isSelected ? '#fff' : '#FFFFFFCC',
    fontSize: 14,
    fontFamily: 'Inter, sans-serif',
    padding: '8px 10px',
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    '&:active': {
      backgroundColor: '#FFFFFF26',
    },
  }),
}
export default selectTheme
