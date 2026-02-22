import { motion } from 'framer-motion'

export default function GlassCard({ children, className = '', hover = true, padding = true, ...props }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            className={`glass ${hover ? 'glass-interactive' : ''} ${padding ? 'p-5' : ''} ${className}`}
            {...props}
        >
            {children}
        </motion.div>
    )
}
