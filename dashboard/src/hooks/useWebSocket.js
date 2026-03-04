import { useEffect, useRef, useState, useCallback } from 'react'
import { useDispatch } from 'react-redux'

export const useWebSocket = (url) => {
    const [isConnected, setIsConnected] = useState(false)
    const [lastMessage, setLastMessage] = useState(null)
    const ws = useRef(null)
    const dispatch = useDispatch()

    useEffect(() => {
        ws.current = new WebSocket(url)

        ws.current.onopen = () => {
            setIsConnected(true)
            console.log('WebSocket connected')
        }

        ws.current.onclose = () => {
            setIsConnected(false)
            console.log('WebSocket disconnected')
        }

        ws.current.onmessage = (event) => {
            setLastMessage(JSON.parse(event.data))
        }

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error)
        }

        return () => {
            ws.current?.close()
        }
    }, [url])

    const sendMessage = useCallback((data) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify(data))
        }
    }, [])

    return { isConnected, lastMessage, sendMessage }
}