import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { CreditCard, Droplet, History, LifeBuoy, User } from "lucide-react"

import { Button } from "../../components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"

function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Reset error state
    setError("")
    
    // Validate form
    if (!email || !password) {
      setError("Both email and password are required")
      return
    }
    
    setIsLoading(true)
    
    try {
      // Call login API
      const response = await fetch('http://localhost:5000/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed')
      }
      
      // Login successful
      // Store email in localStorage
      localStorage.setItem('userEmail', email)
      navigate("/dashboard");
      
    } catch (error) {
      console.error('Login error:', error)
      setError(error.message || "Invalid credentials")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Brand section with logo, motto and features */}
      <div className="w-full md:w-1/2 bg-white p-8 flex flex-col justify-center items-center">
        <div className="max-w-md w-full mx-auto space-y-8">
          <div className="text-center">
            <div className="flex justify-center">
              <Droplet className="h-16 w-16 text-[#1EBBD7]" />
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-gray-900">Maji ya Umma</h1>
            <p className="mt-2 text-xl text-[#1EBBD7] font-medium">Managing Water, Empowering Users</p>
          </div>

          <div className="bg-gray-50 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Our Services</h2>
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Bill Payment</h3>
                  <p className="text-sm text-gray-500">Pay your water bills securely online</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <Droplet className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Usage Monitoring</h3>
                  <p className="text-sm text-gray-500">Track your water consumption patterns</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <History className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Payment History</h3>
                  <p className="text-sm text-gray-500">View your complete payment records</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <LifeBuoy className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Customer Support</h3>
                  <p className="text-sm text-gray-500">Get help when you need it</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 h-10 w-10 rounded-full bg-[#1EBBD7]/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-[#1EBBD7]" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-900">Account Management</h3>
                  <p className="text-sm text-gray-500">Update your profile and preferences</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Login form section */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full">
          <Card className="border-0 shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Sign In</CardTitle>
              <CardDescription>Access your WaterPay account</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="grid gap-4">
                {error && (
                  <div className="bg-red-50 text-red-500 p-3 rounded-md text-sm">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-[#1EBBD7] hover:underline">
                      Forgot password?
                    </Link>
                  </div>
                  <Input 
                    id="password" 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
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
                  {isLoading ? "Signing In..." : "Sign In"}
                </Button>
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/register" className="text-[#1EBBD7] hover:underline">
                    Sign up
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

export default LoginPage