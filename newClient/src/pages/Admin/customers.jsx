import { Link } from "react-router-dom"
import { PlusCircle, Search } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"

function CustomersPage() {
  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Customer Management</h1>
            <p className="text-muted-foreground">View and manage customer accounts</p>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Customer
          </Button>
        </div>

        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Search Customers</CardTitle>
            <CardDescription>Find customers by name, email, or account number</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search customers..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-full md:w-[180px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="overdue">Payment Overdue</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" className="w-full md:w-auto">
                Advanced Filters
              </Button>
              <Button className="w-full md:w-auto">Search</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer List</CardTitle>
            <CardDescription>Showing 10 of 2,420 customers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Account #</th>
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Balance</th>
                    <th className="px-4 py-2 text-left font-medium">Last Payment</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 10 }).map((_, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">WP-{1000 + index}</td>
                      <td className="px-4 py-2">
                        {["John Doe", "Jane Smith", "Robert Johnson", "Emily Davis", "Michael Wilson"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        {
                          [
                            "john@example.com",
                            "jane@example.com",
                            "robert@example.com",
                            "emily@example.com",
                            "michael@example.com",
                          ][index % 5]
                        }
                      </td>
                      <td className="px-4 py-2">
                        {index % 5 === 0 ? (
                          <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">Overdue</span>
                        ) : index % 4 === 0 ? (
                          <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Pending</span>
                        ) : (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-2">KSH {((Math.random() * 200 + 50) * 100).toFixed(0)}</td>
                      <td className="px-4 py-2">
                        {["Apr 10, 2025", "Apr 5, 2025", "March 28, 2025", "March 15, 2025", "March 10, 2025"][index % 5]}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/admin/customers/${1000 + index}`}>View</Link>
                          </Button>
                          <Button variant="ghost" size="sm">
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Showing 1-10 of 2,420 customers</p>
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

export default CustomersPage