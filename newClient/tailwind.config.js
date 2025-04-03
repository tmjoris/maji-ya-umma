// tailwind.config.js
export default {
	content: [
	  "./src/**/*.{html,js,jsx,ts,tsx}",
	],
	theme: {
	  extend: {
		colors: {
		  background: "hsl(var(--background))",
		  foreground: "hsl(var(--foreground))",
		  water: "#3498db", // Add your preferred color
        "water-foreground": "#ffffff", // Example foreground color
		  card: "hsl(var(--card))",
		  "card-foreground": "hsl(var(--card-foreground))",
		  popover: "hsl(var(--popover))",
		  "popover-foreground": "hsl(var(--popover-foreground))",
		  primary: "hsl(var(--primary))",
		  "primary-foreground": "hsl(var(--primary-foreground))",
		  secondary: "hsl(var(--secondary))",
		  "secondary-foreground": "hsl(var(--secondary-foreground))",
		  muted: "hsl(var(--muted))",
		  "muted-foreground": "hsl(var(--muted-foreground))",
		  accent: "hsl(var(--accent))",
		  "accent-foreground": "hsl(var(--accent-foreground))",
		  destructive: "hsl(var(--destructive))",
		  "destructive-foreground": "hsl(var(--destructive-foreground))",
		  border: "hsl(var(--border))",
		  input: "hsl(var(--input))",
		  ring: "hsl(var(--ring))",
		},
		borderRadius: {
		  radius: "var(--radius)",
		},
	  },
	},
	plugins: [],
  };