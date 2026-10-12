import type { ReactNode, JSX } from "react";
import { motion, useInView, type Variants } from "motion/react";
import React from "react";

export type PresetType =
  | "fade"
  | "slide"
  | "scale"
  | "blur"
  | "blur-slide"
  | "zoom"
  | "flip"
  | "bounce"
  | "rotate"
  | "swing";

export type AnimatedGroupProps = {
  children: ReactNode;
  className?: string;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  preset?: PresetType;
  as?: React.ElementType;
  asChild?: React.ElementType;
  animateOnView?: boolean;
};

const defaultContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

const presetVariants: Record<PresetType, Variants> = {
  fade: {},
  slide: {
    hidden: { y: 20 },
    visible: { y: 0 },
  },
  scale: {
    hidden: { scale: 0.8 },
    visible: { scale: 1 },
  },
  blur: {
    hidden: { filter: "blur(4px)" },
    visible: { filter: "blur(0px)" },
  },
  "blur-slide": {
    hidden: { filter: "blur(4px)", y: 20 },
    visible: { filter: "blur(0px)", y: 0 },
  },
  zoom: {
    hidden: { scale: 0.5 },
    visible: {
      scale: 1,
      transition: { type: "tween", ease: "easeOut", duration: 0.6 },
    },
  },
  flip: {
    hidden: { rotateX: -90 },
    visible: {
      rotateX: 0,
      transition: { type: "tween", ease: "easeOut", duration: 0.6 },
    },
  },
  bounce: {
    hidden: { y: -50 },
    visible: {
      y: 0,
      transition: { type: "tween", ease: "easeOut", duration: 0.5 },
    },
  },
  rotate: {
    hidden: { rotate: -180 },
    visible: {
      rotate: 0,
      transition: { type: "tween", ease: "easeOut", duration: 0.6 },
    },
  },
  swing: {
    hidden: { rotate: -10 },
    visible: {
      rotate: 0,
      transition: { type: "tween", ease: "easeOut", duration: 0.5 },
    },
  },
};

const addDefaultVariants = (variants: Variants) => ({
  hidden: { ...defaultItemVariants.hidden, ...variants.hidden },
  visible: { ...defaultItemVariants.visible, ...variants.visible },
});

function AnimatedGroup({
  children,
  className,
  variants,
  preset,
  as = "div",
  asChild = "div",
  animateOnView = true,
}: AnimatedGroupProps) {
  const localRef = React.useRef<HTMLElement | null>(null);
  const isInView = useInView(localRef, {
    once: true,
    amount: 0.3,
  });
  const shouldAnimate = animateOnView ? isInView : true;

  const selectedItemVariants = React.useMemo(
    () => addDefaultVariants(preset ? presetVariants[preset] : {}),
    [preset],
  );
  const containerVariants = variants?.container || defaultContainerVariants;
  const itemVariants = variants?.item || selectedItemVariants;

  const MotionComponent = React.useMemo(
    () => motion.create(as as keyof JSX.IntrinsicElements),
    [as],
  ) as React.ComponentType<any>;
  const MotionChild = React.useMemo(
    () => motion.create(asChild as keyof JSX.IntrinsicElements),
    [asChild],
  ) as React.ComponentType<any>;

  return (
    <MotionComponent
      ref={localRef}
      initial={animateOnView ? "hidden" : false}
      animate={shouldAnimate ? "visible" : "hidden"}
      variants={containerVariants}
      className={className}
    >
      {React.Children.map(children, (child, index) => (
        <MotionChild
          key={React.isValidElement(child) && child.key != null ? child.key : index}
          variants={itemVariants}
        >
          {child}
        </MotionChild>
      ))}
    </MotionComponent>
  );
}

export { AnimatedGroup };
