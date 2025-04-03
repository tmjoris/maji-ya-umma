import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import waterAccess from "../../assets/water-access.jpg";
import communitySupport from "../../assets/community-support.jpg";
import waterTracking from "../../assets/water-tracking.jpg";


const slides = [
  {
    title:"Maji ya Umma",
    subtitle: "Affordable, Clean Water for All",
    description:
      "MajiYaUmma ensures that every household has access to safe and affordable water.",
    image: waterAccess,
  },
  {
    title: "Empowering Communities",
    description:
      "We work with local leaders to build sustainable water solutions for the people.",
    image: communitySupport,
  },
  {
    title: "Convenient & Reliable",
    description:
      "Easily track water usage, pay bills, and find water points near you—all in one platform.",
    image: waterTracking,
  },
];

export default function HomePage() {
    const [current, setCurrent] = useState(0);
  
    useEffect(() => {
      const interval = setInterval(() => {
        setCurrent((prev) => (prev + 1) % slides.length);
      }, 5000);
      return () => clearInterval(interval);
    }, []);
  
    return (
      <div className="flex flex-col min-h-screen">
        {/* Slideshow Section */}
        <div className="relative w-full h-screen flex-grow overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[current].title}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              transition={{ duration: 0.8 }}
              className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
            >
              <img
                src={slides[current].image}
                alt={slides[current].title}
                className="absolute inset-0 w-full h-full object-cover -z-10"
              />
              <div className="text-center text-gray px-6">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">
                  {slides[current].title}
                </h1>
                <p className="text-lg md:text-xl mb-6">
                  {slides[current].description}
                </p>
                <Link to="/login">
                  <Button className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg">
                    Get Started
                  </Button>
                </Link>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
  
        {/* About Us Section */}
        <div className="bg-gray-900 text-gray-300 py-16 px-6 text-center">
          <h2 className="text-4xl font-bold mb-4 text-gray-200">About Us</h2>
          <p className="text-lg md:text-xl max-w-3xl mx-auto">
            At Maji ya Umma, we believe that clean water isn’t a luxury—it’s a right. Our work goes beyond just providing water; we empower communities with sustainable water solutions that last. By combining innovative technology with local knowledge, we ensure that every household has access to safe, affordable water—because no one should have to choose between health and survival.
          </p>
        </div>
      </div>
    );
  }
  
