import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();

  if (session?.user) {
    redirect("/admin");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
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
          <Link href="/login">
            <Button variant="premium" size="sm">Sign In</Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-white mb-6 leading-[1.1]">
            AI-Powered Founder Interviews
          </h1>
          <p className="text-lg text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
            Send a link, get a transcript. Smart questions that adapt to each founder's answers in real time.
          </p>
          <Link href="/login">
            <Button variant="premium" size="lg" className="px-10">
              Admin Login
            </Button>
          </Link>
        </div>

        <div className="mt-32 grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Shareable Links</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Create an interview, send the link. Founders answer at their own pace. No login needed.
            </p>
          </div>

          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Smart Follow-ups</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              AI generates contextual follow-up questions based on each answer. Gets deeper stories automatically.
            </p>
          </div>

          <div className="group bg-gray-900/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-800/50 transition-all duration-300 hover:bg-gray-900/80 hover:border-gray-700 hover:-translate-y-1 hover:shadow-xl">
            <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-5 group-hover:bg-red-500/20 transition-colors duration-300">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-lg mb-3 text-white">Clean Transcripts</h3>
            <p className="text-gray-500 text-sm leading-relaxed">
              Every interview produces a clean markdown transcript. Copy it, use it for content, feed it to your tools.
            </p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 border-t border-gray-800/50">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <span>Compound</span>
          <span>Built for founders</span>
        </div>
      </footer>
    </div>
  );
}
