import { useCallback, useEffect, useRef, useState } from 'react'

export const CHAT_BOTTOM_THRESHOLD = 120

export function isNearChatBottom(viewport, threshold = CHAT_BOTTOM_THRESHOLD) {
  if (!viewport) return true
  const distance = Number(viewport.scrollHeight || 0) - Number(viewport.scrollTop || 0) - Number(viewport.clientHeight || 0)
  return Math.max(distance, 0) <= threshold
}

function scrollViewport(viewport, behavior) {
  if (!viewport) return
  if (typeof viewport.scrollTo === 'function') viewport.scrollTo({ top: viewport.scrollHeight, behavior })
  else viewport.scrollTop = viewport.scrollHeight
}

export function useChatViewport({ conversationId = '', messageCount = 0 } = {}) {
  const viewportRef = useRef(null)
  const bottomRef = useRef(null)
  const contentRef = useRef(null)
  const previousCountRef = useRef(0)
  const nearBottomRef = useRef(true)
  const programmaticScrollRef = useRef(false)
  const scrollTimerRef = useRef(0)
  const [unseenCount, setUnseenCount] = useState(0)
  const [isNearBottom, setIsNearBottom] = useState(true)

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
    programmaticScrollRef.current = behavior === 'smooth'
    scrollViewport(viewportRef.current, behavior)
    nearBottomRef.current = true
    setIsNearBottom(true)
    setUnseenCount(0)
    if (programmaticScrollRef.current) {
      scrollTimerRef.current = setTimeout(() => {
        programmaticScrollRef.current = false
        scrollTimerRef.current = 0
      }, 700)
    }
  }, [])

  const onScroll = useCallback(() => {
    const nearBottom = isNearChatBottom(viewportRef.current)
    if (programmaticScrollRef.current && !nearBottom) return
    if (nearBottom && scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = 0
      programmaticScrollRef.current = false
    }
    nearBottomRef.current = nearBottom
    setIsNearBottom(nearBottom)
    if (nearBottom) setUnseenCount(0)
  }, [])

  useEffect(() => {
    previousCountRef.current = Number(messageCount || 0)
    nearBottomRef.current = true
    setIsNearBottom(true)
    setUnseenCount(0)
    const frame = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame(() => scrollToBottom('auto'))
      : setTimeout(() => scrollToBottom('auto'), 0)
    return () => {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
      else clearTimeout(frame)
    }
  }, [conversationId, scrollToBottom])

  useEffect(() => () => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
  }, [])

  useEffect(() => {
    if ((!contentRef.current && !viewportRef.current) || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(() => {
      if (nearBottomRef.current || programmaticScrollRef.current) scrollToBottom('auto')
    })
    if (contentRef.current) observer.observe(contentRef.current)
    if (viewportRef.current) observer.observe(viewportRef.current)
    return () => observer.disconnect()
  }, [scrollToBottom])

  useEffect(() => {
    const nextCount = Number(messageCount || 0)
    const added = Math.max(nextCount - previousCountRef.current, 0)
    previousCountRef.current = nextCount
    if (!added) return

    if (nearBottomRef.current) {
      const frame = typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame(() => scrollToBottom('smooth'))
        : setTimeout(() => scrollToBottom('auto'), 0)
      return () => {
        if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame)
        else clearTimeout(frame)
      }
    }

    setUnseenCount((current) => current + added)
    return undefined
  }, [messageCount, scrollToBottom])

  return {
    viewportRef,
    bottomRef,
    contentRef,
    unseenCount,
    isNearBottom,
    onScroll,
    scrollToBottom,
  }
}
