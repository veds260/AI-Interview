import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  // Redirect logged-in users to their dashboard
  if (session?.user) {
    if (session.user.role === "admin") {
      redirect("/admin");
    } else if (session.user.role === "writer") {
      redirect("/writer");
    } else {
      redirect("/client");
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Header with backdrop blur */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-gray-950/80 border-b border-white/5">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <Image
            src="/logo.svg"
            alt="Compound"
            width={160}
            height={38}
            className="h-9 w-auto"
            priority
          />
          <div className="flex gap-6 items-center">
            <Link href="/login">
              <span className="text-gray-400 hover:text-white transition-colors duration-200 cursor-pointer text-sm font-medium">
                Sign in
              </span>
            </Link>
            <Link href="/register">
              <Button variant="premium" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-24">
        {/* Hero Section */}
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            Turn Conversations into Content
          </h1>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Share your story once. Our AI transforms it into tweets, threads, and posts that sound like you.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button variant="premium" size="lg" className="px-10">
                Begin Your Session
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="px-8 border-gray-700 text-gray-300 hover:text-white hover:border-gray-500 hover:bg-white/5"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-32 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Feature 1 */}
          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Voice Interviews</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Speak naturally. Our AI listens and asks smart follow-up questions based on your answers.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Smart Extraction</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Stories, hot takes, and insights automatically extracted and formatted as social posts.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Content Library</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              All your content organized and ready to publish. Copy, edit, and post in seconds.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 border-t border-gray-800/50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Compound</span>
          <span>Built for founders</span>
        </div>
      </footer>
    </div>
  );
}
