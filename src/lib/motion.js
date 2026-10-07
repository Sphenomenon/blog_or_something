export const archiveEase = [0.2, 0.6, 0.2, 1]

export const durationFast = 0.16
export const durationNormal = 0.18
export const durationSlow = 0.45

export const navigationTransition = {
  type: "tween",
  duration: 0.22,
  ease: [0.32, 0, 0.24, 1],
}

export const reducedMotionTransition = {
  duration: 0,
  ease: 'linear',
}

export const archiveTransition = {
  duration: durationSlow,
  ease: archiveEase,
}

export const revealFrame = {
  hidden: {
    opacity: 0,
    y: 8,
    clipPath: 'inset(0 0 8% 0)',
  },
  visible: (shouldReduceMotion = false) => ({
    opacity: 1,
    y: 0,
    clipPath: 'inset(0 0 0 0)',
    transition: shouldReduceMotion ? reducedMotionTransition : archiveTransition,
  }),
}

export const staggerContainer = {
  hidden: {},
  visible: (shouldReduceMotion = false) => ({
    transition: shouldReduceMotion
      ? reducedMotionTransition
      : {
          staggerChildren: 0.06,
          delayChildren: durationFast,
        },
  }),
}

export const cardMotion = {
  rest: {
    y: 0,
    scale: 1,
  },
  hover: (shouldReduceMotion = false) => ({
    y: shouldReduceMotion ? 0 : -4,
    scale: shouldReduceMotion ? 1 : 1.01,
    transition: shouldReduceMotion
      ? reducedMotionTransition
      : {
          duration: durationNormal,
          ease: archiveEase,
        },
  }),
}
