import { useState, useEffect, useRef } from 'react'

export default function TextType({
    text = 'Hello, World!',
    typingSpeed = 80,
    showCursor = false,
    cursorCharacter = '|',
    initialDelay = 200,
}) {
    const [displayed, setDisplayed] = useState('')
    const [cursorVisible, setCursorVisible] = useState(true)
    const indexRef = useRef(0)

    useEffect(() => {
        const timeout = setTimeout(() => {
            const interval = setInterval(() => {
                if (indexRef.current < text.length) {
                    setDisplayed(text.slice(0, indexRef.current + 1))
                    indexRef.current++
                } else {
                    clearInterval(interval)
                }
            }, typingSpeed)
            return () => clearInterval(interval)
        }, initialDelay)
        return () => clearTimeout(timeout)
    }, [text, typingSpeed, initialDelay])

    useEffect(() => {
        if (!showCursor) return
        const blink = setInterval(() => setCursorVisible(v => !v), 500)
        return () => clearInterval(blink)
    }, [showCursor])

    return (
        <span>
            {displayed}
            {showCursor && (
                <span style={{
                    opacity: cursorVisible ? 1 : 0,
                    transition: 'opacity 100ms',
                    fontWeight: 200,
                    color: 'var(--color-text-muted)',
                    marginLeft: '2px',
                }}>{cursorCharacter}</span>
            )}
        </span>
    )
}
