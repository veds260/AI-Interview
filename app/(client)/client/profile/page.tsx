"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, Mail, Building, Save } from "lucide-react";
import { toast } from "sonner";

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    bio: "",
    topics: "",
  });

  if (status === "loading") {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000));
      toast.success("Profile updated");
      setIsEditing(false);
    } catch {
      toast.error("Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Profile</h1>
        <p className="text-gray-500 mt-1">Manage your account settings</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>
                Your basic account details
              </CardDescription>
            </div>
            <Badge variant="outline" className="capitalize">
              {session?.user?.role || "client"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <p className="font-semibold text-lg">
                {session?.user?.name || "User"}
              </p>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="w-3 h-3" />
                {session?.user?.email}
              </p>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Your full name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) =>
                    setFormData({ ...formData, company: e.target.value })
                  }
                  placeholder="Your company name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={formData.bio}
                  onChange={(e) =>
                    setFormData({ ...formData, bio: e.target.value })
                  }
                  placeholder="Tell us about yourself and your work"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="topics">Topics of Expertise</Label>
                <Input
                  id="topics"
                  value={formData.topics}
                  onChange={(e) =>
                    setFormData({ ...formData, topics: e.target.value })
                  }
                  placeholder="e.g., AI, startups, growth, marketing"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated list of topics you can speak about
                </p>
              </div>

              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="pt-4">
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit Profile
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interview Statistics</CardTitle>
          <CardDescription>Your interview activity summary</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-blue-600">-</p>
              <p className="text-sm text-muted-foreground">Total Interviews</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-green-600">-</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-2xl font-bold text-purple-600">-</p>
              <p className="text-sm text-muted-foreground">Content Pieces</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
