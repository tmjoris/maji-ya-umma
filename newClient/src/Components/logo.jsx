import { Droplet } from "lucide-react"
import { Link } from "react-router-dom"

export function Logo({ variant = "default" }) {
  return (
    <Link
      to={variant === "admin" ? "/admin/dashboard" : "/dashboard"}
      className={`flex items-center gap-2 ${variant === "admin" ? "text-amber-600" : "text-water"}`}
    >
      <Droplet  />
      <span className="font-bold text-xl">{variant === "admin" ? "MajiYaUmma Admin" : "MajiYaUmma"}</span>
    </Link>
  )
}

