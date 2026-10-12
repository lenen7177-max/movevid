import React, { useState, useEffect, createContext, useContext } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";

interface CustomDrawerContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CustomDrawerContext = createContext<CustomDrawerContextType | undefined>(undefined);

export const useCustomDrawer = () => {
  const context = useContext(CustomDrawerContext);
  if (!context) {
    throw new Error("CustomDrawer components must be used within a CustomDrawer");
  }
  return context;
};

export const useOptionalCustomDrawer = () => useContext(CustomDrawerContext);

interface CustomDrawerProps {
  children: React.ReactNode;
}

export function CustomDrawer({ children }: CustomDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <CustomDrawerContext.Provider value={{ isOpen, setIsOpen }}>
      {children}
    </CustomDrawerContext.Provider>
  );
}

interface CustomDrawerTriggerProps {
  children: React.ReactNode;
  className?: string;
}

export function CustomDrawerTrigger({ children, className }: CustomDrawerTriggerProps) {
  const { setIsOpen } = useCustomDrawer();

  return (
    <button onClick={() => setIsOpen(true)} className={cn(className)}>
      {children}
    </button>
  );
}

interface CustomDrawerContentProps {
  children: React.ReactNode;
  className?: string;
}

export function CustomDrawerContent({ children, className }: CustomDrawerContentProps) {
  const { isOpen, setIsOpen } = useCustomDrawer();

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setIsOpen(false)}
          />

          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{
              duration: 0.25,
              ease: [0.16, 1, 0.3, 1],
            }}
            className={cn(
              "fixed bottom-3 left-0 right-0 bg-background border-t border-border rounded-lg z-50 max-h-[70vh] overflow-hidden w-[95%] mx-auto flex flex-col",
              className,
            )}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface CustomDrawerHeaderProps {
  children: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
}

export function CustomDrawerHeader({
  children,
  className,
  showCloseButton = true,
}: CustomDrawerHeaderProps) {
  const { setIsOpen } = useCustomDrawer();

  return (
    <div className={cn("flex items-center justify-between p-4 border-b border-border", className)}>
      <div className="flex-1">{children}</div>
      {showCloseButton && (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors ml-4"
        >
          <X size={20} />
        </motion.button>
      )}
    </div>
  );
}

interface CustomDrawerBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function CustomDrawerBody({ children, className }: CustomDrawerBodyProps) {
  return <div className={cn("p-4 overflow-y-auto flex-1", className)}>{children}</div>;
}

interface CustomDrawerFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function CustomDrawerFooter({ children, className }: CustomDrawerFooterProps) {
  return <div className={cn("border-t border-border", className)}>{children}</div>;
}
