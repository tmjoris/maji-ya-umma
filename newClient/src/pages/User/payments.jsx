import { CustomerLayout } from "../../Components/customer-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select"
import { Button } from "../../components/ui/button"
import { Download } from "lucide-react"
import jsPDF from "jspdf"

function PaymentsPage() {
  const payments = [
    { id: "P-2025-04-001", date: "April 10, 2025", amount: 12450, method: "Credit Card", status: "Completed" },
    { id: "P-2025-03-001", date: "March 10, 2025", amount: 11820, method: "Credit Card", status: "Completed" },
    { id: "P-2025-02-001", date: "February 12, 2025", amount: 12175, method: "Bank Transfer", status: "Completed" },
    { id: "P-2025-01-001", date: "January 10, 2025", amount: 11530, method: "Credit Card", status: "Completed" },
    { id: "P-2024-12-001", date: "December 11, 2024", amount: 13045, method: "Credit Card", status: "Completed" },
    { id: "P-2024-11-001", date: "November 10, 2024", amount: 12560, method: "Bank Transfer", status: "Completed" },
  ]


  // Function to generate PDF Receipt
  const downloadReceipt = (payment) => {
    const doc = new jsPDF()
       
    
    doc.setFontSize(18)
    doc.text("Payment Receipt", 20, 20)

    doc.setFontSize(12)
    doc.text(`Payment ID: ${payment.id}`, 20, 40)
    doc.text(`Date: ${payment.date}`, 20, 50)
    doc.text(`Amount: Ksh ${payment.amount.toFixed(2)}`, 20, 60)
    doc.text(`Payment Method: ${payment.method}`, 20, 70)
    doc.text(`Status: ${payment.status}`, 20, 80)

    doc.setFontSize(10)
    doc.text("Thank you for your payment!", 20, 100)

    doc.save(`Receipt-${payment.id}.pdf`)
  }
  
  return (
    <CustomerLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Payment History</h1>
            <p className="text-muted-foreground">View your past payments</p>
          </div>
          <div className="flex gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payments</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment Records</CardTitle>
            <CardDescription>Your payment history for the last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-2 text-left font-medium">Payment ID</th>
                    <th className="px-4 py-2 text-left font-medium">Date</th>
                    <th className="px-4 py-2 text-left font-medium">Amount</th>
                    <th className="px-4 py-2 text-left font-medium">Payment Method</th>
                    <th className="px-4 py-2 text-left font-medium">Status</th>
                    <th className="px-4 py-2 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr key={index} className="border-b">
                      <td className="px-4 py-2">{payment.id}</td>
                      <td className="px-4 py-2">{payment.date}</td>
                      <td className="px-4 py-2">Ksh {payment.amount.toFixed(2)}</td>
                      <td className="px-4 py-2">{payment.method}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-green-100 px-2 py-1 text-xs text-green-800">
                          {payment.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                      <Button variant="ghost" size="sm" onClick={() => downloadReceipt(payment)}>
                          <Download className="mr-1 h-4 w-4" />
                          Receipt
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Payment Summary</CardTitle>
              <CardDescription>Overview of your payment history</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Total Payments (Last 6 Months)</p>
                <p>Ksh {payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Average Monthly Payment</p>
                <p>Ksh {(payments.reduce((sum, payment) => sum + payment.amount, 0) / payments.length).toFixed(2)}</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Most Recent Payment</p>
                <p>
                  Ksh {payments[0].amount.toFixed(2)} on {payments[0].date}
                </p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Payment Method Used Most</p>
                <p>Credit Card</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upcoming Payments</CardTitle>
              <CardDescription>Your scheduled payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <p className="font-medium">April 2025 Bill</p>
                  <p className="text-sm text-muted-foreground">Due on April 15, 2025</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">Ksh 12450</p>
                  <p className="text-sm text-red-500">Due in 10 days</p>
                </div>
              </div>
              <div className="mt-4">
                <Button className="w-full bg-water hover:bg-water-dark">Pay Now</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  )
}

export default PaymentsPage

