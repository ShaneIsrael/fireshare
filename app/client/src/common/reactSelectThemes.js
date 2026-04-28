import zIndex from '@mui/material/styles/zIndex'

export const folderSelectTheme = {
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
  menuPortal: (styles) => ({
    ...styles,
    zIndex: 2000,
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
  valueContainer: (styles) => ({
    ...styles,
    paddingRight: 0,
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
    marginBottom: 2,
    '&:active': {
      backgroundColor: '#FFFFFF26',
    },
  }),
}

export const sortSelectTheme = {
  control: (styles) => ({
    ...styles,
    backgroundColor: '#001E3C',
    borderColor: '#2684FF',
    borderRadius: 10,
    '&:hover': {
      borderColor: '#2684FF',
    },
    color: '#fff',
  }),
  menu: (styles) => ({
    ...styles,
    borderRadius: 0,
    marginTop: 0,
    backgroundColor: '#001E3C',
    '&:hover': {
      borderColor: '#2684FF',
    },
  }),
  menuPortal: (styles) => ({
    ...styles,
    zIndex: 2000,
  }),
  menuList: (styles) => ({
    ...styles,
    backgroundColor: '#001E3C',
    padding: 0,
  }),
  valueContainer: (styles) => ({
    ...styles,
    paddingRight: 0,
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#fff',
  }),
  option: (styles, { isFocused, isSelected }) => ({
    backgroundColor: '#003366',
    boxSizing: 'border-box',
    display: 'block',
    fontSize: 'inherit',
    label: 'option',
    padding: '8px 12px',
    userSelect: 'none',
    width: '100%',
    '&:hover': {
      backgroundColor: '#3399FF',
    },
  }),
}
