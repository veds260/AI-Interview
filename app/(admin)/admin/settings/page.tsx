"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Key, Video, Mic, FileText } from "lucide-react";

export default function SettingsPage() {
  // Check which API keys are configured (based on env vars presence)
  const apiServices = [
    {
      name: "HeyGen",
      description: "AI Video Avatar for live interviews",
      icon: <Video className="h-5 w-5" />,
      envVar: "HEYGEN_API_KEY",
    },
    {
      name: "ElevenLabs",
      description: "Speech-to-Text transcription",
      icon: <Mic className="h-5 w-5" />,
      envVar: "ELEVENLABS_API_KEY",
    },
    {
      name: "OpenAI",
      description: "AI-powered question generation and analysis",
      icon: <FileText className="h-5 w-5" />,
      envVar: "OPENAI_API_KEY",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Platform configuration and API settings</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API Integrations
          </CardTitle>
          <CardDescription>
            External services used by the platform. Configure API keys in your environment variables.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiServices.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {service.icon}
                  </div>
                  <div>
                    <h3 className="font-medium">{service.name}</h3>
                    <p className="text-sm text-gray-500">{service.description}</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-gray-500">
                  {service.envVar}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Platform Info
          </CardTitle>
          <CardDescription>
            System information and configuration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Application</h3>
              <p className="text-lg font-semibold">Compound Interviewer</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Database</h3>
              <p className="text-lg font-semibold">PostgreSQL (Railway)</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Authentication</h3>
              <p className="text-lg font-semibold">NextAuth.js</p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="text-sm font-medium text-gray-500">Framework</h3>
              <p className="text-lg font-semibold">Next.js 15</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
