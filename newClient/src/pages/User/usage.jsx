import { useState, useEffect } from "react";
import { CustomerLayout } from "../../Components/customer-layout";
import { UsageChart } from "../../Components/usage-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Timestamp } from "firebase/firestore"; // Import Timestamp from Firebase

function UsagePage() {
  const [usageData, setUsageData] = useState([]);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState("6months"); // Default time period
  const email = localStorage.getItem("userEmail");

  const handleTimePeriodChange = (value) => {
    setTimePeriod(value);
    generateUsageData(startMonth, startYear, value);
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/profile?email=${email}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("API Response:", data);

        if (data && data.user && data.user.createdOn) {
          let creationDate;
          if (data.user.createdOn instanceof Timestamp) {
            creationDate = data.user.createdOn.toDate();
          } else if (data.user.createdOn.seconds && data.user.createdOn.nanoseconds){
              creationDate = new Date(data.user.createdOn.seconds * 1000 + data.user.createdOn.nanoseconds / 1000000);
          } else {
            creationDate = new Date(data.user.createdOn);
          }
          console.log(creationDate);

          if (creationDate instanceof Date && !isNaN(creationDate)) {
            const userStartMonth = creationDate.getMonth();
            const userStartYear = creationDate.getFullYear();

            generateUsageData(userStartMonth, userStartYear, timePeriod);
          } else {
            setError("Invalid date format in user profile.");
            console.error("Invalid date format:", data.user.createdOn);
          }
        } else {
          setError("User profile data is missing or invalid.");
          console.error("User profile data is missing or invalid:", data);
        }
      } catch (err) {
        setError("Error fetching user profile: " + err.message);
        console.error("Error fetching user profile:", err);
      }
    };

    if (email) {
      fetchUserProfile();
    } else {
      setError("User email not found in local storage.");
      console.error("User email not found in local storage.");
    }
  }, [email, timePeriod]);

 // Re-fetch when email or timePeriod changes

 const generateUsageData = (startMonth, startYear, selectedTimePeriod) => {
  const storageKey = `usageData_${selectedTimePeriod}`;
  const storedData = localStorage.getItem(storageKey);

  if (storedData) {
    setUsageData(JSON.parse(storedData));
    return;
  }

  const allMonths = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  let monthsList = [];
  let monthsToShow = selectedTimePeriod === "3months" ? 3 :
                     selectedTimePeriod === "6months" ? 6 : 12;

  let monthsCounter = 0;
  for (let year = currentYear; year >= startYear && monthsCounter < monthsToShow; year--) {
    let monthStart = year === currentYear ? currentMonth : 11;
    let monthEnd = year === startYear ? startMonth : 0;

    for (let month = monthStart; month >= monthEnd && monthsCounter < monthsToShow; month--) {
      monthsList.push({  // Use push instead of unshift to maintain chronological order
        month: `${allMonths[month]} ${year}`,
        usage: Math.floor(Math.random() * (200 - 100 + 1) + 100),
      });
      monthsCounter++;
    }
  }

  localStorage.setItem(storageKey, JSON.stringify(monthsList));
  setUsageData(monthsList);
};

  return (
    <CustomerLayout>
      <div className="container py-8">
        {error && <p className="text-red-500">{error}</p>}

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Water Usage</h1>
            <p className="text-muted-foreground">Monitor your water consumption</p>
          </div>
          <Select value={timePeriod} onValueChange={handleTimePeriodChange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3months">Last 3 Months</SelectItem>
              <SelectItem value="6months">Last 6 Months</SelectItem>
              <SelectItem value="1year">Last Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <UsageChart data={usageData} />

          <Card>
            <CardHeader>
              <CardTitle>Usage Details</CardTitle>
              <CardDescription>Monthly breakdown of your water consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageData.map((item, index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-2">
                    <div>
                      <p className="font-medium">{item.month}</p>
                      <p className="text-sm text-muted-foreground">
                        {index === 0 ? "Current month" : `${index} month${index > 1 ? "s" : ""} ago`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{item.usage} liters</p>
                      {index > 0 && (
                        <p
                          className={`text-sm ${
                            item.usage > usageData[index - 1].usage ? "text-red-500" : "text-green-500"
                          }`}
                        >
                          {item.usage > usageData[index - 1].usage
                            ? `+${item.usage - usageData[index - 1].usage}`
                            : `-${usageData[index - 1].usage - item.usage}`}{" "}
                          liters
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Conservation Tips</CardTitle>
              <CardDescription>Ways to reduce your water consumption</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 list-disc pl-5">
                <li>Fix leaky faucets and toilets promptly</li>
                <li>Install water-efficient showerheads and faucets</li>
                <li>Take shorter showers instead of baths</li>
                <li>Only run full loads in washing machines and dishwashers</li>
                <li>Water your lawn and garden in the early morning or evening</li>
                <li>Use a broom instead of a hose to clean driveways and sidewalks</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}

export default UsagePage;