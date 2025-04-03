import { useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card"

export function UsageChart({ data, title = "Water Usage", description = "Monthly water consumption in litres" }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (!canvasRef.current) return

    const ctx = canvasRef.current.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

    // Set dimensions
    const width = canvasRef.current.width
    const height = canvasRef.current.height
    const padding = 40
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2

    // Find max value for scaling
    const maxUsage = Math.max(...data.map((item) => item.usage))
    const scale = chartHeight / maxUsage

    // Draw axes
    ctx.beginPath()
    ctx.moveTo(padding, padding)
    ctx.lineTo(padding, height - padding)
    ctx.lineTo(width - padding, height - padding)
    ctx.strokeStyle = "#94a3b8"
    ctx.lineWidth = 1
    ctx.stroke()

    // Draw bars
    const barWidth = (chartWidth / data.length) * 0.8
    const barSpacing = (chartWidth / data.length) * 0.2

    data.forEach((item, index) => {
      const x = padding + index * (barWidth + barSpacing) + barSpacing / 2
      const barHeight = item.usage * scale
      const y = height - padding - barHeight

      // Draw bar
      ctx.fillStyle = "rgba(59, 130, 246, 0.8)"
      ctx.fillRect(x, y, barWidth, barHeight)

      // Draw month label
      ctx.fillStyle = "#64748b"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(item.month, x + barWidth / 2, height - padding + 15)

      // Draw usage value
      ctx.fillStyle = "#1e293b"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(item.usage.toString(), x + barWidth / 2, y - 5)
    })

    // Draw y-axis labels
    const yAxisSteps = 5
    for (let i = 0; i <= yAxisSteps; i++) {
      const value = Math.round((maxUsage / yAxisSteps) * i)
      const y = height - padding - value * scale

      ctx.fillStyle = "#64748b"
      ctx.font = "10px sans-serif"
      ctx.textAlign = "right"
      ctx.fillText(value.toString(), padding - 5, y + 3)

      // Draw grid line
      ctx.beginPath()
      ctx.moveTo(padding, y)
      ctx.lineTo(width - padding, y)
      ctx.strokeStyle = "rgba(148, 163, 184, 0.2)"
      ctx.stroke()
    }
  }, [data])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80 w-full">
          <canvas ref={canvasRef} width={800} height={400} className="w-full h-full" />
        </div>
      </CardContent>
    </Card>
  )
}

