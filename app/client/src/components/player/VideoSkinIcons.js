/**
 * SVG icon components matching @videojs/react's default icon set.
 * Extracted so we don't depend on internal/unexported package paths.
 *
 * All icons use viewBox="0 0 18 18", width/height=18, fill="none",
 * aria-hidden="true", and accept className + any extra props.
 */
import React from 'react'

const svgBase = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 18,
  height: 18,
  fill: 'none',
  'aria-hidden': true,
  viewBox: '0 0 18 18',
}

export const SpinnerIcon = (props) => (
  <svg {...svgBase} fill="currentColor" {...props}>
    <rect width="2" height="5" x="8" y=".5" opacity=".5" rx="1">
      <animate attributeName="opacity" begin="0s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0" />
    </rect>
    <rect width="2" height="5" x="12.243" y="2.257" opacity=".45" rx="1" transform="rotate(45 13.243 4.757)">
      <animate
        attributeName="opacity"
        begin="0.125s"
        calcMode="linear"
        dur="1s"
        repeatCount="indefinite"
        values="1;0"
      />
    </rect>
    <rect width="5" height="2" x="12.5" y="8" opacity=".4" rx="1">
      <animate attributeName="opacity" begin="0.25s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0" />
    </rect>
    <rect width="5" height="2" x="10.743" y="12.243" opacity=".35" rx="1" transform="rotate(45 13.243 13.243)">
      <animate
        attributeName="opacity"
        begin="0.375s"
        calcMode="linear"
        dur="1s"
        repeatCount="indefinite"
        values="1;0"
      />
    </rect>
    <rect width="2" height="5" x="8" y="12.5" opacity=".3" rx="1">
      <animate attributeName="opacity" begin="0.5s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0" />
    </rect>
    <rect width="2" height="5" x="3.757" y="10.743" opacity=".25" rx="1" transform="rotate(45 4.757 13.243)">
      <animate
        attributeName="opacity"
        begin="0.625s"
        calcMode="linear"
        dur="1s"
        repeatCount="indefinite"
        values="1;0"
      />
    </rect>
    <rect width="5" height="2" x=".5" y="8" opacity=".15" rx="1">
      <animate attributeName="opacity" begin="0.75s" calcMode="linear" dur="1s" repeatCount="indefinite" values="1;0" />
    </rect>
    <rect width="5" height="2" x="2.257" y="3.757" opacity=".1" rx="1" transform="rotate(45 4.757 4.757)">
      <animate
        attributeName="opacity"
        begin="0.875s"
        calcMode="linear"
        dur="1s"
        repeatCount="indefinite"
        values="1;0"
      />
    </rect>
  </svg>
)

export const PlayIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="m14.051 10.723-7.985 4.964a1.98 1.98 0 0 1-2.758-.638A2.06 2.06 0 0 1 3 13.964V4.036C3 2.91 3.895 2 5 2c.377 0 .747.109 1.066.313l7.985 4.964a2.057 2.057 0 0 1 .627 2.808c-.16.257-.373.475-.627.637"
    />
  </svg>
)

export const PauseIcon = (props) => (
  <svg {...svgBase} {...props}>
    <rect width="5" height="14" x="2" y="2" fill="currentColor" rx="1.75" />
    <rect width="5" height="14" x="11" y="2" fill="currentColor" rx="1.75" />
  </svg>
)

export const RestartIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M9 17a8 8 0 0 1-8-8h2a6 6 0 1 0 1.287-3.713l1.286 1.286A.25.25 0 0 1 5.396 7H1.25A.25.25 0 0 1 1 6.75V2.604a.25.25 0 0 1 .427-.177l1.438 1.438A8 8 0 1 1 9 17"
    />
    <path
      fill="currentColor"
      d="m11.61 9.639-3.331 2.07a.826.826 0 0 1-1.15-.266.86.86 0 0 1-.129-.452V6.849C7 6.38 7.374 6 7.834 6c.158 0 .312.045.445.13l3.331 2.071a.858.858 0 0 1 0 1.438"
    />
  </svg>
)

export const SeekIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M1 9c0 2.21.895 4.21 2.343 5.657l1.414-1.414a6 6 0 1 1 8.956-7.956l-1.286 1.286a.25.25 0 0 0 .177.427h4.146a.25.25 0 0 0 .25-.25V2.604a.25.25 0 0 0-.427-.177l-1.438 1.438A8 8 0 0 0 1 9"
    />
  </svg>
)

