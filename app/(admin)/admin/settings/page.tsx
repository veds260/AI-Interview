"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Settings, Key, Video, Mic, FileText, Database, Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

interface MigrationStatus {
  tables: string[];
  migrations: {
    post_comments: boolean;
  };
}

export default function SettingsPage() {
  const [migrationStatus, setMigrationStatus] = useState<MigrationStatus | null>(null);
  const [isRunningMigration, setIsRunningMigration] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    fetchMigrationStatus();
  }, []);

  const fetchMigrationStatus = async () => {
    try {
      const res = await fetch("/api/admin/migrations");
      if (res.ok) {
        const data = await res.json();
        setMigrationStatus(data);
      }
    } catch (error) {
      console.error("Failed to fetch migration status:", error);
    } finally {
      setLoadingStatus(false);
    }
  };

  const runMigration = async (migration: string) => {
    setIsRunningMigration(true);
    try {
      const res = await fetch("/api/admin/migrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ migration }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success(`Migration completed: ${data.results?.join(", ") || "Success"}`);
        fetchMigrationStatus();
      } else {
        toast.error(`Migration failed: ${data.error}`);
      }
    } catch (error) {
      toast.error("Failed to run migration");
      console.error("Migration error:", error);
    } finally {
      setIsRunningMigration(false);
    }
  };
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
            <Database className="h-5 w-5" />
            Database Migrations
          </CardTitle>
          <CardDescription>
            Run database migrations to add new tables and features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingStatus ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Post Comments Migration */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    {migrationStatus?.migrations.post_comments ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-orange-500" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">Post Comments Table</h3>
                    <p className="text-sm text-gray-500">
                      Enables inline commenting on tweet mockups for content review
                    </p>
                  </div>
                </div>
                {migrationStatus?.migrations.post_comments ? (
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    Installed
                  </Badge>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => runMigration("post_comments")}
                    disabled={isRunningMigration}
                  >
                    {isRunningMigration ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Running...
                      </>
                    ) : (
                      "Run Migration"
                    )}
                  </Button>
                )}
              </div>

              {/* Run All Migrations */}
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => runMigration("all")}
                  disabled={isRunningMigration}
                  className="w-full"
                >
                  {isRunningMigration ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Migrations...
                    </>
                  ) : (
                    <>
                      <Database className="h-4 w-4 mr-2" />
                      Run All Pending Migrations
                    </>
                  )}
                </Button>
              </div>

              {/* Table List */}
              {migrationStatus?.tables && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">
                    Current Tables ({migrationStatus.tables.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {migrationStatus.tables.map((table) => (
                      <Badge key={table} variant="outline" className="text-xs">
                        {table}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
