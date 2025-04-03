import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { BarChart3, CreditCard, Droplet, Home, LifeBuoy, LogOut, Menu, Settings, User, X } from "lucide-react"

import { Button } from "../components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet"
import { Logo } from "./logo"

export function CustomerLayout({ children }) {
  const location = useLocation()
  const pathname = location.pathname
  const [open, setOpen] = useState(false)

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Home },
    { name: "Bills", href: "/bills", icon: CreditCard },
    { name: "Usage", href: "/usage", icon: Droplet },
    { name: "Payment History", href: "/payments", icon: BarChart3 },
    { name: "Feedback", href: "/feedback", icon: LifeBuoy },
    { name: "Profile", href: "/profile", icon: User },
  ]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header - full width */}
      <header className="sticky top-0 z-40 border-b bg-black">
  <div className="container flex h-16 items-center justify-between py-4 mx-auto px-4">
    {/* Left Section: Mobile Menu and Logo */}
    <div className="flex items-center gap-4">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <div className="flex items-center justify-between">
            <Logo />
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
              <X className="h-5 w-5" />
              <span className="sr-only">Close navigation menu</span>
            </Button>
          </div>
          <nav className="mt-8 flex flex-col gap-2">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  pathname === item.href ? "bg-blue-500 text-red" : "hover:bg-muted"
                }`}
                onClick={() => setOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <Logo />
    </div>

    {/* Center Section: Navigation Links (Desktop) */}
    <div className="hidden md:flex md:items-center md:gap-8 md:mx-auto">
      {navigation.map((item) => (
        <Link
          key={item.name}
          to={item.href}
          className={`text-sm font-medium transition-colors ${
            pathname === item.href ? "text-water" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {item.name}
        </Link>
      ))}
    </div>

    {/* Right Section: Settings and Logout */}
    <div className="flex items-center gap-4">
      <Button variant="ghost" size="icon">
        <Settings className="h-5 w-5" />
        <span className="sr-only">Settings</span>
      </Button>
      <Button variant="ghost" size="icon" asChild>
        <Link to="/login">
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Log out</span>
        </Link>
      </Button>
    </div>
  </div>
</header>

      {/* Main content - centered with padding */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto w-full px-4 py-6">
          {children}
        </div>
      </main>

      {/* Footer - full width */}
      <footer className="mt-auto w-full border-t bg-background py-6">
        <div className="container mx-auto flex flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-center text-sm text-muted-foreground md:text-left">
            &copy; {new Date().getFullYear()} MajiYaUmma. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Terms of Service
            </Link>
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Privacy Policy
            </Link>
            <Link to="#" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
              Contact Us
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
