/**
 * Premium animation presets for Framer Motion
 * Used across the application for consistent micro-interactions
 */

// Spring physics presets
export const transitions = {
  spring: { type: "spring", stiffness: 400, damping: 30 } as const,
  springStiff: { type: "spring", stiffness: 500, damping: 35 } as const,
  springGentle: { type: "spring", stiffness: 300, damping: 25 } as const,
  smooth: { type: "tween", duration: 0.2, ease: [0.16, 1, 0.3, 1] } as const,
  smoothSlow: { type: "tween", duration: 0.3, ease: [0.16, 1, 0.3, 1] } as const,
} as const;

// Fade in from bottom animation
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 10 },
  transition: transitions.smooth,
};

// Scale in animation
export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: transitions.smooth,
};

// Button/small element hover lift
export const hoverLift = {
  whileHover: { y: -2, transition: transitions.spring },
  whileTap: { y: 0, scale: 0.98, transition: transitions.springStiff },
};

// Card hover animation - more pronounced
export const cardHover = {
  whileHover: { y: -8, scale: 1.01, transition: transitions.spring },
  whileTap: { y: 0, scale: 0.99, transition: transitions.springStiff },
};

// Subtle card hover - for smaller cards
export const cardHoverSubtle = {
  whileHover: { y: -4, transition: transitions.spring },
  whileTap: { y: 0, scale: 0.99, transition: transitions.springStiff },
};

// Interactive element hover
export const interactiveHover = {
  whileHover: { scale: 1.02, transition: transitions.spring },
  whileTap: { scale: 0.98, transition: transitions.springStiff },
};

// Staggered children animation
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

// Page transition
export const pageTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
};
