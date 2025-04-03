import { Search } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"

function TicketsPage() {
  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ticket Management</h1>
            <p className="text-muted-foreground">View and manage customer support tickets</p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tickets</SelectItem>
                <SelectItem value="open">Open Tickets</SelectItem>
                <SelectItem value="closed">Closed Tickets</SelectItem>
              </SelectContent>
            </Select>
            <Button className="bg-amber-600 hover:bg-amber-700">Export Report</Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Ticket Overview</CardTitle>
            <CardDescription>Summary of support ticket activity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Tickets</p>
              <p className="text-2xl font-bold">124</p>
              <p className="text-sm text-muted-foreground">All time</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Open Tickets</p>
              <p className="text-2xl font-bold">24</p>
              <p className="text-sm text-red-500">+8% from last month</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Resolved This Month</p>
              <p className="text-2xl font-bold">42</p>
              <p className="text-sm text-green-500">+12% from last month</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Average Response Time</p>
              <p className="text-2xl font-bold">4.2 hours</p>
              <p className="text-sm text-green-500">-15% from last month</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>View and manage customer support requests</CardDescription>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search tickets..." className="pl-8" />
              </div>
              <Button>Search</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Ticket ID</th>
                    <th className="px-4 py-2 text-left font-medium">Customer</th>
                    <th className="px-4 py-2 text-left font-medium">Subject</th>
                    <th className="px-4 py-2 text-left font-medium">Priority</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Created</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">#T-{1230 + index}</td>
                      <td className="px-4 py-2">
                        {["John Doe", "Jane Smith", "Robert Johnson", "Emily Davis", "Michael Wilson"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        {
                          [
                            "Billing discrepancy",
                            "Payment failed",
                            "Usage monitoring",
                            "Account access issue",
                            "Water quality concern",
                          ][index % 5]
                        }
                      </td>
                      <td className="px-4 py-2">
                        {index % 5 === 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">High</span>
                        ) : index % 3 === 0 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Medium</span>
                        ) : (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Low</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {index % 3 === 0 ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Resolved</span>
                        ) : index % 4 === 0 ? (
                          <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">In Progress</span>
                        ) : (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        {["Jul 10, 2023", "Jul 9, 2023", "Jul 8, 2023", "Jul 7, 2023", "Jul 6, 2023"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                          <Button variant="ghost" size="sm">
                            Assign
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Showing 1-10 of 24 tickets</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default TicketsPage

