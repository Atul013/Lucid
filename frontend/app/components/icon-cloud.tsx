"use client"

import React, { useEffect, useRef, useState } from "react"

interface Icon {
  x: number; y: number; z: number
  scale: number; opacity: number; id: number
}

interface IconCloudProps {
  images?: string[]
  className?: string
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

export function IconCloud({ images, className = "" }: IconCloudProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [iconPositions, setIconPositions] = useState<Icon[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 })
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [targetRotation, setTargetRotation] = useState<{
    x: number; y: number; startX: number; startY: number
    distance: number; startTime: number; duration: number
  } | null>(null)
  const animationFrameRef = useRef<number>(0)
  const rotationRef = useRef({ x: 0, y: 0 })
  const iconCanvasesRef = useRef<HTMLCanvasElement[]>([])
  const imagesLoadedRef = useRef<boolean[]>([])

  useEffect(() => {
    if (!images?.length) return
    imagesLoadedRef.current = new Array(images.length).fill(false)
    iconCanvasesRef.current = images.map((src, index) => {
      const offscreen = document.createElement("canvas")
      offscreen.width = 40
      offscreen.height = 40
      const ctx = offscreen.getContext("2d")
      if (ctx) {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = src
        img.onload = () => {
          ctx.clearRect(0, 0, 40, 40)
          ctx.beginPath()
          ctx.arc(20, 20, 20, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
          ctx.drawImage(img, 0, 0, 40, 40)
          imagesLoadedRef.current[index] = true
        }
      }
      return offscreen
    })
  }, [images])

  useEffect(() => {
    const count = images?.length || 20
    const offset = 2 / count
    const increment = Math.PI * (3 - Math.sqrt(5))
    const newIcons: Icon[] = Array.from({ length: count }, (_, i) => {
      const yv = i * offset - 1 + offset / 2
      const r = Math.sqrt(1 - yv * yv)
      const phi = i * increment
      return {
        x: Math.cos(phi) * r * 100,
        y: yv * 100,
        z: Math.sin(phi) * r * 100,
        scale: 1, opacity: 1, id: i,
      }
    })
    setIconPositions(newIcons)
  }, [images])

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect || !canvasRef.current) return
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    iconPositions.forEach(icon => {
      const cosX = Math.cos(rotationRef.current.x)
      const sinX = Math.sin(rotationRef.current.x)
      const cosY = Math.cos(rotationRef.current.y)
      const sinY = Math.sin(rotationRef.current.y)
      const rx = icon.x * cosY - icon.z * sinY
      const rz = icon.x * sinY + icon.z * cosY
      const ry = icon.y * cosX + rz * sinX
      const sx = canvasRef.current!.width / 2 + rx
      const sy = canvasRef.current!.height / 2 + ry
      const scale = (rz + 200) / 300
      const radius = 20 * scale
      const dx = cx - sx; const dy = cy - sy
      if (dx * dx + dy * dy < radius * radius) {
        const tx = -Math.atan2(icon.y, Math.sqrt(icon.x * icon.x + icon.z * icon.z))
        const ty = Math.atan2(icon.x, icon.z)
        const curX = rotationRef.current.x; const curY = rotationRef.current.y
        const dist = Math.sqrt(Math.pow(tx - curX, 2) + Math.pow(ty - curY, 2))
        setTargetRotation({
          x: tx, y: ty, startX: curX, startY: curY,
          distance: dist, startTime: performance.now(),
          duration: Math.min(2000, Math.max(800, dist * 1000)),
        })
      }
    })
    setIsDragging(true)
    setLastMousePos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    if (isDragging) {
      rotationRef.current = {
        x: rotationRef.current.x + (e.clientY - lastMousePos.y) * 0.002,
        y: rotationRef.current.y + (e.clientX - lastMousePos.x) * 0.002,
      }
      setLastMousePos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => setIsDragging(false)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const cX = canvas.width / 2; const cY = canvas.height / 2
      const maxDist = Math.sqrt(cX * cX + cY * cY)
      const dx = mousePos.x - cX; const dy = mousePos.y - cY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const speed = 0.003 + (dist / maxDist) * 0.01

      if (targetRotation) {
        const elapsed = performance.now() - targetRotation.startTime
        const progress = Math.min(1, elapsed / targetRotation.duration)
        const eased = easeOutCubic(progress)
        rotationRef.current = {
          x: targetRotation.startX + (targetRotation.x - targetRotation.startX) * eased,
          y: targetRotation.startY + (targetRotation.y - targetRotation.startY) * eased,
        }
        if (progress >= 1) setTargetRotation(null)
      } else if (!isDragging) {
        rotationRef.current = {
          x: rotationRef.current.x + (dy / canvas.height) * speed,
          y: rotationRef.current.y + (dx / canvas.width) * speed,
        }
      }

      // Sort by z-depth for correct rendering order
      const sorted = iconPositions
        .map((icon, index) => {
          const cosX = Math.cos(rotationRef.current.x)
          const sinX = Math.sin(rotationRef.current.x)
          const cosY = Math.cos(rotationRef.current.y)
          const sinY = Math.sin(rotationRef.current.y)
          const rx = icon.x * cosY - icon.z * sinY
          const rz = icon.x * sinY + icon.z * cosY
          const ry = icon.y * cosX + rz * sinX
          return { rx, ry, rz, index }
        })
        .sort((a, b) => a.rz - b.rz)

      sorted.forEach(({ rx, ry, rz, index }) => {
        const scale = (rz + 200) / 300
        const opacity = Math.max(0.15, Math.min(1, (rz + 150) / 200))
        ctx.save()
        ctx.translate(cX + rx, cY + ry)
        ctx.scale(scale, scale)
        ctx.globalAlpha = opacity
        if (
          iconCanvasesRef.current[index] &&
          imagesLoadedRef.current[index]
        ) {
          ctx.drawImage(iconCanvasesRef.current[index], -20, -20, 40, 40)
        }
        ctx.restore()
      })

      animationFrameRef.current = requestAnimationFrame(animate)
    }

    animate()
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current) }
  }, [images, iconPositions, isDragging, mousePos, targetRotation])

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className={className}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      aria-label="Interactive 3D Icon Cloud"
      role="img"
    />
  )
}
