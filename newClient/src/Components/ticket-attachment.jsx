import { useEffect, useState } from "react"
import { Download } from "lucide-react"
import { toast } from "react-toastify"
import { Button } from "../components/ui/button"
import { api } from "../lib/api"

// A ticket's attachment. Images the server has verified from the file's bytes
// (PNG/JPEG/GIF/WebP) are previewed; anything else is a download only. The
// file is fetched with the user's token, so the preview uses a blob: URL.
export function TicketAttachment({ ticket, endpoint, compact = false }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    if (!ticket.attachmentIsImage) return
    let url = null
    let cancelled = false
    api(endpoint, { raw: true })
      .then((res) => res.blob())
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreviewUrl(url)
      })
      .catch(() => !cancelled && setPreviewFailed(true))
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [endpoint, ticket.attachmentIsImage])

  if (!ticket.attachmentName) return null

  const download = async () => {
    try {
      const res = await api(endpoint, { raw: true })
      const url = URL.createObjectURL(await res.blob())
      Object.assign(document.createElement("a"), { href: url, download: ticket.attachmentName }).click()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast.error(err.message)
    }
  }

  return (
    <div className="space-y-2">
      {previewUrl && (
        <a href={previewUrl} target="_blank" rel="noreferrer" title="Open full size">
          <img
            src={previewUrl}
            alt={`Attachment ${ticket.attachmentName}`}
            className={`rounded border object-contain ${compact ? "max-h-32" : "max-h-96"}`}
          />
        </a>
      )}
      {previewFailed && <p className="text-xs text-muted-foreground">Preview unavailable</p>}
      <Button variant="outline" size="sm" onClick={download}>
        <Download className="mr-1 h-4 w-4" /> {ticket.attachmentName}
      </Button>
    </div>
  )
}