export const CaptionsOffIcon = (props) => (
  <svg {...svgBase} {...props}>
    <rect width="16" height="12" x="1" y="3" stroke="currentColor" strokeWidth="2" rx="3" />
    <rect width="3" height="2" x="3" y="8" fill="currentColor" rx="1" />
    <rect width="2" height="2" x="13" y="8" fill="currentColor" rx="1" />
    <rect width="4" height="2" x="11" y="11" fill="currentColor" rx="1" />
    <rect width="5" height="2" x="7" y="8" fill="currentColor" rx="1" />
    <rect width="7" height="2" x="3" y="11" fill="currentColor" rx="1" />
  </svg>
)

export const CaptionsOnIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M15 2a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3zM4 11a1 1 0 1 0 0 2h5a1 1 0 1 0 0-2zm8 0a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2zM4 8a1 1 0 0 0 0 2h1a1 1 0 0 0 0-2zm4 0a1 1 0 0 0 0 2h3a1 1 0 1 0 0-2zm6 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2"
    />
  </svg>
)

export const FullscreenEnterIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M9.57 3.617A1 1 0 0 0 8.646 3H4c-.552 0-1 .449-1 1v4.646a.996.996 0 0 0 1.001 1 1 1 0 0 0 .706-.293l4.647-4.647a1 1 0 0 0 .216-1.089m4.812 4.812a1 1 0 0 0-1.089.217l-4.647 4.647a.998.998 0 0 0 .708 1.706H14c.552 0 1-.449 1-1V9.353a1 1 0 0 0-.618-.924"
    />
  </svg>
)

export const FullscreenExitIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M7.883 1.93a.99.99 0 0 0-1.09.217L2.146 6.793A.998.998 0 0 0 2.853 8.5H7.5c.551 0 1-.449 1-1V2.854a1 1 0 0 0-.617-.924m7.263 7.57H10.5c-.551 0-1 .449-1 1v4.646a.996.996 0 0 0 1.001 1.001 1 1 0 0 0 .706-.293l4.646-4.646a.998.998 0 0 0-.707-1.707z"
    />
  </svg>
)

export const PipIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M13 2a4 4 0 0 1 4 4v2.035A3.5 3.5 0 0 0 16.5 8H15V6.273C15 5.018 13.96 4 12.679 4H4.32C3.04 4 2 5.018 2 6.273v5.454C2 12.982 3.04 14 4.321 14H6v1.5q0 .255.035.5H4a4 4 0 0 1-4-4V6a4 4 0 0 1 4-4z"
    />
    <rect width="10" height="7" x="8" y="10" fill="currentColor" rx="2" />
  </svg>
)

export const VolumeOffIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752M14.5 7.586l-1.768-1.768a1 1 0 1 0-1.414 1.414L13.085 9l-1.767 1.768a1 1 0 0 0 1.414 1.414l1.768-1.768 1.768 1.768a1 1 0 0 0 1.414-1.414L15.914 9l1.768-1.768a1 1 0 0 0-1.414-1.414z"
    />
  </svg>
)

export const VolumeLowIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752m10.568.59a.91.91 0 0 1 0-1.316.91.91 0 0 1 1.316 0c1.203 1.203 1.47 2.216 1.522 3.208q.012.255.011.51c0 1.16-.358 2.733-1.533 3.803a.7.7 0 0 1-.298.156c-.382.106-.873-.011-1.018-.156a.91.91 0 0 1 0-1.316c.57-.57.995-1.551.995-2.487 0-.944-.26-1.667-.995-2.402"
    />
  </svg>
)

export const VolumeHighIcon = (props) => (
  <svg {...svgBase} {...props}>
    <path
      fill="currentColor"
      d="M15.6 3.3c-.4-.4-1-.4-1.4 0s-.4 1 0 1.4C15.4 5.9 16 7.4 16 9s-.6 3.1-1.8 4.3c-.4.4-.4 1 0 1.4.2.2.5.3.7.3.3 0 .5-.1.7-.3C17.1 13.2 18 11.2 18 9s-.9-4.2-2.4-5.7"
    />
    <path
      fill="currentColor"
      d="M.714 6.008h3.072l4.071-3.857c.5-.376 1.143 0 1.143.601V15.28c0 .602-.643.903-1.143.602l-4.071-3.858H.714c-.428 0-.714-.3-.714-.752V6.76c0-.451.286-.752.714-.752m10.568.59a.91.91 0 0 1 0-1.316.91.91 0 0 1 1.316 0c1.203 1.203 1.47 2.216 1.522 3.208q.012.255.011.51c0 1.16-.358 2.733-1.533 3.803a.7.7 0 0 1-.298.156c-.382.106-.873-.011-1.018-.156a.91.91 0 0 1 0-1.316c.57-.57.995-1.551.995-2.487 0-.944-.26-1.667-.995-2.402"
    />
  </svg>
)
