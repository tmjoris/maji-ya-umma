import { Link } from "react-router-dom"
import { CreditCard, Droplet, LifeBuoy, Users } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { AdminLayout } from "../../Components/admin-layout"
import { StatCard } from "../../Components/stat-card"
import { UsageChart } from "../../Components/usage-chart"

function AdminDashboard() {
  // Sample data for the usage chart
  const usageData = [
    { month: "Jan", usage: 12500 },
    { month: "Feb", usage: 15000 },
    { month: "Mar", usage: 18000 },
    { month: "Apr", usage: 14000 },
    { month: "May", usage: 13000 },
    { month: "Jun", usage: 16000 },
  ]

  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">System overview and key metrics</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">Export Report</Button>
            <Button className="bg-amber-600 hover:bg-amber-700">Generate Bills</Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Revenue"
            value="Ksh 4,523,189"
            description="Current month"
            icon={CreditCard}
            trend={{ value: 12, isPositive: true }}
          />
          <StatCard
            title="Active Customers"
            value="2,420"
            description="Total registered users"
            icon={Users}
            trend={{ value: 4, isPositive: true }}
          />
          <StatCard
            title="Total Usage"
            value="656,000 litres"
            description="Current month"
            icon={Droplet}
            trend={{ value: 8, isPositive: false }}
          />
          <StatCard
            title="Open Tickets"
            value="24"
            description="Requiring attention"
            icon={LifeBuoy}
            trend={{ value: 12, isPositive: false }}
          />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <UsageChart
            data={usageData}
            title="System-wide Usage"
            description="Monthly water consumption in thousands of liters"
          />

          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <CardDescription>Payment statistics for current month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Total Bills Generated</p>
                <p>2,350</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Bills Paid</p>
                <p>1,845</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Bills Overdue</p>
                <p className="text-red-500">505</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Payment Success Rate</p>
                <p>78.5%</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Average Bill Amount</p>
                <p>Ksh 12,450</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin/payments">View Detailed Report</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Recent Support Tickets</CardTitle>
              <CardDescription>Latest customer support requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Ticket ID</th>
                      <th className="px-4 py-2 text-left font-medium">Customer</th>
                      <th className="px-4 py-2 text-left font-medium">Subject</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Created</th>
                      <th className="px-4 py-2 text-left font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-2">#T-1234</td>
                      <td className="px-4 py-2">John Doe</td>
                      <td className="px-4 py-2">Billing discrepancy</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Pending</span>
                      </td>
                      <td className="px-4 py-2">Apr 10, 2025</td>
                      <td className="px-4 py-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">#T-1233</td>
                      <td className="px-4 py-2">Jane Smith</td>
                      <td className="px-4 py-2">Payment failed</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">Urgent</span>
                      </td>
                      <td className="px-4 py-2">Apr 9, 2025</td>
                      <td className="px-4 py-2">
                        <Button variant="ghost" size="sm">
                          View
                        </Button>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-2">#T-1232</td>
                      <td className="px-4 py-2">Robert Johnson</td>
                      <td className="px-4 py-2">Usage monitoring</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Resolved</span>
                      </td>
                      <td className="px-4 py-2">Apr 8, 2025</td>
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
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/admin/tickets">View All Tickets</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </AdminLayout>
  )
}

export default AdminDashboard

