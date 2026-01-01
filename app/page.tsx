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
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <Image
          src="/logo.svg"
          alt="Compound"
          width={180}
          height={42}
          className="h-10 w-auto"
          priority
        />
        <div className="flex gap-4">
          <Link href="/login">
            <Button variant="ghost" className="text-white hover:bg-gray-800">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button className="bg-red-600 hover:bg-red-700">Get Started</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl font-bold tracking-tight text-white mb-6">
            Extract Content from Founders with AI
          </h1>
          <p className="text-xl text-gray-300 mb-10">
            Conduct structured AI-powered interviews to systematically extract
            stories, hot takes, and expertise. Transform founder insights into
            tweets, threads, and long-form content.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="px-8 bg-red-600 hover:bg-red-700">
                Start Interviewing
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8 text-white border-gray-600 hover:bg-gray-800">
                Sign In
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2 text-white">AI Avatar Interviews</h3>
            <p className="text-gray-400">
              Live video interviews with AI avatars that ask targeted questions
              and adapt based on responses.
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2 text-white">Content Extraction</h3>
            <p className="text-gray-400">
              Automatically extract stories, hot takes, frameworks, and advice.
              Get tweet drafts and thread outlines.
            </p>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
            <div className="w-12 h-12 bg-red-900/50 rounded-lg flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-2 text-white">Writer Dashboard</h3>
            <p className="text-gray-400">
              Organized content bank for writers. Filter by topic, type, and
              format. Export ready-to-use content.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
