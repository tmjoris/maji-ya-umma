import { useState, useRef } from "react";
import { CustomerLayout } from "../../Components/customer-layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Textarea } from "../../components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { Button } from "../../components/ui/button";

function FeedbackPage() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append("subject", subject);
    formData.append("category", category);
    formData.append("priority", priority);
    formData.append("message", message);
    if (attachment) {
      formData.append("attachment", attachment);
    }

    try {
      const response = await fetch("http://localhost:5000/api/feedback", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      alert(data.message);

      // Reset fields
      setSubject("");
      setCategory("");
      setPriority("");
      setMessage("");
      setAttachment(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  return (
    <CustomerLayout>
      <div className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Submit Complaint</h1>
          <p className="text-muted-foreground">Contact our support team or provide feedback</p>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>Submit a Support Ticket</CardTitle>
                <CardDescription>We'll respond to your inquiry within 24 hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    placeholder="Brief description of your issue"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select onValueChange={setCategory} value={category}>
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="billing">Billing Issue</SelectItem>
                      <SelectItem value="technical">Technical Problem</SelectItem>
                      <SelectItem value="account">Account Management</SelectItem>
                      <SelectItem value="service">Service Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select onValueChange={setPriority} value={priority}>
                    <SelectTrigger id="priority">
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Describe your issue in detail"
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="attachment">Attachment (optional)</Label>
                  <Input
                    id="attachment"
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => setAttachment(e.target.files[0])}
                  />
                </div>
              </CardContent>

              <CardFooter>
                <Button type="submit" className="w-full bg-water hover:bg-water-dark">
                  Submit Ticket
                </Button>
              </CardFooter>
            </form>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
                <CardDescription>Ways to reach our support team</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="font-medium">Customer Support</p>
                  <p>+254 796657269</p>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="font-medium">Email</p>
                  <p>support@MajiYaUmma.example</p>
                </div>
                <div className="flex items-center justify-between border-b pb-2">
                  <p className="font-medium">Hours</p>
                  <p>Mon-Fri: 8am-6pm</p>
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-medium">Emergency Line</p>
                  <p>+254 796657269</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
                <CardDescription>Quick answers to common questions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-b pb-2">
                  <p className="font-medium">How do I read my water meter?</p>
                  <p className="text-sm text-muted-foreground">
                    Your water meter is typically located near the street. The dial shows your usage in liters.
                  </p>
                </div>
                <div className="border-b pb-2">
                  <p className="font-medium">What if I can't pay my bill on time?</p>
                  <p className="text-sm text-muted-foreground">
                    Contact us before the due date to discuss payment arrangements or extensions.
                  </p>
                </div>
                <div className="border-b pb-2">
                  <p className="font-medium">How do I report a water leak?</p>
                  <p className="text-sm text-muted-foreground">
                    Call our emergency line immediately at +254 796657269 to report water leaks.
                  </p>
                </div>
                <div>
                  <p className="font-medium">When is my bill due?</p>
                  <p className="text-sm text-muted-foreground">
                    Bills are typically due on the 15th of each month. Check your bill for the exact date.
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All FAQs
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}

export default FeedbackPage;
