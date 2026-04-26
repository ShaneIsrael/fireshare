import React from 'react'
import { components } from 'react-select'

const KEYFRAMES = `
@keyframes marquee-scroll {
  0%,  15% { transform: translateX(0); }
  45%, 55% { transform: translateX(var(--marquee-offset)); }
  85%, 100% { transform: translateX(0); }
}
`

let styleInjected = false
function injectStyle() {
  if (styleInjected) return
  const el = document.createElement('style')
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
  styleInjected = true
}

const MarqueeSingleValue = (props) => {
  const containerRef = React.useRef()
  const textRef = React.useRef()
  const [offset, setOffset] = React.useState(0)

  React.useEffect(() => {
    injectStyle()
  }, [])

  React.useEffect(() => {
    const container = containerRef.current
    const text = textRef.current
    if (!container || !text) return

    const measure = () => {
      const diff = text.scrollWidth - container.clientWidth
      setOffset(diff > 0 ? -diff : 0)
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [props.children])

  return (
    <components.SingleValue {...props}>
      <div ref={containerRef} style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}>
        <span
          ref={textRef}
          style={
            offset !== 0
              ? {
                  display: 'inline-block',
                  animation: 'marquee-scroll 7s ease-in-out infinite',
                  '--marquee-offset': `${offset}px`,
                }
              : { display: 'inline-block' }
          }
        >
          {props.children}
        </span>
      </div>
    </components.SingleValue>
  )
}

export default MarqueeSingleValue
