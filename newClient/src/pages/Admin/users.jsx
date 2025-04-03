import { PlusCircle, Search } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { AdminLayout } from "../../Components/admin-layout"

function UsersPage() {
  return (
    <AdminLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
            <p className="text-muted-foreground">Manage administrator accounts and permissions</p>
          </div>
          <Button className="bg-amber-600 hover:bg-amber-700">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>System Users</CardTitle>
              <CardDescription>Manage administrator accounts and access</CardDescription>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-8" />
              </div>
              <Select defaultValue="all">
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
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
                    <th className="px-4 py-2 text-left font-medium">Name</th>
                    <th className="px-4 py-2 text-left font-medium">Email</th>
                    <th className="px-4 py-2 text-left font-medium">Role</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Last Login</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="px-4 py-2">Admin User</td>
                    <td className="px-4 py-2">admin@waterpay.example</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-purple-100 px-2 py-1 text-xs text-purple-800">
                        Administrator
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</span>
                    </td>
                    <td className="px-4 py-2">March 10, 2025 9:42 AM</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">Sarah Johnson</td>
                    <td className="px-4 py-2">sarah@waterpay.example</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Manager</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</span>
                    </td>
                    <td className="px-4 py-2">March 9, 2025 2:15 PM</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">David Miller</td>
                    <td className="px-4 py-2">david@waterpay.example</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Support</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</span>
                    </td>
                    <td className="px-4 py-2">April 10, 2025 10:30 AM</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">Jessica Lee</td>
                    <td className="px-4 py-2">jessica@waterpay.example</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Support</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800">Inactive</span>
                    </td>
                    <td className="px-4 py-2">March 6, 2025 3:45 PM</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-green-500">
                          Activate
                        </Button>
                      </div>
                    </td>
                  </tr>
                  <tr className="border-b">
                    <td className="px-4 py-2">Michael Brown</td>
                    <td className="px-4 py-2">michael@waterpay.example</td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Manager</span>
                    </td>
                    <td className="px-4 py-2">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">Active</span>
                    </td>
                    <td className="px-4 py-2">March 7, 2025 9:15 AM</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm">
                          Edit
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-500">
                          Deactivate
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default UsersPage

