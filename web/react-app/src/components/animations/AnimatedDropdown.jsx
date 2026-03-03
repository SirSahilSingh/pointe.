import { motion, AnimatePresence } from 'framer-motion'

const dropdownVariants = {
    initial: {
        opacity: 0,
        scale: 0.95,
        y: -4,
    },
    animate: {
        opacity: 1,
        scale: 1,
        y: 0,
    },
    exit: {
        opacity: 0,
        scale: 0.95,
        y: -4,
    },
}

/**
 * AnimatedDropdown — smooth scale+fade+translate dropdown wrapper
 * 
 * Usage:
 *   <AnimatedDropdown open={isOpen} origin="top right">
 *     <DropdownContent />
 *   </AnimatedDropdown>
 */
export default function AnimatedDropdown({
    open,
    children,
    origin = 'top right',
    className = '',
    style = {},
}) {
    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    variants={dropdownVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{
                        duration: 0.15,
                        ease: [0.4, 0, 0.2, 1],
                    }}
                    style={{
                        transformOrigin: origin,
                        position: 'absolute',
                        zIndex: 50,
                        ...style,
                    }}
                    className={className}
                >
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    )
}
