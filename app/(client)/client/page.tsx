import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Video, MessageSquare, History, Clock } from "lucide-react";

export default function ClientDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Welcome to Your Interview Portal</h1>
        <p className="text-gray-500 mt-1">
          Share your story through AI-powered interviews
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-2 hover:border-blue-500 transition-colors">
          <CardHeader>
            <Video className="h-8 w-8 text-blue-600 mb-2" />
            <CardTitle>Video Interview</CardTitle>
            <CardDescription>
              Have a live conversation with our AI avatar. Speak naturally and
              share your insights.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=live_video">
              <Button className="w-full">Start Video Interview</Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="border-2 hover:border-green-500 transition-colors">
          <CardHeader>
            <MessageSquare className="h-8 w-8 text-green-600 mb-2" />
            <CardTitle>Text Interview</CardTitle>
            <CardDescription>
              Answer questions at your own pace through text. Perfect for busy
              schedules.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/client/interview/start?mode=text_chat">
              <Button variant="outline" className="w-full">
                Start Text Interview
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Interviews
            </CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Sessions finished</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">In Progress</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Paused or ongoing interviews
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Content Generated
            </CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">
              Stories and insights extracted
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your interview history</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No interviews yet. Start your first interview above!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
