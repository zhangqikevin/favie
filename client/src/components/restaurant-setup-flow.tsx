import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  MapPin, CheckCircle2, Building2, ChefHat, ArrowRight, Loader2,
} from "lucide-react";
import { SiGoogle, SiYelp } from "react-icons/si";

const formSchema = z.object({
  name: z.string().min(2, "Restaurant name must be at least 2 characters"),
  address: z.string().min(5, "Please enter a full address"),
});

type FormValues = z.infer<typeof formSchema>;

type Step = "form" | "searching" | "results" | "done";

interface SearchResult {
  name: string;
  address: string;
  phone: string;
  cuisine: string;
  rating: string;
  reviewCount: number;
}

function generateMockResults(name: string, address: string): {
  google: SearchResult;
  yelp: SearchResult;
} {
  const googleRating = (4.0 + Math.random() * 0.8).toFixed(1);
  const yelpRating = (3.8 + Math.random() * 0.9).toFixed(1);
  const googleReviews = Math.floor(50 + Math.random() * 300);
  const yelpReviews = Math.floor(30 + Math.random() * 200);

  return {
    google: {
      name,
      address,
      phone: "",
      cuisine: "",
      rating: googleRating,
      reviewCount: googleReviews,
    },
    yelp: {
      name,
      address,
      phone: "",
      cuisine: "",
      rating: yelpRating,
      reviewCount: yelpReviews,
    },
  };
}

function StarRating({ rating }: { rating: string }) {
  const num = parseFloat(rating);
  const full = Math.floor(num);
  const half = num - full >= 0.5;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} className={cn(
          "w-3.5 h-3.5",
          i <= full ? "text-amber-400" : (half && i === full + 1) ? "text-amber-300" : "text-muted-foreground/30"
        )} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="text-xs font-semibold text-foreground ml-0.5">{rating}</span>
    </div>
  );
}

interface RestaurantSetupFlowProps {
  onComplete?: (restaurant: { id: string; name: string; address: string }) => void;
  compact?: boolean;
}

export default function RestaurantSetupFlow({ onComplete, compact }: RestaurantSetupFlowProps) {
  const [step, setStep] = useState<Step>("form");
  const [mockResults, setMockResults] = useState<{ google: SearchResult; yelp: SearchResult } | null>(null);
  const [formValues, setFormValues] = useState<FormValues>({ name: "", address: "" });
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", address: "" },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string; address: string; rating: string; reviewCount: number;
    }) => {
      const res = await apiRequest("POST", "/api/restaurants", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setStep("done");
      setTimeout(() => {
        onComplete?.(data.restaurant);
      }, 1200);
    },
  });

  const handleSearch = (values: FormValues) => {
    setFormValues(values);
    setStep("searching");
    const results = generateMockResults(values.name, values.address);
    setMockResults(results);
    setTimeout(() => setStep("results"), 1800);
  };

  const handleConfirm = (source: "google" | "yelp") => {
    if (!mockResults) return;
    const result = mockResults[source];
    createMutation.mutate({
      name: formValues.name,
      address: formValues.address,
      rating: result.rating,
      reviewCount: result.reviewCount,
    });
  };

  if (step === "done") {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center gap-3",
        compact ? "py-8" : "py-16"
      )}>
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">Restaurant added!</p>
          <p className="text-sm text-muted-foreground mt-0.5">{formValues.name}</p>
        </div>
      </div>
    );
  }

  if (step === "searching") {
    return (
      <div className={cn(
        "flex flex-col items-center justify-center text-center gap-4",
        compact ? "py-8" : "py-16"
      )}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <SiYelp size={20} color="#D32323" />
          </div>
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <SiGoogle size={20} color="#4285F4" />
          </div>
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Searching Yelp & Google Maps…</p>
          <p className="text-xs text-muted-foreground mt-0.5">Looking for "{formValues.name}"</p>
        </div>
      </div>
    );
  }

  if (step === "results" && mockResults) {
    return (
      <div className={cn("space-y-4", compact && "")}>
        <div>
          <p className="text-sm font-semibold text-foreground">We found your restaurant</p>
          <p className="text-xs text-muted-foreground mt-0.5">Confirm which listing is yours on each platform</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(["google", "yelp"] as const).map((source) => {
            const result = mockResults[source];
            const isGoogle = source === "google";
            return (
              <div
                key={source}
                className="bg-background border border-border rounded-xl p-4 space-y-3"
                data-testid={`card-search-result-${source}`}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    isGoogle ? "bg-blue-50" : "bg-red-50"
                  )}>
                    {isGoogle
                      ? <SiGoogle size={16} color="#4285F4" />
                      : <SiYelp size={16} color="#D32323" />
                    }
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isGoogle ? "Google Maps" : "Yelp"}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{result.name}</p>
                  <div className="flex items-start gap-1 mt-1">
                    <MapPin className="w-3 h-3 text-muted-foreground flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-snug">{result.address}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <StarRating rating={result.rating} />
                  <span className="text-xs text-muted-foreground">({result.reviewCount} reviews)</span>
                </div>

                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => handleConfirm(source)}
                  disabled={createMutation.isPending}
                  data-testid={`button-confirm-restaurant-${source}`}
                >
                  {createMutation.isPending
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <>This is my restaurant <ArrowRight className="w-3.5 h-3.5 ml-1" /></>
                  }
                </Button>
              </div>
            );
          })}
        </div>

        <button
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => { setStep("form"); form.reset(); }}
          data-testid="button-search-again"
        >
          ← Search again with different details
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!compact && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-base font-semibold text-foreground">Add your restaurant</p>
            <p className="text-sm text-muted-foreground">We'll find your listing on Yelp & Google Maps</p>
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSearch)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Restaurant Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="e.g. Golden Wok"
                    {...field}
                    data-testid="input-restaurant-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm">Address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="123 Main St, San Francisco, CA"
                      className="pl-9"
                      {...field}
                      data-testid="input-restaurant-address"
                    />
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button
            type="submit"
            className="w-full"
            data-testid="button-search-restaurant"
          >
            OK
          </Button>
        </form>
      </Form>
    </div>
  );
}
