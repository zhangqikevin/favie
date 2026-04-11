import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/header";
import Footer from "@/components/footer";

export default function NotFound() {
  return (
    <div className="min-h-screen">
      <Header />
      <div
        className="flex flex-col items-center justify-center py-40 px-4 text-center gap-4"
        data-testid="page-not-found"
      >
        <span className="font-serif text-8xl font-bold text-primary/20">404</span>
        <h1 className="font-serif text-3xl font-bold" data-testid="text-not-found-headline">
          Page Not Found
        </h1>
        <p className="text-muted-foreground max-w-sm">
          The page you're looking for doesn't exist. Let's get you back on track.
        </p>
        <div className="flex gap-3 mt-4">
          <Button asChild>
            <Link href="/" data-testid="link-not-found-home">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/services" data-testid="link-not-found-services">
              View Services
            </Link>
          </Button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
