"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Mic, PenTool, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type UserRole = "client" | "writer";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<UserRole>("client");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      router.push("/login?registered=true");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="py-8 px-4">
        <div className="max-w-md mx-auto">
          <Link href="/">
            <Image
              src="/logo.svg"
              alt="Compound"
              width={140}
              height={32}
              className="h-8 w-auto"
              priority
            />
          </Link>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md border-border bg-card backdrop-blur-md shadow-2xl">
          <CardHeader className="space-y-1 pb-6">
            <CardTitle className="text-2xl font-bold text-center text-card-foreground tracking-tight">
              Get Started
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Create your account in seconds
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-red-500/50 bg-red-500/10">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {/* Role Selection */}
              <div className="space-y-3">
                <Label className="text-muted-foreground">I am a...</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole("client")}
                    disabled={loading}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200",
                      role === "client"
                        ? "border-red-500 bg-red-500/10 text-foreground"
                        : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground bg-muted/30"
                    )}
                  >
                    {role === "client" && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    <Mic className={cn("h-6 w-6", role === "client" ? "text-red-500" : "")} />
                    <span className="font-medium">Founder</span>
                    <span className="text-xs text-muted-foreground">Share my story</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole("writer")}
                    disabled={loading}
                    className={cn(
                      "relative flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all duration-200",
                      role === "writer"
                        ? "border-red-500 bg-red-500/10 text-foreground"
                        : "border-border hover:border-muted-foreground/40 text-muted-foreground hover:text-foreground bg-muted/30"
                    )}
                  >
                    {role === "writer" && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    <PenTool className={cn("h-6 w-6", role === "writer" ? "text-red-500" : "")} />
                    <span className="font-medium">Writer</span>
                    <span className="text-xs text-muted-foreground">Create posts</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-muted-foreground">Full Name</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input border-input text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-muted-foreground">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input border-input text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-muted-foreground">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input border-input text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-muted-foreground">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="bg-input border-input text-foreground placeholder:text-muted-foreground/50"
                />
              </div>

              <Button type="submit" variant="premium" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>

            <div className="mt-8 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <Link
                href="/login"
                className="text-red-500 hover:text-red-400 font-medium transition-colors"
              >
                Sign in
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
