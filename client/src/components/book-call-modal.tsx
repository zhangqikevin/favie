import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { bookCallSchema, type BookCallForm } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle } from "lucide-react";

interface BookCallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function BookCallModal({ open, onOpenChange }: BookCallModalProps) {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<BookCallForm>({
    resolver: zodResolver(bookCallSchema),
    defaultValues: {
      name: "",
      email: "",
      restaurantName: "",
      city: "",
      primaryChallenge: "",
    },
  });

  function onSubmit(data: BookCallForm) {
    if (typeof window !== "undefined" && (window as any).analytics) {
      (window as any).analytics.track("book_call_submitted", data);
    }
    setSubmitted(true);
  }

  function handleClose(val: boolean) {
    if (!val) {
      setTimeout(() => {
        setSubmitted(false);
        form.reset();
      }, 300);
    }
    onOpenChange(val);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-card" data-testid="modal-book-call">
        {submitted ? (
          <div className="flex flex-col items-center py-8 text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-secondary/20 flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-secondary" />
            </div>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl" data-testid="text-success-title">
                We'll be in touch shortly.
              </DialogTitle>
              <DialogDescription className="text-muted-foreground mt-2" data-testid="text-success-description">
                Thanks for reaching out. A member of our team will follow up within one business day to schedule your consultation.
              </DialogDescription>
            </DialogHeader>
            <Button
              variant="outline"
              onClick={() => handleClose(false)}
              data-testid="button-close-success"
            >
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Book a Growth Consultation</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Tell us about your restaurant and your primary growth challenge. We'll prepare a focused agenda before your call.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} data-testid="input-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jane@myrestaurant.com" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="restaurantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Restaurant or Business Name</FormLabel>
                      <FormControl>
                        <Input placeholder="The Golden Fork" {...field} data-testid="input-restaurant" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>City</FormLabel>
                      <FormControl>
                        <Input placeholder="Austin, TX" {...field} data-testid="input-city" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="primaryChallenge"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Growth Challenge</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-challenge">
                            <SelectValue placeholder="Select your biggest challenge" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="delivery-performance">Delivery platform performance</SelectItem>
                          <SelectItem value="social-content">Social media and content</SelectItem>
                          <SelectItem value="reputation">Reviews and reputation</SelectItem>
                          <SelectItem value="retention">Guest retention and repeat purchase</SelectItem>
                          <SelectItem value="new-launch">New restaurant launch</SelectItem>
                          <SelectItem value="all">All of the above</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" data-testid="button-submit-form">
                  Request My Consultation
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
