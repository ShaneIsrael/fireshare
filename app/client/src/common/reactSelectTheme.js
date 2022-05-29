const selectTheme = {
  control: (styles) => ({
    ...styles,
    backgroundColor: '#001E3C',
    borderColor: '#2684FF',
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
  }),
  menuList: (styles) => ({
    ...styles,
    backgroundColor: '#001E3C',
    padding: 0,
  }),
  singleValue: (styles) => ({
    ...styles,
    color: '#fff',
    '&:hover': {
      backgroundColor: '#3399FF',
    },
  }),
  option: (styles, { data, isDisabled, isFocused, isSelected }) => {
    return {
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
    }
  },
}
export default selectTheme
