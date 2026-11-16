import { useState } from "react"
import { Search } from "lucide-react"
import { toast } from "react-toastify"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Textarea } from "../../components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"
import { DataTable, matches } from "../../Components/data-table"
import { StatusBadge, ErrorNote } from "../../Components/status-badge"
import { TicketAttachment } from "../../Components/ticket-attachment"
import { api, useApi } from "../../lib/api"
import { formatDate, formatDateTime, fullName, displayPhone } from "../../lib/format"

function TicketDetail({ ticket, onSaved, onClose }) {
  const [status, setStatus] = useState(ticket.status)
  const [response, setResponse] = useState(ticket.response ?? "")
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api(`/api/admin/tickets/${ticket.id}`, { method: "PATCH", body: { status, response } })
      toast.success("Ticket updated, customer notified by email")
      onSaved()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6 border-water">
      <CardHeader>
        <CardTitle>{ticket.subject}</CardTitle>
        <CardDescription>
          {ticket.customerName ?? "—"} · {ticket.email} · {ticket.accountNumber ?? "no account"} · {formatDateTime(ticket.createdAt)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-wrap rounded bg-muted p-3 text-sm">{ticket.message}</p>
        <TicketAttachment ticket={ticket} endpoint={`/api/admin/tickets/${ticket.id}/attachment`} />
        <div className="grid gap-4 md:grid-cols-[200px_1fr]">
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="response">Reply to customer</Label>
            <Textarea id="response" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save & notify"}</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function ConnectionReview({ request, onDone, onClose }) {
  const [meterNumber, setMeterNumber] = useState("")
  const [initialReading, setInitialReading] = useState("0")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const decide = async (decision) => {
    setBusy(true)
    try {
      const res = await api(`/api/admin/connection-requests/${request.id}`, {
        method: "PATCH",
        body: { decision, note, ...(decision === "approve" ? { meterNumber: meterNumber || undefined, initialReading: Number(initialReading || 0) } : {}) },
      })
      toast.success(res.message)
      onDone()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mb-6 border-water">
      <CardHeader>
        <CardTitle>Review connection for {fullName(request)}</CardTitle>
        <CardDescription>
          {request.address}, {request.city} {request.zipCode} · {request.email} · {displayPhone(request.phoneNumber)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="meter">Meter number (blank = generate)</Label>
            <Input id="meter" placeholder="MTR-…" value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="initial">Initial reading (m³)</Label>
            <Input id="initial" type="number" min="0" step="0.001" value={initialReading} onChange={(e) => setInitialReading(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="note">Note to customer (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="bg-green-600 hover:bg-green-700" onClick={() => decide("approve")} disabled={busy}>Approve & install meter</Button>
          <Button variant="destructive" onClick={() => decide("reject")} disabled={busy}>Reject</Button>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TicketsPage() {
  const tickets = useApi("/api/admin/tickets")
  const connections = useApi("/api/admin/connection-requests")
  const [status, setStatus] = useState("active")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState(null)
  const [reviewing, setReviewing] = useState(null)

  const all = tickets.data?.tickets ?? []
  const rows = all.filter(
    (t) =>
      (status === "all" || (status === "active" ? t.status !== "resolved" : t.status === status)) &&
      matches(query, t.subject, t.customerName, t.email, t.accountNumber)
  )
  const requests = connections.data?.requests ?? []
  const pending = requests.filter((r) => (r.status ?? "").toLowerCase() === "pending")

  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Tickets & Requests</h1>
          <p className="text-muted-foreground">Support tickets and new connection requests</p>
        </div>

        <Card className="mb-8">
          <CardContent className="grid gap-6 pt-6 md:grid-cols-4">
            {[
              ["Total tickets", all.length],
              ["Open", all.filter((t) => t.status === "open").length],
              ["In progress", all.filter((t) => t.status === "in_progress").length],
              ["Connection requests pending", pending.length],
            ].map(([label, value]) => (
              <div key={label} className="space-y-1">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p className="text-2xl font-bold">{value}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Tabs defaultValue="tickets" className="space-y-6">
          <TabsList>
            <TabsTrigger value="tickets">Support Tickets</TabsTrigger>
            <TabsTrigger value="connections">Connection Requests{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
          </TabsList>

          <TabsContent value="tickets">
            {selected && (
              <TicketDetail
                key={selected.id}
                ticket={selected}
                onClose={() => setSelected(null)}
                onSaved={() => { setSelected(null); tickets.reload() }}
              />
            )}
            <Card>
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <CardTitle>Support Tickets</CardTitle>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search tickets…" className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
                  </div>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Open & in progress</SelectItem>
                      <SelectItem value="all">All tickets</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <ErrorNote error={tickets.error} onRetry={tickets.reload} />
                <DataTable
                  rows={rows}
                  loading={tickets.loading}
                  empty="No tickets"
                  columns={[
                    { header: "Customer", cell: (t) => t.customerName ?? t.email ?? "—" },
                    { header: "Subject", cell: (t) => t.subject },
                    { header: "Category", cell: (t) => t.category },
                    { header: "Priority", cell: (t) => <StatusBadge status={t.priority} /> },
                    { header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
                    { header: "Created", cell: (t) => formatDate(t.createdAt) },
                    { header: "", cell: (t) => <Button variant="ghost" size="sm" onClick={() => setSelected(t)}>View</Button> },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="connections">
            {reviewing && (
              <ConnectionReview
                key={reviewing.id}
                request={reviewing}
                onClose={() => setReviewing(null)}
                onDone={() => { setReviewing(null); connections.reload() }}
              />
            )}
            <Card>
              <CardHeader>
                <CardTitle>Connection Requests</CardTitle>
                <CardDescription>Approving creates the meter and links it to the customer's account</CardDescription>
              </CardHeader>
              <CardContent>
                <ErrorNote error={connections.error} onRetry={connections.reload} />
                <DataTable
                  rows={requests}
                  loading={connections.loading}
                  empty="No connection requests"
                  columns={[
                    { header: "Customer", cell: (r) => <><div>{fullName(r)}</div><div className="text-muted-foreground">{r.accountNumber ?? r.email}</div></> },
                    { header: "Location", cell: (r) => [r.address, r.city, r.zipCode].filter(Boolean).join(", ") },
                    { header: "Requested", cell: (r) => formatDate(r.createdAt) },
                    { header: "Status", cell: (r) => <StatusBadge status={(r.status ?? "pending").toLowerCase()} /> },
                    { header: "Meter", cell: (r) => r.meterNumber ?? "—" },
                    {
                      header: "",
                      cell: (r) =>
                        (r.status ?? "").toLowerCase() === "pending" && <Button variant="ghost" size="sm" onClick={() => setReviewing(r)}>Review</Button>,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  )
}

export default TicketsPage
