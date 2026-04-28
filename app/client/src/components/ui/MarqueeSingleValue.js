import React from 'react'
import { components } from 'react-select'

const KEYFRAMES = `
@keyframes marquee-scroll {
  0%,  10% { transform: translateX(0); }
  40%, 60% { transform: translateX(var(--marquee-offset)); }
  90%, 100% { transform: translateX(0); }
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

const MarqueeText = ({ children }) => {
  const containerRef = React.useRef()
  const textRef = React.useRef()
  const [offset, setOffset] = React.useState(0)
  const [hovered, setHovered] = React.useState(false)

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
  }, [children])

  const animating = hovered && offset !== 0

  return (
    <div
      ref={containerRef}
      style={{ overflow: 'hidden', whiteSpace: 'nowrap', width: '100%' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={textRef}
        style={{
          display: 'inline-block',
          animation: animating ? 'marquee-scroll 4s ease-in-out infinite' : 'none',
          '--marquee-offset': `${offset}px`,
        }}
      >
        {children}
      </span>
    </div>
  )
}

export const MarqueeSingleValue = (props) => (
  <components.SingleValue {...props}>
    <MarqueeText>{props.children}</MarqueeText>
  </components.SingleValue>
)

export const MarqueeOption = (props) => (
  <components.Option {...props}>
    <MarqueeText>{props.children}</MarqueeText>
  </components.Option>
)

export default MarqueeSingleValue
