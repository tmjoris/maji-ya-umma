import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

function RequestConnectionPage() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [useSameLocation, setUseSameLocation] = useState(true);

  const email = localStorage.getItem("userEmail");

  const [formData, setFormData] = useState({
    address: "",
    city: "",
    zipCode: "",
  });

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await fetch(`http://localhost:5000/api/profile?email=${email}`);
        const data = await response.json();
        setFormData({
          address: data.user.address,
          city: data.user.city,
          zipCode: data.user.zipCode,
        });
      } catch (err) {
        setError("Error fetching user profile.",err);
        setIsLoading(false);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.id]: e.target.value });
  };

  const handleRequestConnection = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/request-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: email,
            address: useSameLocation ? "" : formData.address,
            city: useSameLocation ? "" : formData.city,
            zipCode: useSameLocation ? "" : formData.zipCode,
        }),
      });

      if (response.ok) {
        setSuccess(true);
      } else {
        const errorData = await response.json();
        setError(errorData.message || "Connection request failed");
      }
    } catch (err) {
      console.error("Error during connection request:", err);
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center text-gray-800">
          Request a New Connection
        </h1>

        {isLoading ? (
          <div className="text-center space-y-4">
            <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-500" />
            <p className="text-gray-600">Loading your profile details...</p>
          </div>
        ) : error ? (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-red-600">
              Error fetching profile
            </h2>
            <p className="text-gray-600">{error}</p>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-4 px-4 py-2 bg-[#1EBBD7] text-white rounded-md hover:bg-[#1EBBD7]/90"
            >
              Go to Dashboard
            </button>
          </div>
        ) : success ? (
          <div className="text-center space-y-4">
            <h2 className="text-xl font-semibold text-green-600">
              Connection request successful!
            </h2>
            <p className="text-gray-600">Redirecting to dashboard...</p>
          </div>
        ) : (
          <div>
            <button
              onClick={() => navigate("/dashboard")}
              className="mt-4 px-4 py-2 bg-[#1EBBD7] text-white rounded-md hover:bg-[#1EBBD7]/90"
            >
              Go Back to the Dashboard
            </button>
            {/* Show the saved profile address */}
            <p className="text-gray-700 font-medium">
              Is the new connection at this location?
            </p>
            <div className="border rounded-md p-3 bg-gray-100 text-gray-800">
              <p>
                <strong>Address:</strong> {formData.address}
              </p>
              <p>
                <strong>City:</strong> {formData.city}
              </p>
              <p>
                <strong>ZIP Code:</strong> {formData.zipCode}
              </p>
            </div>

            {/* User choice */}
            <div className="mt-4">
            <label className="flex items-center space-x-2 text-gray-800 font-medium">
            <input
            type="radio"
              name="locationChoice"
              checked={useSameLocation}
              onChange={() => setUseSameLocation(true)}
              className="accent-[#1EBBD7]"
            />
            <span>Use this location</span>
          </label>
          <label className="flex items-center space-x-2 mt-2 text-gray-800 font-medium">
            <input
              type="radio"
              name="locationChoice"
              checked={!useSameLocation}
              onChange={() => setUseSameLocation(false)}
              className="accent-[#1EBBD7]"
            />
            <span>Enter a different location</span>
          </label>
        </div>

            {/* If user wants a different location, show form */}
            {!useSameLocation && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-black font-medium" htmlFor="address">
                    Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    className="w-full border rounded-md p-2 text-black bg-white"
                    value={formData.address}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-black font-medium" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    type="text"
                    className="w-full border rounded-md p-2 text-black bg-white"
                    value={formData.city}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-black font-medium" htmlFor="zipCode">
                    ZIP Code
                  </label>
                  <input
                    id="zipCode"
                    type="text"
                    className="w-full border rounded-md p-2 text-black bg-white"
                    value={formData.zipCode}
                    onChange={handleChange}
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleRequestConnection}
              className="mt-6 w-full px-4 py-2 bg-[#1EBBD7] text-white rounded-md hover:bg-[#1EBBD7]/90"
            >
              Submit Request
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RequestConnectionPage;
