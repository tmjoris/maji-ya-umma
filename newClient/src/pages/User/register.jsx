import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Droplet, Shield, CheckCircle } from "lucide-react"
import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneNumber: "",
    idNumber: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    password: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    
    try {
      const response = await fetch("http://localhost:5000/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(formData)
      });
      
      const data = await response.json();
      navigate("/login");
      
    } catch (error) {
      console.error("Error during registration:", error);
      setError("Network error or server unavailable. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Brand section with logo and motto */}
      <div className="w-full md:w-1/2 bg-white p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <Droplet className="h-16 w-16 text-[#1EBBD7]" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">MajiYaUmma</h1>
            <p className="mt-2 text-xl text-[#1EBBD7] font-medium">Managing Water, Empowering Users</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Why Create an Account?</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Convenient Bill Management</h3>
                  <p className="text-sm text-gray-500">Pay bills online and set up automatic payments</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Usage Insights</h3>
                  <p className="text-sm text-gray-500">Monitor your water usage and find ways to save</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">24/7 Account Access</h3>
                  <p className="text-sm text-gray-500">Manage your water service anytime, anywhere</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Secure & Private</h3>
                  <p className="text-sm text-gray-500">Your information is protected with industry-standard security</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Registration form section - MODIFIED with form functionality */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <Card className="border-0 shadow-lg">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle className="text-2xl">Create an Account</CardTitle>
                <CardDescription>Join MajiYaUmma to manage your water service</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                {error && (
                  <div className="bg-red-50 p-3 rounded-md text-red-600 text-sm">
                    {error}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input 
                      id="firstName" 
                      value={formData.firstName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input 
                      id="lastName" 
                      value={formData.lastName}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={formData.email}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input 
                    id="phoneNumber" 
                    placeholder="+254111111111" 
                    value={formData.phoneNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="idNumber">ID Number</Label>
                  <Input 
                    id="idNumber" 
                    placeholder="Your national ID number" 
                    value={formData.idNumber}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    placeholder="Your residential address" 
                    value={formData.address}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input 
                    id="city" 
                    placeholder="City of residence" 
                    value={formData.city}
                    onChange={handleChange}
                    required
                  />
                </div><div className="grid gap-2">
                  <Label htmlFor="state">State</Label>
                  <Input 
                    id="state" 
                    placeholder="Your state" 
                    value={formData.state}
                    onChange={handleChange}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input 
                    id="zipCode" 
                    placeholder="Your Zip Code" 
                    value={formData.zipCode}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={formData.password}
                    onChange={handleChange}
                    required
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col">
                <Button 
                  type="submit" 
                  className="w-full bg-[#1EBBD7] hover:bg-[#1EBBD7]/90"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating Account..." : "Create Account"}
                </Button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="text-[#1EBBD7] hover:underline">
                    Sign in
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default RegisterPage