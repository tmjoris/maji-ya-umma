import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CreditCard, Droplet, LifeBuoy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { CustomerLayout } from "../../Components/customer-layout";
import { StatCard } from "../../Components/stat-card";
import { UsageChart } from "../../Components/usage-chart";
import { getUsageDataFromLocalStorage } from "./utils";

function CustomerDashboard() {
  const [currentUsage, setCurrentUsage] = useState(0);
  const [averageUsage, setAverageUsage] = useState(0);
  const [usageChartData, setUsageChartData] = useState([]);
  const [currentBalance, setCurrentBalance] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const email = localStorage.getItem("userEmail");        
        const response = await fetch(`http://localhost:5000/api/profile?email=${email}`);
        const data = await response.json();

        console.log("API Response:", data);

        if (data.user) {
          setFirstName(data.user.firstName); 
          setLastName(data.user.lastName);           
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }
    };

    fetchUserProfile();
  }, []);

  useEffect(() => {
    const calculateUsage = () => {
      const usageData3Months = getUsageDataFromLocalStorage("3months") || [];
      const usageData6Months = getUsageDataFromLocalStorage("6months") || [];
      const usageData1Year = getUsageDataFromLocalStorage("1year") || [];

      const allUsageData = [...usageData3Months, ...usageData6Months, ...usageData1Year];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const currentMonthUsage = allUsageData.filter((entry) => {
        const entryDate = new Date(entry.month);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      });

      const totalCurrentUsage = currentMonthUsage.reduce((sum, entry) => sum + entry.usage, 0);
      setCurrentUsage(totalCurrentUsage);

      const totalAverageUsage = allUsageData.reduce((sum, entry) => sum + entry.usage, 0);
      const averageUsageValue = allUsageData.length > 0 ? totalAverageUsage / allUsageData.length : 0;
      setAverageUsage(averageUsageValue);

      setUsageChartData(
        allUsageData.map((entry) => ({
          month: entry.month.split(" ")[0],
          usage: entry.usage,
        }))
      );

      setCurrentBalance(totalCurrentUsage * 3);
    };

    calculateUsage();
  }, []);

  return (
    <CustomerLayout>
      <div className="container py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">Welcome back {firstName} {lastName}</p>
          </div>
          <Button className="bg-water hover:bg-water-dark" asChild>
            <Link to="/bills">Pay Bill</Link>
          </Button>
          <Button className="bg-water hover:bg-water-dark" asChild>
            <Link to="/request-connection">Request Water Connection</Link>
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Current Balance"
            value={`Ksh ${currentBalance}`}
            description={`Due on ${new Date().toLocaleDateString()}`}
            icon={CreditCard}
            trend={{ value: 12, isPositive: false }}
          />
          <StatCard title="Last Payment" value="Ksh 1,000" description="Paid on March 10, 2025" icon={CreditCard} />
          <StatCard
            title="Current Usage"
            value={`${currentUsage} liters`}
            description={`As of ${new Date().toLocaleDateString()}`}
            icon={Droplet}
            trend={{ value: 8, isPositive: true }}
          />
          <StatCard title="Average Usage" value={`${averageUsage.toFixed(2)} liters`} description="Last 6 months" icon={BarChart3} />
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <UsageChart data={usageChartData} />

          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your recent account activity</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium">Bill Generated</p>
                  <p className="text-sm text-muted-foreground">April 1, 2025</p>
                </div>
                <p className="font-medium">Ksh 1250</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium">Payment Received</p>
                  <p className="text-sm text-muted-foreground">March 10, 2025</p>
                </div>
                <p className="font-medium text-green-600">Ksh 1120</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <div>
                  <p className="font-medium">Bill Generated</p>
                  <p className="text-sm text-muted-foreground">March 1, 2025</p>
                </div>
                <p className="font-medium">Ksh 1820</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/payments">View All Activity</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
              <CardDescription>Contact our support team or check our FAQ</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 sm:flex-row">
              <Button variant="outline" className="flex items-center gap-2" asChild>
                <Link to="/feedback">
                  <LifeBuoy className="h-4 w-4" />
                  Submit a Support Ticket
                </Link>
              </Button>
              <Button variant="outline" className="flex items-center gap-2">
                <LifeBuoy className="h-4 w-4" />
                View FAQ
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}

export default CustomerDashboard;
