import React from 'react'

const Hourglass = ({ size = 32, fill = '#2684FF', bg = 'transparent' }) => {
  const wrapperStyle = {
    width: size,
    height: size * 1.5,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const svgStyle = {
    width: '100%',
    height: '100%',
    animation: 'hourglass-spin 1s linear infinite',
  }

  return (
    <>
      <style>
        {`
          @keyframes hourglass-spin {
            0% {
              transform: rotate(0deg);
            }
            80% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(180deg);
            }
          }
        `}
      </style>

      <div style={wrapperStyle}>
        <svg
          style={svgStyle}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 120 206"
          preserveAspectRatio="none"
        >
          <path
            d="M120 0H0v206h120V0zM77.1 133.2C87.5 140.9 92 145 92 152.6V178H28v-25.4c0-7.6 4.5-11.7 14.9-19.4 6-4.5 13-9.6 17.1-17 4.1 7.4 11.1 12.6 17.1 17zM60 89.7c-4.1-7.3-11.1-12.5-17.1-17C32.5 65.1 28 61 28 53.4V28h64v25.4c0 7.6-4.5 11.7-14.9 19.4-6 4.4-13 9.6-17.1 16.9z"
            fill={bg}
          />
          <path
            d="M93.7 95.3c10.5-7.7 26.3-19.4 26.3-41.9V0H0v53.4c0 22.5 15.8 34.2 26.3 41.9 3 2.2 7.9 5.8 9 7.7-1.1 1.9-6 5.5-9 7.7C15.8 118.4 0 130.1 0 152.6V206h120v-53.4c0-22.5-15.8-34.2-26.3-41.9-3-2.2-7.9-5.8-9-7.7 1.1-2 6-5.5 9-7.7zM70.6 103c0 18 35.4 21.8 35.4 49.6V192H14v-39.4c0-27.9 35.4-31.6 35.4-49.6S14 81.2 14 53.4V14h92v39.4C106 81.2 70.6 85 70.6 103z"
            fill={fill}
          />
        </svg>
      </div>
    </>
  )
}

export default Hourglass
