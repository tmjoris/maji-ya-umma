import { Download, FileText, PlusCircle, Search } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"

function BillingPage() {
  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Billing Management</h1>
            <p className="text-muted-foreground">Generate and manage customer bills</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button className="bg-amber-600 hover:bg-amber-700">
              <PlusCircle className="mr-2 h-4 w-4" />
              Generate Bills
            </Button>
          </div>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Billing Cycles</CardTitle>
            <CardDescription>Manage billing periods and generation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Cycle ID</th>
                    <th className="px-4 py-2 text-left font-medium">Period</th>
                    <th className="px-4 py-2 text-left font-medium">Due Date</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Bills Generated</th>
                    <th className="px-4 py-2 text-left font-medium">Total Amount</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2">BC-2025-04</td>
                    <td className="px-4 py-2">March 1 - March 31, 2025</td>
                    <td className="px-4 py-2">April 15, 2023</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">In Progress</span>
                    </td>
                    <td className="px-4 py-2">0 / 2,420</td>
                    <td className="px-4 py-2">Ksh 0.00</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm">
                        Generate
                      </Button>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">BC-2025-03</td>
                    <td className="px-4 py-2">February 1 - Februaryy 30, 2025</td>
                    <td className="px-4 py-2">March 15, 2025</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Completed</span>
                    </td>
                    <td className="px-4 py-2">2,350 / 2,350</td>
                    <td className="px-4 py-2">Ksh 29,257,500</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">BC-2025-02</td>
                    <td className="px-4 py-2">Jan 1 - Jan 31, 2025</td>
                    <td className="px-4 py-2">February 15, 2023</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Completed</span>
                    </td>
                    <td className="px-4 py-2">2,320 / 2,320</td>
                    <td className="px-4 py-2">Ksh 28,536,000</td>
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="sm">
                        View
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Bills</CardTitle>
              <CardDescription>View and manage individual bills</CardDescription>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search bills..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
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
                    <th className="px-4 py-2 text-left font-medium">Bill ID</th>
                    <th className="px-4 py-2 text-left font-medium">Customer</th>
                    <th className="px-4 py-2 text-left font-medium">Account #</th>
                    <th className="px-4 py-2 text-left font-medium">Amount</th>
                    <th className="px-4 py-2 text-left font-medium">Due Date</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">WB-2025-03-{1000 + index}</td>
                      <td className="px-4 py-2">
                        {["John Doe", "Jane Smith", "Robert Johnson", "Emily Davis", "Michael Wilson"][index % 5]}
                      </td>
                      <td className="px-4 py-2">WP-{1000 + index}</td>
                      <td className="px-4 py-2">Ksh {((Math.random() * 200 + 50) * 100).toFixed(0)}</td>
                      <td className="px-4 py-2">April 15, 2023</td>
                      <td className="px-4 py-2">
                        {index % 5 === 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">Overdue</span>
                        ) : index % 3 === 0 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Unpaid</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Paid</span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm">
                            <FileText className="mr-1 h-4 w-4" />
                            View
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Download className="mr-1 h-4 w-4" />
                            PDF
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Showing 1-10 of 2,350 bills</p>
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

export default BillingPage

