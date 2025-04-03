import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CreditCard, Smartphone, Building, Loader2 } from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { RadioGroup, RadioGroupItem } from "../../components/ui/radio-group";
import { getUsageDataFromLocalStorage } from "./utils"; 
import { CustomerLayout } from "../../Components/customer-layout";

const WATER_PRICE_PER_LITER = 3; 

function BillsPage() {
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [waterUsage, setWaterUsage] = useState(0);
  const [totalAmountDue, setTotalAmountDue] = useState(0);
  const [customAmount, setCustomAmount] = useState(0);
  const [cardNumber, setCardNumber] = useState("");
  const [cvv, setCvv] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const calculateTotalUsage = () => {
      const usageData3Months = getUsageDataFromLocalStorage("3months") || [];
      const usageData6Months = getUsageDataFromLocalStorage("6months") || [];
      const usageData1Year = getUsageDataFromLocalStorage("1year") || [];

      const allUsageData = [...usageData3Months, ...usageData6Months, ...usageData1Year];
      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      const filteredUsage = allUsageData.filter(entry => {
        const entryDate = new Date(entry.month);
        return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
      });

      const totalLiters = filteredUsage.reduce((sum, entry) => sum + entry.usage, 0);
      setWaterUsage(totalLiters);
      setTotalAmountDue(totalLiters * WATER_PRICE_PER_LITER);
      setCustomAmount(totalLiters * WATER_PRICE_PER_LITER);
    };

    calculateTotalUsage();
  }, []);


  const handlePayment = async () => {
    const email = localStorage.getItem("userEmail");        

    setIsProcessing(true);
    let paymentDetails = {};

    if (paymentMethod === "card") {
      paymentDetails = { cardNumber, cvv };
    } else if (paymentMethod === "bank") {
      paymentDetails = { bankName, accountNumber };
    } else if (paymentMethod === "mpesa") {
      paymentDetails = { mpesa: phoneNumber };
    }

    const paymentData = {
      email,
      customAmount,
      paymentMethod,
      paymentDetails,
    };
     // Log the request body (paymentData)
  console.log("Request body:", paymentData);

    try {
      const response = await fetch("http://localhost:5000/api/payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paymentData),
      });
  
      const data = await response.json();
  
      if (response.ok) {
        toast.success(`Payment of Ksh ${customAmount} via ${paymentMethod} was successful! 🎉`, {
          position: "top-right",
          autoClose: 3000,
        });
      } else {
        toast.error(data.message || "Error processing payment", {
          position: "top-right",
          autoClose: 3000,
        });
      }
    } catch (error) {
      toast.error("An unexpected error occurred while processing payment.", {
        position: "top-right",
        autoClose: 3000,
      });
    }

  
    setCardNumber("");
    setCvv("");
    setBankName("");
    setAccountNumber("");
    setPhoneNumber("");
    setCustomAmount(0);
    setIsProcessing(false);
  };
  


  return (
    <CustomerLayout>
      <ToastContainer /> 

      {/* Full-Page Loading Overlay */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Loader2 className="h-16 w-16 animate-spin text-white" />
        </div>
      )}

      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Pay Your Bill</h1>
          <p className="text-muted-foreground">Make a payment to your water account</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {/* Bill Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Current Bill</CardTitle>
              <CardDescription>Your current water bill details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Billing Period</p>
                <p>From {new Date().toLocaleString('default', { month: 'long' })} 1 to Today</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Water Usage</p>
                <p>{waterUsage} litres</p>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <p className="font-medium">Usage Charge</p>
                <p>Ksh {totalAmountDue}</p>
              </div>
              <div className="flex items-center justify-between text-red-500">
                <p className="font-medium">Due Date</p>
                <p>{new Date().toLocaleDateString()}</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/bills/download">Download PDF</Link>
              </Button>
            </CardFooter>
          </Card>

          {/* Payment Method Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Method</CardTitle>
              <CardDescription>Select your preferred payment method</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="card" id="card" />
                  <Label htmlFor="card" className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Credit/Debit Card
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="bank" id="bank" />
                  <Label htmlFor="bank" className="flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    Bank Account
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="mpesa" id="mpesa" />
                  <Label htmlFor="Enter Phone Number" className="flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    M-Pesa
                  </Label>
                </div>
              </RadioGroup>

              {paymentMethod === "card" && (
                <div className="space-y-4">
                  <Input placeholder="Card Number" value={cardNumber} onChange={e => setCardNumber(e.target.value)} />
                  <Input placeholder="CVV" type="password" value={cvv} onChange={e => setCvv(e.target.value)} />
                </div>
              )}

              {paymentMethod === "bank" && (
                <div className="space-y-4">
                  <Input placeholder="Bank Name" value={bankName} onChange={e => setBankName(e.target.value)} />
                  <Input placeholder="Account Number" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
                </div>
              )}

              {paymentMethod === "mpesa" && (
                <div className="space-y-4">
                  <Label htmlFor="amount">Enter M-PESA Phone Number</Label>
                  <Input placeholder="Phone Number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} />
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="amount">Payment Amount</Label>
                  <div className="flex items-center">
                    <span className="mr-2">Ksh</span>
                    <Input id="amount" type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-water hover:bg-water-dark" onClick={handlePayment} disabled={isProcessing}>
                Confirm Payment
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </CustomerLayout>
  );
}

export default BillsPage;
