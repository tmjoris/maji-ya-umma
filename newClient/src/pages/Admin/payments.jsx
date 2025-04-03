import { BarChart3, Download, Search } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"

function PaymentsManagementPage() {
  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment Management</h1>
            <p className="text-muted-foreground">View and manage customer payments</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export Report
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <BarChart3 className="mr-2 h-4 w-4" />
              Payment Analytics
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Payment Overview</CardTitle>
            <CardDescription>Summary of payment activity</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Payments (This Month)</p>
              <p className="text-2xl font-bold">Ksh 4,523,189</p>
              <p className="text-sm text-green-500">+12% from last month</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Successful Payments</p>
              <p className="text-2xl font-bold">1,845</p>
              <p className="text-sm text-muted-foreground">78.5% success rate</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Failed Payments</p>
              <p className="text-2xl font-bold">32</p>
              <p className="text-sm text-red-500">+5% from last month</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Pending Payments</p>
              <p className="text-2xl font-bold">18</p>
              <p className="text-sm text-muted-foreground">Processing</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Payment Records</CardTitle>
              <CardDescription>View and manage payment transactions</CardDescription>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search payments..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Button>Search</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Payment ID</th>
                    <th className="px-4 py-2 text-left font-medium">Customer</th>
                    <th className="px-4 py-2 text-left font-medium">Amount</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Method</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">P-{10000 + index}</td>
                      <td className="px-4 py-2">
                        {["John Doe", "Jane Smith", "Robert Johnson", "Emily Davis", "Michael Wilson"][index % 5]}
                      </td>
                      <td className="px-4 py-2">Ksh {(Math.random() * 200 + 50).toFixed(2)}</td>
                      <td className="px-4 py-2">
                        {["Apr 10, 2025", "Apr 9, 2025", "Apr 8, 2025", "Apr 7, 2023", "Apr 6, 2025"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        {["Credit Card", "Bank Transfer", "Credit Card", "Credit Card", "Bank Transfer"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        {index % 10 === 0 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Pending</span>
                        ) : index % 7 === 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">Failed</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Completed</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Showing 1-10 of 1,895 payments</p>
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

export default PaymentsManagementPage

